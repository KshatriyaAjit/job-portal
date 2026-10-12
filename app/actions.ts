"use server";

import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db";
import Job, { IJob } from "@/models/Job";
import Application, { ApplicationStatus, APPLICATION_STATUSES } from "@/models/Application";
import SavedJob from "@/models/SavedJob";
import Profile from "@/models/Profile";
import User, { UserRole } from "@/models/User";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { 
  sendApplicationEmail, 
  sendStatusUpdateEmail, 
  sendApplicationConfirmationEmail,
  sendRecruiterApprovalEmail,
} from "@/lib/mail";
import { sanitizeRichText } from "@/lib/sanitize";
import { requireAuth, requireRecruiter, requireAdmin } from "@/lib/auth";
import mongoose from "mongoose";

import { isValidHttpUrl, isValidResumeUrl } from "@/lib/validation";
import { sanitizeCsvField } from "@/lib/csv";

const VALID_JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];

// --- 1. POST JOB ---
export async function createJob(formData: FormData): Promise<{ success: boolean; jobId?: string }> {
  // Enforce server-side recruiter authorization
  const authUser = await requireRecruiter();

  await connectDB();

  const title = (formData.get("title") as string)?.trim();
  const rawDescription = formData.get("description") as string;
  const companyName = (formData.get("companyName") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();
  const salaryString = formData.get("salary") as string;
  const jobType = (formData.get("jobType") as string)?.trim();

  if (!title || !companyName || !location || !salaryString) {
    throw new Error("Missing required job fields.");
  }

  const salary = Number(salaryString);
  if (isNaN(salary) || salary <= 0 || salary > 50_000_000) {
    throw new Error("Salary must be a positive number between 1 and 50,000,000.");
  }

  if (!VALID_JOB_TYPES.includes(jobType)) {
    throw new Error(`Invalid job type. Must be one of: ${VALID_JOB_TYPES.join(", ")}`);
  }

  // Prevent stored XSS by sanitizing rich text HTML before persistence
  const description = sanitizeRichText(rawDescription);
  const textContent = description.replace(/<[^>]*>/g, " ").trim();
  if (!textContent || textContent.length === 0) {
    throw new Error("Job description cannot be empty.");
  }

  const newJob = await Job.create({
    title,
    description,
    companyName,
    location,
    salary,
    jobType,
    clerkId: authUser.userId,
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
  return { success: true, jobId: newJob._id.toString() };
}

// --- 2. SUBMIT APPLICATION ---
export async function submitApplication(
  jobId: string,
  resumeUrl: string,
  coverLetter?: string
): Promise<{ success: boolean; alreadyApplied?: boolean }> {
  const authUser = await requireAuth();

  // Recruiters cannot apply to jobs
  if (authUser.role === "recruiter") {
    throw new Error("Recruiters cannot submit job applications.");
  }

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    throw new Error("Invalid job ID.");
  }

  const cleanResumeUrl = resumeUrl?.trim();
  if (!cleanResumeUrl || !isValidResumeUrl(cleanResumeUrl)) {
    throw new Error("A valid Cloudinary PDF resume URL (HTTPS) is required.");
  }

  const cleanCoverLetter = coverLetter ? coverLetter.trim().slice(0, 5000) : undefined;

  await connectDB();

  const job = await Job.findById(jobId);
  if (!job) {
    throw new Error("Job listing not found.");
  }

  // Prevent applying to one's own job if recruiter
  if (job.clerkId === authUser.userId) {
    throw new Error("You cannot apply to your own job listing.");
  }

  // Check existing application in DB
  const existing = await Application.findOne({ jobId, userId: authUser.userId });
  if (existing) {
    return { success: false, alreadyApplied: true };
  }

  try {
    await Application.create({
      jobId,
      userId: authUser.userId,
      resumeUrl: cleanResumeUrl,
      coverLetter: cleanCoverLetter,
      status: "pending",
    });
  } catch (error: unknown) {
    // Gracefully handle duplicate key error (code 11000) from unique compound index
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 11000) {
      return { success: false, alreadyApplied: true };
    }
    throw error;
  }

  // Send application notifications safely without failing the core application workflow
  try {
    const user = await currentUser();
    const candidateName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Candidate" : "Candidate";

    // 1. Resolve owning recruiter email (MongoDB first, Clerk API fallback)
    let recruiterEmail: string | undefined = undefined;
    const recruiterDbUser = await User.findOne({ clerkId: job.clerkId });
    if (recruiterDbUser?.email) {
      recruiterEmail = recruiterDbUser.email;
    } else {
      try {
        const client = await clerkClient();
        const recruiterUser = await client.users.getUser(job.clerkId);
        recruiterEmail = recruiterUser.emailAddresses?.[0]?.emailAddress;
      } catch {
        // Recruiter Clerk lookup fallback
      }
    }

    if (recruiterEmail) {
      await sendApplicationEmail(
        recruiterEmail,
        candidateName,
        job.title,
        cleanResumeUrl
      );
    } else {
      console.warn(`Could not resolve owning recruiter email for job ${jobId}. Skipping recruiter email.`);
    }

    // 2. Dispatch confirmation email to applicant's authenticated address
    if (authUser.email) {
      await sendApplicationConfirmationEmail(
        authUser.email,
        candidateName,
        job.title,
        job.companyName
      );
    }
  } catch (emailError: unknown) {
    console.error("Email notification failed, but application was saved successfully:", emailError);
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/my-applications");
  return { success: true };
}

// --- 3. UPDATE APPLICATION STATUS ---
export async function updateApplicationStatus(
  applicationId: string,
  newStatus: string
): Promise<{ success: boolean }> {
  const authUser = await requireAuth();

  if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
    throw new Error("Invalid application ID.");
  }

  // Validate status against allowed enum values
  if (!APPLICATION_STATUSES.includes(newStatus as ApplicationStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${APPLICATION_STATUSES.join(", ")}`);
  }

  await connectDB();

  // Load application with populated job to verify ownership
  const application = await Application.findById(applicationId).populate<{ jobId: IJob }>("jobId");
  if (!application) {
    throw new Error("Application not found.");
  }

  const job = application.jobId;
  if (!job) {
    throw new Error("Associated job listing could not be found.");
  }

  // Critical IDOR authorization check: only the recruiter who posted the job can update status
  if (job.clerkId !== authUser.userId) {
    throw new Error("Forbidden: You do not have permission to modify applications for this job.");
  }

  application.status = newStatus as ApplicationStatus;
  await application.save();

  revalidatePath("/dashboard");

  // Send status update email notification safely
  try {
    let candidateEmail: string | undefined = undefined;
    let candidateName = "Candidate";

    // Check MongoDB first to avoid unnecessary external API latency
    const candidateDbUser = await User.findOne({ clerkId: application.userId });
    if (candidateDbUser?.email) {
      candidateEmail = candidateDbUser.email;
      candidateName = [candidateDbUser.firstName, candidateDbUser.lastName].filter(Boolean).join(" ").trim() || candidateName;
    } else {
      try {
        const client = await clerkClient();
        const candidateUser = await client.users.getUser(application.userId);
        candidateEmail = candidateUser.emailAddresses?.[0]?.emailAddress;
        candidateName = `${candidateUser.firstName || ""} ${candidateUser.lastName || ""}`.trim() || candidateName;
      } catch {
        // Clerk candidate lookup fallback
      }
    }

    if (candidateEmail) {
      await sendStatusUpdateEmail(
        candidateEmail,
        candidateName,
        job.title,
        newStatus
      );
    } else {
      console.warn(`Could not resolve candidate email for userId ${application.userId}. Skipping status notification.`);
    }
  } catch (error: unknown) {
    console.error("Failed to send status update email:", error);
  }

  return { success: true };
}

// --- 4. SAVE PROFILE ---
export async function saveProfile(formData: FormData): Promise<{ success: boolean }> {
  const authUser = await requireAuth();

  await connectDB();

  const email = (formData.get("email") as string)?.trim() || authUser.email;
  const bio = (formData.get("bio") as string)?.trim().slice(0, 2000) || "";
  const skillsString = (formData.get("skills") as string) || "";
  const linkedin = (formData.get("linkedin") as string)?.trim() || "";
  const github = (formData.get("github") as string)?.trim() || "";
  const portfolio = (formData.get("portfolio") as string)?.trim() || "";
  const resumeUrl = (formData.get("resumeUrl") as string)?.trim() || "";

  // Validate URLs if provided
  if (linkedin && !isValidHttpUrl(linkedin)) throw new Error("Invalid LinkedIn URL.");
  if (github && !isValidHttpUrl(github)) throw new Error("Invalid GitHub URL.");
  if (portfolio && !isValidHttpUrl(portfolio)) throw new Error("Invalid Portfolio URL.");
  if (resumeUrl && !isValidResumeUrl(resumeUrl)) {
    throw new Error("Invalid Resume URL. Must be a secure Cloudinary PDF link (HTTPS).");
  }

  const skills = skillsString
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  await Profile.findOneAndUpdate(
    { userId: authUser.userId },
    {
      userId: authUser.userId,
      email,
      bio,
      skills,
      linkedin: linkedin || undefined,
      github: github || undefined,
      portfolio: portfolio || undefined,
      resumeUrl: resumeUrl || undefined,
    },
    { upsert: true, new: true }
  );

  // Invalidate stale cached AI evaluations for this candidate's applications so recruiters evaluate updated profile
  await Application.updateMany(
    { userId: authUser.userId },
    { $unset: { aiScore: 1, aiAnalysis: 1 } }
  );

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true };
}

// --- 5. DELETE JOB ---
export async function deleteJob(jobId: string): Promise<void> {
  const authUser = await requireRecruiter();

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    throw new Error("Invalid job ID.");
  }

  await connectDB();

  const job = await Job.findById(jobId);
  if (!job) throw new Error("Job not found.");
  if (job.clerkId !== authUser.userId) {
    throw new Error("Forbidden: You are not authorized to delete this job.");
  }

  await Job.findByIdAndDelete(jobId);

  // Clean up associated applications and saved job bookmarks to avoid orphaned records
  await Application.deleteMany({ jobId });
  await SavedJob.deleteMany({ jobId });

  revalidatePath("/dashboard");
  revalidatePath("/");
}

// --- 6. UPDATE JOB ---
export async function updateJob(jobId: string, formData: FormData): Promise<void> {
  const authUser = await requireRecruiter();

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    throw new Error("Invalid job ID.");
  }

  await connectDB();

  const job = await Job.findById(jobId);
  if (!job) throw new Error("Job not found.");
  if (job.clerkId !== authUser.userId) {
    throw new Error("Forbidden: You are not authorized to edit this job.");
  }

  const title = (formData.get("title") as string)?.trim();
  const rawDescription = formData.get("description") as string;
  const companyName = (formData.get("companyName") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();
  const salaryString = formData.get("salary") as string;
  const salary = Number(salaryString);
  const jobType = (formData.get("jobType") as string)?.trim();

  if (!title || !companyName || !location || !salaryString) {
    throw new Error("Missing required job fields.");
  }

  if (isNaN(salary) || salary <= 0 || salary > 50_000_000) {
    throw new Error("Salary must be a positive number between 1 and 50,000,000.");
  }

  if (!VALID_JOB_TYPES.includes(jobType)) {
    throw new Error(`Invalid job type. Must be one of: ${VALID_JOB_TYPES.join(", ")}`);
  }

  const description = sanitizeRichText(rawDescription);
  const textContent = description.replace(/<[^>]*>/g, " ").trim();
  if (!textContent || textContent.length === 0) {
    throw new Error("Job description cannot be empty.");
  }

  await Job.findByIdAndUpdate(jobId, {
    title,
    description,
    companyName,
    location,
    salary,
    jobType,
  });

  // Invalidate stale cached AI evaluations for this job since job requirements have changed
  await Application.updateMany(
    { jobId },
    { $unset: { aiScore: 1, aiAnalysis: 1 } }
  );

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
  redirect("/dashboard");
}

// --- 7. TOGGLE SAVED JOB ---
export async function toggleSavedJob(jobId: string): Promise<{ saved: boolean }> {
  const authUser = await requireAuth();

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    throw new Error("Invalid job ID.");
  }

  await connectDB();

  const existing = await SavedJob.findOne({ userId: authUser.userId, jobId });

  if (existing) {
    await SavedJob.findByIdAndDelete(existing._id);
    revalidatePath("/");
    revalidatePath("/saved-jobs");
    return { saved: false };
  } else {
    try {
      await SavedJob.create({ userId: authUser.userId, jobId });
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 11000) {
        return { saved: true };
      }
      throw error;
    }
    revalidatePath("/");
    revalidatePath("/saved-jobs");
    return { saved: true };
  }
}

// --- 8. ADMIN: DELETE JOB ---
export async function adminDeleteJob(jobId: string): Promise<void> {
  // Enforce server-side admin check
  await requireAdmin();

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    throw new Error("Invalid job ID.");
  }

  await connectDB();

  await Job.findByIdAndDelete(jobId);
  await Application.deleteMany({ jobId });
  await SavedJob.deleteMany({ jobId });

  revalidatePath("/admin");
  revalidatePath("/");
}

// --- 9. BULK UPDATE APPLICATION STATUS ---
export async function bulkUpdateApplicationStatus(
  applicationIds: string[],
  newStatus: string
): Promise<{ success: boolean; count: number }> {
  const authUser = await requireRecruiter();

  if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
    throw new Error("No application IDs provided.");
  }

  // Validate all IDs
  for (const id of applicationIds) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid application ID: ${id}`);
    }
  }

  // Validate status
  if (!APPLICATION_STATUSES.includes(newStatus as ApplicationStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be one of: ${APPLICATION_STATUSES.join(", ")}`);
  }

  await connectDB();

  // Find all applications and populate their jobs
  const applications = await Application.find({
    _id: { $in: applicationIds },
  }).populate<{ jobId: IJob }>("jobId");

  if (applications.length !== applicationIds.length) {
    throw new Error("One or more applications could not be found.");
  }

  // Enforce strict recruiter authorization across ALL target applications
  for (const app of applications) {
    if (!app.jobId || app.jobId.clerkId !== authUser.userId) {
      throw new Error("Forbidden: You are not authorized to modify one or more of these applications.");
    }
  }

  // Bulk update statuses in MongoDB
  await Application.updateMany(
    { _id: { $in: applicationIds } },
    { $set: { status: newStatus as ApplicationStatus } }
  );

  revalidatePath("/dashboard");

  // Send email notifications to candidates safely in background
  try {
    const candidateUserIds = Array.from(new Set(applications.map((a) => a.userId)));
    const candidateDbUsers = await User.find({ clerkId: { $in: candidateUserIds } }).lean();
    const userMap = new Map(candidateDbUsers.map((u) => [u.clerkId, u]));

    for (const app of applications) {
      const candidate = userMap.get(app.userId);
      const email = candidate?.email;
      const name = [candidate?.firstName, candidate?.lastName].filter(Boolean).join(" ").trim() || "Candidate";
      if (email && app.jobId?.title) {
        sendStatusUpdateEmail(email, name, app.jobId.title, newStatus).catch((err) => {
          console.error(`Failed to send bulk status email to ${email}:`, err);
        });
      }
    }
  } catch (emailErr) {
    console.error("Bulk status notification error:", emailErr);
  }

  return { success: true, count: applications.length };
}

// --- 10. SECURE CSV EXPORT WITH FORMULA INJECTION DEFENSE ---

export async function exportApplicantsCSV(
  jobId: string
): Promise<{ success: boolean; csv?: string; filename?: string; error?: string }> {
  const authUser = await requireRecruiter();

  if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
    throw new Error("Invalid job ID.");
  }

  await connectDB();

  const job = await Job.findById(jobId);
  if (!job) {
    throw new Error("Job listing not found.");
  }

  if (job.clerkId !== authUser.userId) {
    throw new Error("Forbidden: You do not have permission to export applicants for this job.");
  }

  // Fetch applications for this job
  const applications = await Application.find({ jobId }).sort({ createdAt: -1 });
  const applicantIds = applications.map((a) => a.userId);

  const [profiles, users] = await Promise.all([
    Profile.find({ userId: { $in: applicantIds } }).lean(),
    User.find({ clerkId: { $in: applicantIds } }).lean(),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.userId, p]));
  const userMap = new Map(users.map((u) => [u.clerkId, u]));

  // CSV Headers
  const headers = [
    "Applicant Name",
    "Email",
    "Applied Date",
    "Status",
    "AI Match Score",
    "Skills",
    "Resume URL",
    "LinkedIn",
    "Portfolio",
    "Cover Letter",
  ];

  const rows: string[] = [headers.map(sanitizeCsvField).join(",")];

  for (const app of applications) {
    const profile = profileMap.get(app.userId);
    const user = userMap.get(app.userId);

    const name =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      profile?.email ||
      user?.email ||
      `Applicant ${app.userId.slice(0, 8)}`;

    const email = profile?.email || user?.email || "N/A";
    const appliedDate = app.createdAt
      ? new Date(app.createdAt).toISOString().split("T")[0]
      : "N/A";
    const status = app.status;
    const aiScore = typeof app.aiScore === "number" ? `${app.aiScore}%` : "Not Evaluated";
    const skills = Array.isArray(profile?.skills) ? profile.skills.join("; ") : "N/A";
    const resumeUrl = app.resumeUrl || "N/A";
    const linkedin = profile?.linkedin || "";
    const portfolio = profile?.portfolio || "";
    const coverLetter = app.coverLetter
      ? app.coverLetter.replace(/[\r\n]+/g, " ").slice(0, 500)
      : "";

    const row = [
      sanitizeCsvField(name),
      sanitizeCsvField(email),
      sanitizeCsvField(appliedDate),
      sanitizeCsvField(status),
      sanitizeCsvField(aiScore),
      sanitizeCsvField(skills),
      sanitizeCsvField(resumeUrl),
      sanitizeCsvField(linkedin),
      sanitizeCsvField(portfolio),
      sanitizeCsvField(coverLetter),
    ];

    rows.push(row.join(","));
  }

  const cleanTitle = job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `applicants-${cleanTitle}-${dateStr}.csv`;

  return {
    success: true,
    csv: rows.join("\r\n"),
    filename,
  };
}

// --- 11. SUBMIT RECRUITER APPLICATION (ONBOARDING) ---
export async function completeRecruiterOnboarding(
  formData: FormData
): Promise<void> {
  // Requires authenticated session
  const authUser = await requireAuth();

  // If already an approved recruiter, redirect to dashboard
  if (authUser.role === "recruiter") {
    redirect("/dashboard");
  }

  const companyName = (formData.get("companyName") as string)?.trim();
  if (!companyName || companyName.length < 2 || companyName.length > 100) {
    throw new Error("Company name is required (between 2 and 100 characters).");
  }

  const reason = (formData.get("reason") as string)?.trim()?.slice(0, 500) || undefined;

  // CRITICAL SECURITY ENFORCEMENT:
  // Candidates CANNOT self-promote to recruiter.
  // We NEVER update Clerk publicMetadata to recruiter here.
  // We store the application as "pending" with role "candidate".
  // Only an authorized administrator via adminApproveRecruiter or adminUpdateUserRole can grant the recruiter role.
  await connectDB();
  try {
    await User.findOneAndUpdate(
      { clerkId: authUser.userId },
      {
        companyName,
        recruiterStatus: "pending",
        recruiterReason: reason,
        recruiterRequestedAt: new Date(),
        role: "candidate", // Explicitly ensure role remains candidate
      },
      { upsert: true, new: true }
    );
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr?.code === 11000 || mongoErr?.message?.includes("E11000")) {
      await User.updateOne(
        { clerkId: authUser.userId },
        {
          companyName,
          recruiterStatus: "pending",
          recruiterReason: reason,
          recruiterRequestedAt: new Date(),
          role: "candidate",
        }
      );
    } else {
      throw err;
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/recruiter-onboarding");
  redirect("/recruiter-onboarding");
}

// --- 12. ADMIN APPROVE RECRUITER APPLICATION ---
export async function adminApproveRecruiter(
  targetClerkId: string
): Promise<{ success: boolean; emailSent?: boolean }> {
  // Strictly requires configured server administrator
  const admin = await requireAdmin();

  if (!targetClerkId?.trim()) {
    throw new Error("Target user ID is required.");
  }

  await connectDB();
  const targetUser = await User.findOne({ clerkId: targetClerkId });
  if (!targetUser) {
    throw new Error("Target user not found.");
  }

  // Validate that a pending recruiter application exists, or user is already approved (idempotent case)
  const isPending =
    targetUser.recruiterStatus === "pending" ||
    (!targetUser.recruiterStatus && Boolean(targetUser.companyName));

  if (!isPending && targetUser.recruiterStatus !== "approved") {
    throw new Error("Cannot approve recruiter: No pending recruiter application found for this user.");
  }

  // Idempotency: If user is already approved AND approval notification has already been sent,
  // avoid duplicate emails and return safely.
  if (
    targetUser.role === "recruiter" &&
    targetUser.recruiterStatus === "approved" &&
    targetUser.recruiterApprovalEmailSentAt
  ) {
    return { success: true, emailSent: false };
  }

  // 1. Update Clerk publicMetadata server-side via Admin API
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(targetClerkId, {
      publicMetadata: { role: "recruiter" },
    });
  } catch (error) {
    console.error("Failed to update Clerk user metadata in admin approve:", error);
  }

  // 2. Update MongoDB record to approved recruiter
  await User.findOneAndUpdate(
    { clerkId: targetClerkId },
    {
      role: "recruiter",
      recruiterStatus: "approved",
      recruiterReviewedAt: new Date(),
      recruiterReviewedBy: admin.email,
    }
  );

  // 3. Send approval notification email (idempotent and non-blocking for role approval)
  let emailSent = false;
  if (!targetUser.recruiterApprovalEmailSentAt) {
    try {
      const recipientEmail = targetUser.email?.trim();
      if (recipientEmail) {
        const recruiterName =
          [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ").trim() ||
          "Recruiter";
        const emailResult = await sendRecruiterApprovalEmail(
          recipientEmail,
          recruiterName,
          targetUser.companyName
        );
        // Atomically record that the approval notification was accepted by Resend
        if (emailResult?.id) {
          await User.updateOne(
            { clerkId: targetClerkId },
            { recruiterApprovalEmailSentAt: new Date() }
          );
          emailSent = true;
        } else {
          console.warn(`[Approval Email] Email skipped or not accepted by Resend for user ${targetClerkId}.`);
        }
      } else {
        console.warn(`[Approval Email] No registered email address found for user ${targetClerkId}. Email skipped.`);
      }
    } catch (emailErr: unknown) {
      // Safe error reporting: do not expose secrets or sensitive candidate data
      const errMsg = emailErr instanceof Error ? emailErr.message : "Email request failed";
      console.error(`[Approval Email] Request to Resend failed for user ${targetClerkId}: ${errMsg}`);
      // Crucial: Approval remains valid in Clerk and MongoDB; do not throw to admin or rollback approval.
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: true, emailSent };
}

// --- 13. ADMIN REJECT RECRUITER APPLICATION ---
export async function adminRejectRecruiter(
  targetClerkId: string,
  rejectionReason?: string
): Promise<{ success: boolean }> {
  // Strictly requires configured server administrator
  const admin = await requireAdmin();

  if (!targetClerkId?.trim()) {
    throw new Error("Target user ID is required.");
  }

  await connectDB();
  const targetUser = await User.findOne({ clerkId: targetClerkId });
  if (!targetUser) {
    throw new Error("Target user not found.");
  }

  // 1. Ensure Clerk publicMetadata is set to candidate
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(targetClerkId, {
      publicMetadata: { role: "candidate" },
    });
  } catch (error) {
    console.error("Failed to update Clerk user metadata in admin reject:", error);
  }

  // 2. Update MongoDB record to rejected
  await User.findOneAndUpdate(
    { clerkId: targetClerkId },
    {
      role: "candidate",
      recruiterStatus: "rejected",
      recruiterReason: rejectionReason?.trim()?.slice(0, 500) || targetUser.recruiterReason,
      recruiterReviewedAt: new Date(),
      recruiterReviewedBy: admin.email,
    }
  );

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { success: true };
}

// --- 14. ADMIN UPDATE USER ROLE ---
export async function adminUpdateUserRole(
  targetClerkId: string,
  newRole: UserRole
): Promise<{ success: boolean }> {
  // Strictly requires configured server administrator
  const admin = await requireAdmin();

  if (newRole !== "candidate" && newRole !== "recruiter") {
    throw new Error("Invalid role specified.");
  }

  if (!targetClerkId?.trim()) {
    throw new Error("Target user ID is required.");
  }

  // 1. Update Clerk publicMetadata
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(targetClerkId, {
      publicMetadata: { role: newRole },
    });
  } catch (error) {
    console.error("Failed to update Clerk user metadata in admin action:", error);
  }

  // 2. Update MongoDB record
  await connectDB();
  await User.findOneAndUpdate(
    { clerkId: targetClerkId },
    {
      role: newRole,
      recruiterStatus: newRole === "recruiter" ? "approved" : "none",
      recruiterReviewedAt: new Date(),
      recruiterReviewedBy: admin.email,
    }
  );

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: true };
}
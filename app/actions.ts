"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import Application from "@/models/Application";
import SavedJob from "@/models/SavedJob";
import Profile from "@/models/Profile";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sendApplicationEmail, sendStatusUpdateEmail } from "@/lib/mail";

// --- 1. POST JOB ---
export async function createJob(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("You must be signed in to post a job.");
  }

  await connectDB();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const companyName = formData.get("companyName") as string;
  const location = formData.get("location") as string;
  const salary = formData.get("salary") as string;
  const jobType = formData.get("jobType") as string;

  await Job.create({
    title,
    description,
    companyName,
    location,
    salary: Number(salary),
    jobType,
    clerkId: userId,
  });

  revalidatePath("/");
  return { success: true };
}

// --- 2. SUBMIT APPLICATION ---


// --- 2. SUBMIT APPLICATION ---

export async function submitApplication(jobId: string, resumeUrl: string, coverLetter?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  const existing = await Application.findOne({ jobId, userId });
  if (existing) throw new Error("Already applied");

  const user = await currentUser();
  const candidateName = `${user?.firstName} ${user?.lastName}`;
  
  const job = await Job.findById(jobId);
  if (!job) throw new Error("Job not found");

  await Application.create({
    jobId,
    userId,
    resumeUrl,
    coverLetter, // 👈 Saving the cover letter
    status: "pending",
  });

  try {
    await sendApplicationEmail(
      "recruiter@example.com", // In a real app, use job.clerkId to find email
      candidateName,
      job.title,
      resumeUrl
    );
  } catch (err) {
    console.error("Email failed to send, but application was saved.");
  }

  revalidatePath(`/jobs/${jobId}`);
  return { success: true };
}

// ... rest of the file (Keep everything else exactly the same)

// --- 3. UPDATE STATUS ---
export async function updateApplicationStatus(applicationId: string, newStatus: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  const application = await Application.findByIdAndUpdate(
    applicationId, 
    { status: newStatus },
    { new: true }
  ).populate("jobId");

  if (!application) throw new Error("Application not found");

  revalidatePath("/dashboard");

  try {
    const client = await clerkClient();
    const candidateUser = await client.users.getUser(application.userId);
    const candidateEmail = candidateUser.emailAddresses[0].emailAddress;
    const candidateName = `${candidateUser.firstName} ${candidateUser.lastName}`;
    const jobTitle = (application.jobId as any).title;

    await sendStatusUpdateEmail(
      candidateEmail,
      candidateName,
      jobTitle,
      newStatus
    );
  } catch (error) {
    console.error("Failed to send status email:", error);
  }
}

// --- 4. SAVE PROFILE ---
// ... inside app/actions.ts

// --- 4. SAVE PROFILE ---
export async function saveProfile(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  const email = formData.get("email") as string;
  const bio = formData.get("bio") as string;
  const skillsString = formData.get("skills") as string;
  const linkedin = formData.get("linkedin") as string;
  const github = formData.get("github") as string;
  const portfolio = formData.get("portfolio") as string;
  const resumeUrl = formData.get("resumeUrl") as string;

  // Convert comma-separated string to array
  const skills = skillsString.split(",").map((s) => s.trim()).filter(Boolean);

  await Profile.findOneAndUpdate(
    { userId },
    {
      userId,
      email,
      bio,
      skills,
      linkedin,
      github,
      portfolio,
      resumeUrl,
    },
    { upsert: true, new: true } // Create if not exists, Update if exists
  );

  revalidatePath("/profile");
}

// --- 5. AI SCORE ---
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function generateAIScore(jobDescription: string, candidateProfile: any) {
  if (!apiKey || !genAI) {
    return { score: 0, reason: "Error: API Key is missing." };
  }

  try {
    // Reverted to gemini-1.5-flash as requested
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert Tech Recruiter. 
      JOB DESCRIPTION: "${jobDescription.slice(0, 500)}"
      CANDIDATE PROFILE: Bio: ${candidateProfile.bio || "No bio"}, Skills: ${candidateProfile.skills ? candidateProfile.skills.join(", ") : "None"}
      TASK: Rate match (0-100) and give 1 sentence reason.
      OUTPUT JSON: { "score": number, "reason": "string" }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonString = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonString);

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return { score: 0, reason: "AI Service Unavailable." };
  }
}



// --- 6. 👇 NEW: DELETE JOB ---
export async function deleteJob(jobId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();
  
  // Verify ownership before deleting
  const job = await Job.findById(jobId);
  if (!job) throw new Error("Job not found");
  if (job.clerkId !== userId) throw new Error("You are not authorized to delete this job");

  await Job.findByIdAndDelete(jobId);
  
  // Optional: Delete associated applications
  await Application.deleteMany({ jobId });

  revalidatePath("/dashboard");
}

// --- 7. 👇 NEW: UPDATE JOB ---
export async function updateJob(jobId: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  // Verify ownership
  const job = await Job.findById(jobId);
  if (!job || job.clerkId !== userId) throw new Error("Unauthorized");

  const updates = {
    title: formData.get("title"),
    description: formData.get("description"),
    companyName: formData.get("companyName"),
    location: formData.get("location"),
    salary: Number(formData.get("salary")),
    jobType: formData.get("jobType"),
  };

  await Job.findByIdAndUpdate(jobId, updates);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function toggleSavedJob(jobId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  // Check if already saved
  const existing = await SavedJob.findOne({ userId, jobId });

  if (existing) {
    // If found, delete it (Unsave)
    await SavedJob.findByIdAndDelete(existing._id);
    revalidatePath("/");
    revalidatePath("/saved-jobs");
    return { saved: false };
  } else {
    // If not found, create it (Save)
    await SavedJob.create({ userId, jobId });
    revalidatePath("/");
    revalidatePath("/saved-jobs");
    return { saved: true };
  }
}

// --- 8. ADMIN: DELETE JOB ---
export async function adminDeleteJob(jobId: string) {
  const user = await currentUser();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  if (!user || user.emailAddresses[0].emailAddress !== adminEmail) {
    throw new Error("⛔ Unauthorized: You are not an admin.");
  }

  await connectDB();
  await Job.findByIdAndDelete(jobId);
  // Optional: Clean up applications for this job
  await Application.deleteMany({ jobId });

  revalidatePath("/admin");
}
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk server functions
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getUser: vi.fn().mockResolvedValue({
        id: "candidate_123",
        firstName: "Jane",
        lastName: "Doe",
        emailAddresses: [{ emailAddress: "jane@example.com" }],
      }),
      updateUserMetadata: vi.fn().mockResolvedValue({}),
    },
  }),
}));

// Mock DB connection
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

// Mock Resend mailer
vi.mock("@/lib/mail", () => ({
  sendApplicationEmail: vi.fn().mockResolvedValue(undefined),
  sendStatusUpdateEmail: vi.fn().mockResolvedValue(undefined),
  sendApplicationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendRecruiterApprovalEmail: vi.fn().mockResolvedValue(undefined),
}));

// Mock Next.js cache and navigation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Import models to mock methods
import Job from "@/models/Job";
import Application from "@/models/Application";
import SavedJob from "@/models/SavedJob";
import User from "@/models/User";
import * as authLib from "@/lib/auth";
import * as mailLib from "@/lib/mail";
import {
  createJob,
  submitApplication,
  updateApplicationStatus,
  deleteJob,
  adminDeleteJob,
  completeRecruiterOnboarding,
  adminUpdateUserRole,
  adminApproveRecruiter,
  adminRejectRecruiter,
} from "@/app/actions";
import { isValidResumeUrl } from "@/lib/validation";
import { generateAIScore } from "@/app/actions/ai";
import mongoose from "mongoose";

describe("Privileged Server Actions Authorization & Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
  });

  describe("createJob Action", () => {
    it("rejects when caller does not have recruiter role", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockRejectedValue(
        new Error("Forbidden: Recruiter access required.")
      );

      const formData = new FormData();
      formData.append("title", "Frontend Dev");
      formData.append("description", "<p>React</p>");
      formData.append("companyName", "Tech Corp");
      formData.append("location", "Remote");
      formData.append("salary", "100000");
      formData.append("jobType", "Full-time");

      await expect(createJob(formData)).rejects.toThrow("Forbidden: Recruiter access required.");
    });

    it("sanitizes rich text and creates job for authorized recruiter", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@example.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const fakeJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "create").mockResolvedValue({
        _id: fakeJobId,
      } as unknown as Awaited<ReturnType<typeof Job.create>>);

      const formData = new FormData();
      formData.append("title", "Senior Developer");
      formData.append("description", '<p>Safe info</p><script>alert("hacked")</script>');
      formData.append("companyName", "Acme Inc");
      formData.append("location", "New York");
      formData.append("salary", "120000");
      formData.append("jobType", "Full-time");
      formData.append("category", "Engineering");

      const result = await createJob(formData);
      expect(result.success).toBe(true);
      expect(result.jobId).toBe(fakeJobId.toString());

      // Verify that Job.create received SANITIZED HTML without <script> and valid category
      expect(Job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "<p>Safe info</p>",
          category: "Engineering",
          clerkId: "recruiter_1",
        })
      );
    });

    it("rejects invalid job types and negative salaries", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@example.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const formData = new FormData();
      formData.append("title", "Dev");
      formData.append("description", "<p>Details</p>");
      formData.append("companyName", "Acme");
      formData.append("location", "Remote");
      formData.append("salary", "-500");
      formData.append("jobType", "InvalidType");
      formData.append("category", "Engineering");

      await expect(createJob(formData)).rejects.toThrow();
    });

    it("rejects missing or empty category in createJob", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@example.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const formData = new FormData();
      formData.append("title", "Frontend Dev");
      formData.append("description", "<p>React</p>");
      formData.append("companyName", "Acme");
      formData.append("location", "Remote");
      formData.append("salary", "100000");
      formData.append("jobType", "Full-time");
      // Omit category

      await expect(createJob(formData)).rejects.toThrow("Job category is required.");
    });

    it("rejects invalid category enum in createJob", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@example.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const formData = new FormData();
      formData.append("title", "Frontend Dev");
      formData.append("description", "<p>React</p>");
      formData.append("companyName", "Acme");
      formData.append("location", "Remote");
      formData.append("salary", "100000");
      formData.append("jobType", "Full-time");
      formData.append("category", "InvalidCategory");

      await expect(createJob(formData)).rejects.toThrow("Invalid job category. Must be one of:");
    });
  });

  describe("submitApplication Action", () => {
    it("rejects recruiters from applying to jobs", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "recruiter_user",
        email: "recruiter@company.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const validId = new mongoose.Types.ObjectId().toString();
      await expect(
        submitApplication(validId, "https://example.com/resume.pdf")
      ).rejects.toThrow("Recruiters cannot submit job applications.");
    });

    it("rejects non-Cloudinary resume URLs", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "candidate@gmail.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const validId = new mongoose.Types.ObjectId().toString();
      await expect(
        submitApplication(validId, "https://malicious-site.com/resume.pdf")
      ).rejects.toThrow("A valid Cloudinary PDF resume URL (HTTPS) is required.");
    });

    it("rejects non-PDF Cloudinary URLs", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "candidate@gmail.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const validId = new mongoose.Types.ObjectId().toString();
      await expect(
        submitApplication(validId, "https://res.cloudinary.com/demo/image/upload/virus.exe")
      ).rejects.toThrow("A valid Cloudinary PDF resume URL (HTTPS) is required.");
    });

    it("rejects invalid URL protocols (e.g. javascript: or http:)", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "candidate@gmail.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const validId = new mongoose.Types.ObjectId().toString();
      await expect(
        submitApplication(validId, "javascript:alert(1)")
      ).rejects.toThrow("A valid Cloudinary PDF resume URL (HTTPS) is required.");

      await expect(
        submitApplication(validId, "http://res.cloudinary.com/demo/resume.pdf")
      ).rejects.toThrow("A valid Cloudinary PDF resume URL (HTTPS) is required.");
    });

    it("handles duplicate applications gracefully (E11000 duplicate key)", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "candidate@gmail.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const fakeJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: fakeJobId,
        clerkId: "other_recruiter",
        title: "Engineer",
      } as unknown as ReturnType<typeof Job.findById>);

      vi.spyOn(Application, "findOne").mockResolvedValue(null);

      // Simulate Mongo E11000 duplicate key race error
      const duplicateError = new Error("E11000 duplicate key error");
      (duplicateError as unknown as { code: number }).code = 11000;
      vi.spyOn(Application, "create").mockRejectedValue(duplicateError);

      const result = await submitApplication(
        fakeJobId.toString(),
        "https://res.cloudinary.com/demo/resume.pdf"
      );

      expect(result.success).toBe(false);
      expect(result.alreadyApplied).toBe(true);
    });

    it("rejects malformed job IDs with controlled error", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "candidate@gmail.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      await expect(
        submitApplication("invalid-id-format", "https://res.cloudinary.com/demo/resume.pdf")
      ).rejects.toThrow("Invalid job ID.");
    });

    it("routes recruiter notification to actual owning recruiter and confirmation to applicant", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "applicant@gmail.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const fakeJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: fakeJobId,
        clerkId: "owning_recruiter_clerk_id",
        title: "Senior Full-Stack Engineer",
        companyName: "Acme Corp",
      } as unknown as ReturnType<typeof Job.findById>);

      // Owning recruiter exists in MongoDB
      vi.spyOn(User, "findOne").mockResolvedValue({
        clerkId: "owning_recruiter_clerk_id",
        email: "real_recruiter@acme.com",
      } as unknown as ReturnType<typeof User.findOne>);

      vi.spyOn(Application, "findOne").mockResolvedValue(null);
      vi.spyOn(Application, "create").mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as never);

      const sendAppSpy = vi.spyOn(mailLib, "sendApplicationEmail");
      const sendConfirmSpy = vi.spyOn(mailLib, "sendApplicationConfirmationEmail");

      const result = await submitApplication(
        fakeJobId.toString(),
        "https://res.cloudinary.com/demo/resume.pdf"
      );

      expect(result.success).toBe(true);
      // Recruiter notification routed to owning recruiter's actual email
      expect(sendAppSpy).toHaveBeenCalledWith(
        "real_recruiter@acme.com",
        expect.any(String),
        "Senior Full-Stack Engineer",
        "https://res.cloudinary.com/demo/resume.pdf"
      );
      // Confirmation routed to applicant's authenticated email
      expect(sendConfirmSpy).toHaveBeenCalledWith(
        "applicant@gmail.com",
        expect.any(String),
        "Senior Full-Stack Engineer",
        "Acme Corp"
      );
    });

    it("handles email delivery failure gracefully without rolling back application", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "applicant@gmail.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const fakeJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: fakeJobId,
        clerkId: "owning_recruiter_clerk_id",
        title: "Software Engineer",
        companyName: "Acme Corp",
      } as unknown as ReturnType<typeof Job.findById>);

      vi.spyOn(User, "findOne").mockResolvedValue({
        clerkId: "owning_recruiter_clerk_id",
        email: "recruiter@acme.com",
      } as unknown as ReturnType<typeof User.findOne>);

      vi.spyOn(Application, "findOne").mockResolvedValue(null);
      vi.spyOn(Application, "create").mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as never);

      // Email service throws an error
      vi.spyOn(mailLib, "sendApplicationEmail").mockRejectedValue(new Error("Resend API down"));

      const result = await submitApplication(
        fakeJobId.toString(),
        "https://res.cloudinary.com/demo/resume.pdf"
      );

      // Application still completes successfully
      expect(result.success).toBe(true);
    });
  });

  describe("updateApplicationStatus Action (IDOR Protection)", () => {
    it("rejects cross-recruiter status updates (attacker attempting to update another recruiter's job)", async () => {
      // Authenticated as Recruiter B
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "recruiter_b",
        email: "b@company.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const appId = new mongoose.Types.ObjectId();
      // Application belongs to Job created by Recruiter A
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          status: "pending",
          jobId: {
            _id: new mongoose.Types.ObjectId(),
            clerkId: "recruiter_a", // DIFFERENT RECRUITER
            title: "Designer",
          },
        }),
      } as unknown as ReturnType<typeof Application.findById>);

      await expect(
        updateApplicationStatus(appId.toString(), "accepted")
      ).rejects.toThrow("Forbidden: You do not have permission to modify applications for this job.");
    });

    it("rejects invalid status enum values", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "recruiter_a",
        email: "a@company.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const appId = new mongoose.Types.ObjectId();
      await expect(
        updateApplicationStatus(appId.toString(), "hacked_status")
      ).rejects.toThrow("Invalid status: hacked_status");
    });

    it("allows owning recruiter to update application status to accepted", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "recruiter_a",
        email: "a@company.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const appId = new mongoose.Types.ObjectId();
      const saveMock = vi.fn().mockResolvedValue(true);

      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          status: "pending",
          jobId: {
            _id: new mongoose.Types.ObjectId(),
            clerkId: "recruiter_a", // MATCHES CALLER
            title: "Designer",
          },
          save: saveMock,
        }),
      } as unknown as ReturnType<typeof Application.findById>);

      const result = await updateApplicationStatus(appId.toString(), "accepted");
      expect(result.success).toBe(true);
      expect(saveMock).toHaveBeenCalled();
    });
  });

  describe("deleteJob Action", () => {
    it("rejects non-owner from deleting a job", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "attacker_recruiter",
        email: "attacker@company.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const jobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: jobId,
        clerkId: "victim_recruiter", // Not owned by caller
      } as unknown as ReturnType<typeof Job.findById>);

      await expect(deleteJob(jobId.toString())).rejects.toThrow(
        "Forbidden: You are not authorized to delete this job."
      );
    });

    it("rejects malformed job IDs with controlled error", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@corp.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      await expect(deleteJob("not-a-valid-id")).rejects.toThrow("Invalid job ID.");
    });

    it("allows owning recruiter to delete their job listing, cascading deletions", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "owner_recruiter",
        email: "owner@company.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const jobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: jobId,
        clerkId: "owner_recruiter", // Matches caller
      } as unknown as ReturnType<typeof Job.findById>);

      vi.spyOn(Job, "findByIdAndDelete").mockResolvedValue({ _id: jobId } as never);
      vi.spyOn(Application, "deleteMany").mockResolvedValue({ deletedCount: 5 } as never);
      vi.spyOn(SavedJob, "deleteMany").mockResolvedValue({ deletedCount: 3 } as never);

      await expect(deleteJob(jobId.toString())).resolves.toBeUndefined();
      expect(Job.findByIdAndDelete).toHaveBeenCalledWith(jobId.toString());
      expect(Application.deleteMany).toHaveBeenCalledWith({ jobId: jobId.toString() });
      expect(SavedJob.deleteMany).toHaveBeenCalledWith({ jobId: jobId.toString() });
    });
  });

  describe("generateAIScore Action", () => {
    it("rejects unauthenticated or non-recruiter callers", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockRejectedValue(
        new Error("Forbidden: Recruiter access required.")
      );

      const fakeJobId = new mongoose.Types.ObjectId().toString();
      await expect(
        generateAIScore(fakeJobId, { bio: "Dev", skills: ["React"] })
      ).rejects.toThrow("Forbidden: Recruiter access required.");
    });

    it("rejects when recruiter does not own the job", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_x",
        email: "x@company.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const fakeJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: fakeJobId,
        clerkId: "recruiter_y", // DIFFERENT RECRUITER
      } as unknown as ReturnType<typeof Job.findById>);

      await expect(
        generateAIScore(fakeJobId.toString(), { bio: "Dev", skills: ["React"] })
      ).rejects.toThrow("Forbidden: You are not authorized to score candidates for this job.");
    });
  });

  describe("Resume URL Validation Helper", () => {
    it("accepts valid secure Cloudinary PDF links", () => {
      expect(isValidResumeUrl("https://res.cloudinary.com/mycloud/image/upload/v12345/my_resume.pdf")).toBe(true);
      expect(isValidResumeUrl("https://res.cloudinary.com/mycloud/raw/upload/v12345/resume.PDF")).toBe(true);
    });

    it("rejects insecure or non-Cloudinary links", () => {
      expect(isValidResumeUrl("http://res.cloudinary.com/mycloud/image/upload/v12345/my_resume.pdf")).toBe(false);
      expect(isValidResumeUrl("https://attacker.com/res.cloudinary.com/my_resume.pdf")).toBe(false);
      expect(isValidResumeUrl("https://dropbox.com/file.pdf")).toBe(false);
      expect(isValidResumeUrl("https://res.cloudinary.com/mycloud/image/upload/virus.exe")).toBe(false);
      expect(isValidResumeUrl("not-a-url")).toBe(false);
    });
  });

  describe("adminDeleteJob Action", () => {
    it("rejects unauthorized non-admin callers", async () => {
      vi.spyOn(authLib, "requireAdmin").mockRejectedValue(
        new Error("Forbidden: Admin access required.")
      );

      const fakeJobId = new mongoose.Types.ObjectId().toString();
      await expect(adminDeleteJob(fakeJobId)).rejects.toThrow(
        "Forbidden: Admin access required."
      );
    });

    it("executes deletion when called by authorized admin", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue({
        userId: "admin_user",
        email: "admin@insiderjobs.com",
      });

      const fakeJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findByIdAndDelete").mockResolvedValue({ _id: fakeJobId } as never);
      vi.spyOn(Application, "deleteMany").mockResolvedValue({ deletedCount: 2 } as never);
      vi.spyOn(SavedJob, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);

      await expect(adminDeleteJob(fakeJobId.toString())).resolves.toBeUndefined();
      expect(Job.findByIdAndDelete).toHaveBeenCalledWith(fakeJobId.toString());
      expect(Application.deleteMany).toHaveBeenCalledWith({ jobId: fakeJobId.toString() });
      expect(SavedJob.deleteMany).toHaveBeenCalledWith({ jobId: fakeJobId.toString() });
    });
  });

  describe("Recruiter Onboarding & Role Assignment Actions", () => {
    it("rejects completeRecruiterOnboarding if unauthenticated", async () => {
      vi.spyOn(authLib, "requireAuth").mockRejectedValue(
        new Error("Unauthorized: You must be signed in.")
      );

      const formData = new FormData();
      formData.append("companyName", "Tech Corp");

      await expect(completeRecruiterOnboarding(formData)).rejects.toThrow(
        "Unauthorized: You must be signed in."
      );
    });

    it("rejects completeRecruiterOnboarding if company name is missing or blank", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_123",
        email: "candidate@example.com",
        role: "candidate",
        dbUser: {} as never,
      });

      const formData = new FormData();
      formData.append("companyName", " ");

      await expect(completeRecruiterOnboarding(formData)).rejects.toThrow(
        "Company name is required (between 2 and 100 characters)."
      );
    });

    it("prevents candidate from self-promoting to recruiter via completeRecruiterOnboarding and stores pending application without granting recruiter role", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_123",
        email: "candidate@example.com",
        role: "candidate",
        dbUser: { recruiterStatus: "none" } as never,
      });

      const userUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      const formData = new FormData();
      formData.append("companyName", "Acme Innovate");
      formData.append("reason", "Hiring tech talent");

      await completeRecruiterOnboarding(formData);

      // Verify that the record is saved as PENDING and role remains CANDIDATE
      expect(userUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "candidate_123" },
        {
          companyName: "Acme Innovate",
          recruiterStatus: "pending",
          recruiterReason: "Hiring tech talent",
          recruiterRequestedAt: expect.any(Date),
          role: "candidate",
        },
        { upsert: true, new: true }
      );
    });

    it("ensures a candidate with a pending recruiter application cannot execute recruiter-only actions", async () => {
      // Pending recruiter application rejects via requireRecruiter
      vi.spyOn(authLib, "requireRecruiter").mockRejectedValue(
        new Error("Forbidden: Recruiter access required.")
      );

      const formData = new FormData();
      formData.append("title", "Unauthorized Job");
      formData.append("description", "<p>Not allowed</p>");
      formData.append("companyName", "Pending Corp");
      formData.append("location", "Remote");
      formData.append("salary", "100000");
      formData.append("jobType", "Full-time");

      // createJob must reject
      await expect(createJob(formData)).rejects.toThrow("Forbidden: Recruiter access required.");

      // deleteJob must reject
      await expect(deleteJob("some-job-id")).rejects.toThrow("Forbidden: Recruiter access required.");
    });

    it("rejects unauthorized non-admin from approving a recruiter application via adminApproveRecruiter", async () => {
      vi.spyOn(authLib, "requireAdmin").mockRejectedValue(
        new Error("Forbidden: Admin access required.")
      );

      await expect(adminApproveRecruiter("candidate_123")).rejects.toThrow(
        "Forbidden: Admin access required."
      );
    });

    it("rejects unauthorized non-admin from rejecting a recruiter application via adminRejectRecruiter", async () => {
      vi.spyOn(authLib, "requireAdmin").mockRejectedValue(
        new Error("Forbidden: Admin access required.")
      );

      await expect(adminRejectRecruiter("candidate_123", "Invalid company")).rejects.toThrow(
        "Forbidden: Admin access required."
      );
    });

    it("allows authorized administrator to approve a recruiter application and grant recruiter role", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue({
        userId: "admin_user",
        email: "admin@platform.com",
      });

      vi.spyOn(User, "findOne").mockResolvedValue({
        clerkId: "candidate_123",
        email: "candidate@company.com",
        companyName: "Acme",
      } as never);

      const userUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      const result = await adminApproveRecruiter("candidate_123");
      expect(result.success).toBe(true);

      expect(userUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "candidate_123" },
        {
          role: "recruiter",
          recruiterStatus: "approved",
          recruiterReviewedAt: expect.any(Date),
          recruiterReviewedBy: "admin@platform.com",
        }
      );
    });

    it("allows authorized administrator to reject a recruiter application", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue({
        userId: "admin_user",
        email: "admin@platform.com",
      });

      vi.spyOn(User, "findOne").mockResolvedValue({
        clerkId: "candidate_123",
        email: "candidate@company.com",
        companyName: "Acme",
        recruiterReason: "Old reason",
      } as never);

      const userUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      const result = await adminRejectRecruiter("candidate_123", "Invalid documentation provided");
      expect(result.success).toBe(true);

      expect(userUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "candidate_123" },
        {
          role: "candidate",
          recruiterStatus: "rejected",
          recruiterReason: "Invalid documentation provided",
          recruiterReviewedAt: expect.any(Date),
          recruiterReviewedBy: "admin@platform.com",
        }
      );
    });

    it("adminUpdateUserRole rejects unauthorized non-admin callers", async () => {
      vi.spyOn(authLib, "requireAdmin").mockRejectedValue(
        new Error("Forbidden: Admin access required.")
      );

      await expect(adminUpdateUserRole("user_456", "recruiter")).rejects.toThrow(
        "Forbidden: Admin access required."
      );
    });

    it("adminUpdateUserRole executes role update when called by authorized admin", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue({
        userId: "admin_user",
        email: "admin@platform.com",
      });

      const userUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      const result = await adminUpdateUserRole("user_456", "recruiter");
      expect(result.success).toBe(true);
      expect(userUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "user_456" },
        {
          role: "recruiter",
          recruiterStatus: "approved",
          recruiterReviewedAt: expect.any(Date),
          recruiterReviewedBy: "admin@platform.com",
        }
      );
    });
  });
});

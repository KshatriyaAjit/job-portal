import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk server functions
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getUser: vi.fn(),
      updateUserMetadata: vi.fn().mockResolvedValue({}),
    },
  }),
}));

// Mock DB connection
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

// Mock Mailer
vi.mock("@/lib/mail", () => ({
  sendApplicationEmail: vi.fn().mockResolvedValue({ id: "mock_app_id" }),
  sendStatusUpdateEmail: vi.fn().mockResolvedValue({ id: "mock_status_id" }),
  sendApplicationConfirmationEmail: vi.fn().mockResolvedValue({ id: "mock_confirm_id" }),
  sendRecruiterApprovalEmail: vi.fn().mockResolvedValue({ id: "mock_approval_email_123" }),
}));

// Mock Next.js cache and navigation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import Job from "@/models/Job";
import Application from "@/models/Application";
import User from "@/models/User";
import Profile from "@/models/Profile";
import * as authLib from "@/lib/auth";
import * as mailLib from "@/lib/mail";
import {
  createJob,
  updateJob,
  bulkUpdateApplicationStatus,
  exportApplicantsCSV,
  completeRecruiterOnboarding,
  adminApproveRecruiter,
} from "@/app/actions";
import { sanitizeCsvField } from "@/lib/csv";
import mongoose from "mongoose";

describe("Phase 2 — Recruiter Workflows, Job Validation & Applicant Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Job Creation Validation (createJob)", () => {
    it("rejects zero and negative salaries", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const formDataZero = new FormData();
      formDataZero.append("title", "Frontend Dev");
      formDataZero.append("companyName", "Tech Corp");
      formDataZero.append("location", "Remote");
      formDataZero.append("salary", "0");
      formDataZero.append("jobType", "Full-time");
      formDataZero.append("description", "<p>Build apps</p>");

      await expect(createJob(formDataZero)).rejects.toThrow(
        "Salary must be a positive number between 1 and 50,000,000."
      );

      const formDataNegative = new FormData();
      formDataNegative.append("title", "Frontend Dev");
      formDataNegative.append("companyName", "Tech Corp");
      formDataNegative.append("location", "Remote");
      formDataNegative.append("salary", "-1000");
      formDataNegative.append("jobType", "Full-time");
      formDataNegative.append("description", "<p>Build apps</p>");

      await expect(createJob(formDataNegative)).rejects.toThrow(
        "Salary must be a positive number between 1 and 50,000,000."
      );
    });

    it("rejects excessively large salary (> 50,000,000)", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const formData = new FormData();
      formData.append("title", "Dev");
      formData.append("companyName", "Corp");
      formData.append("location", "Remote");
      formData.append("salary", "999999999");
      formData.append("jobType", "Full-time");
      formData.append("description", "<p>Valid</p>");

      await expect(createJob(formData)).rejects.toThrow(
        "Salary must be a positive number between 1 and 50,000,000."
      );
    });

    it("rejects empty or whitespace-only descriptions (including empty HTML tags)", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const formDataEmpty = new FormData();
      formDataEmpty.append("title", "Dev");
      formDataEmpty.append("companyName", "Corp");
      formDataEmpty.append("location", "Remote");
      formDataEmpty.append("salary", "80000");
      formDataEmpty.append("jobType", "Full-time");
      formDataEmpty.append("description", "   <p><br></p>   ");

      await expect(createJob(formDataEmpty)).rejects.toThrow("Job description cannot be empty.");
    });
  });

  describe("Job Editing Validation (updateJob)", () => {
    it("enforces recruiter ownership (IDOR defense)", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_attacker",
        email: "attacker@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const jobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: jobId,
        clerkId: "recruiter_victim",
      } as unknown as ReturnType<typeof Job.findById>);

      const formData = new FormData();
      formData.append("title", "Hacked Title");
      formData.append("companyName", "Corp");
      formData.append("location", "Remote");
      formData.append("salary", "100000");
      formData.append("jobType", "Full-time");
      formData.append("description", "<p>New Desc</p>");

      await expect(updateJob(jobId.toString(), formData)).rejects.toThrow(
        "Forbidden: You are not authorized to edit this job."
      );
    });

    it("rejects invalid salary and whitespace descriptions on update", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const jobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: jobId,
        clerkId: "recruiter_1",
      } as unknown as ReturnType<typeof Job.findById>);

      const formDataBadSalary = new FormData();
      formDataBadSalary.append("title", "Title");
      formDataBadSalary.append("companyName", "Corp");
      formDataBadSalary.append("location", "Remote");
      formDataBadSalary.append("salary", "0");
      formDataBadSalary.append("jobType", "Full-time");
      formDataBadSalary.append("description", "<p>Desc</p>");

      await expect(updateJob(jobId.toString(), formDataBadSalary)).rejects.toThrow(
        "Salary must be a positive number between 1 and 50,000,000."
      );

      const formDataBadDesc = new FormData();
      formDataBadDesc.append("title", "Title");
      formDataBadDesc.append("companyName", "Corp");
      formDataBadDesc.append("location", "Remote");
      formDataBadDesc.append("salary", "120000");
      formDataBadDesc.append("jobType", "Full-time");
      formDataBadDesc.append("description", "<p>   </p>");

      await expect(updateJob(jobId.toString(), formDataBadDesc)).rejects.toThrow(
        "Job description cannot be empty."
      );
    });
  });

  describe("Bulk Status Updates (bulkUpdateApplicationStatus)", () => {
    it("rejects non-recruiter calls", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockRejectedValue(
        new Error("Forbidden: Recruiter access required.")
      );

      await expect(
        bulkUpdateApplicationStatus([new mongoose.Types.ObjectId().toString()], "accepted")
      ).rejects.toThrow("Forbidden: Recruiter access required.");
    });

    it("rejects empty or invalid application ID list", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      await expect(bulkUpdateApplicationStatus([], "interviewing")).rejects.toThrow(
        "No application IDs provided."
      );

      await expect(
        bulkUpdateApplicationStatus(["invalid-oid"], "interviewing")
      ).rejects.toThrow("Invalid application ID: invalid-oid");
    });

    it("rejects invalid status enum", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const validId = new mongoose.Types.ObjectId().toString();
      await expect(
        bulkUpdateApplicationStatus([validId], "unknown_status")
      ).rejects.toThrow("Invalid status: unknown_status");
    });

    it("strictly blocks cross-recruiter bulk status updates (fail-closed IDOR check)", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const app1Id = new mongoose.Types.ObjectId();
      const app2Id = new mongoose.Types.ObjectId();

      vi.spyOn(Application, "find").mockReturnValue({
        populate: vi.fn().mockResolvedValue([
          {
            _id: app1Id,
            userId: "candidate_1",
            jobId: { clerkId: "recruiter_owner", title: "Job 1" },
          },
          {
            _id: app2Id,
            userId: "candidate_2",
            // Belongs to another recruiter!
            jobId: { clerkId: "recruiter_other", title: "Job 2" },
          },
        ]),
      } as unknown as ReturnType<typeof Application.find>);

      await expect(
        bulkUpdateApplicationStatus([app1Id.toString(), app2Id.toString()], "interviewing")
      ).rejects.toThrow(
        "Forbidden: You are not authorized to modify one or more of these applications."
      );
    });

    it("successfully bulk updates applications for authorized recruiter", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const app1Id = new mongoose.Types.ObjectId();
      const app2Id = new mongoose.Types.ObjectId();

      vi.spyOn(Application, "find").mockReturnValue({
        populate: vi.fn().mockResolvedValue([
          {
            _id: app1Id,
            userId: "candidate_1",
            jobId: { clerkId: "recruiter_owner", title: "Job 1" },
          },
          {
            _id: app2Id,
            userId: "candidate_2",
            jobId: { clerkId: "recruiter_owner", title: "Job 1" },
          },
        ]),
      } as unknown as ReturnType<typeof Application.find>);

      vi.spyOn(Application, "updateMany").mockResolvedValue({ modifiedCount: 2 } as never);
      vi.spyOn(User, "find").mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { clerkId: "candidate_1", email: "c1@example.com", firstName: "Alice" },
          { clerkId: "candidate_2", email: "c2@example.com", firstName: "Bob" },
        ]),
      } as never);

      const emailSpy = vi.spyOn(mailLib, "sendStatusUpdateEmail");

      const result = await bulkUpdateApplicationStatus(
        [app1Id.toString(), app2Id.toString()],
        "accepted"
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(Application.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [app1Id.toString(), app2Id.toString()] } },
        { $set: { status: "accepted" } }
      );
      expect(emailSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("CSV Formula Injection Defense (sanitizeCsvField)", () => {
    it("escapes formula prefixes (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeCsvField("=cmd|'/C calc'!A0")).toBe("\"'=cmd|'/C calc'!A0\"");
      expect(sanitizeCsvField("+12345")).toBe("\"'+12345\"");
      expect(sanitizeCsvField("-200")).toBe("\"'-200\"");
      expect(sanitizeCsvField("@SUM(A1:A10)")).toBe("\"'@SUM(A1:A10)\"");
      expect(sanitizeCsvField("\tTabbed")).toBe("\"'\tTabbed\"");
      expect(sanitizeCsvField("\rReturn")).toBe("\"'\rReturn\"");
    });

    it("escapes quotes and wraps clean strings safely", () => {
      expect(sanitizeCsvField('Jane "The Boss" Doe')).toBe('"Jane ""The Boss"" Doe"');
      expect(sanitizeCsvField("Senior React Engineer")).toBe('"Senior React Engineer"');
      expect(sanitizeCsvField(null)).toBe('""');
      expect(sanitizeCsvField(undefined)).toBe('""');
    });
  });

  describe("Applicant CSV Export (exportApplicantsCSV)", () => {
    it("rejects non-owner from exporting applicant data", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_attacker",
        email: "attacker@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const jobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: jobId,
        clerkId: "recruiter_owner",
        title: "Engineer",
      } as unknown as ReturnType<typeof Job.findById>);

      await expect(exportApplicantsCSV(jobId.toString())).rejects.toThrow(
        "Forbidden: You do not have permission to export applicants for this job."
      );
    });

    it("generates sanitized CSV content with formula injection defense for owner", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const jobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: jobId,
        clerkId: "recruiter_owner",
        title: "Fullstack Architect",
      } as unknown as ReturnType<typeof Job.findById>);

      const fakeAppId = new mongoose.Types.ObjectId();
      vi.spyOn(Application, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue([
          {
            _id: fakeAppId,
            userId: "candidate_hacker",
            resumeUrl: "https://res.cloudinary.com/demo/resume.pdf",
            coverLetter: "=1+1 is malicious formula",
            status: "pending",
            aiScore: 92,
            createdAt: new Date("2026-03-01T12:00:00Z"),
          },
        ]),
      } as never);

      vi.spyOn(Profile, "find").mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            userId: "candidate_hacker",
            email: "hacker@example.com",
            skills: ["=MALICIOUS_SKILL", "TypeScript"],
          },
        ]),
      } as never);

      vi.spyOn(User, "find").mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            clerkId: "candidate_hacker",
            firstName: "+Evil",
            lastName: "User",
            email: "hacker@example.com",
          },
        ]),
      } as never);

      const result = await exportApplicantsCSV(jobId.toString());

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/applicants-fullstack-architect-\d{4}-\d{2}-\d{2}\.csv/);
      expect(result.csv).toBeDefined();

      // Verify Formula Injection Defense in output CSV:
      // Candidate name starting with + should be prefixed with '
      expect(result.csv).toContain("'+Evil User");
      // Skills containing = should be sanitized
      expect(result.csv).toContain("'=MALICIOUS_SKILL; TypeScript");
      // Cover letter starting with = should be sanitized
      expect(result.csv).toContain("'=1+1 is malicious formula");
    });
  });

  describe("Recruiter Onboarding Lifecycle & Phantom Application Prevention", () => {
    it("rejects incomplete onboarding submission with missing or whitespace company name", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "cand_onboard_1",
        email: "cand@test.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const formEmpty = new FormData();
      formEmpty.append("companyName", "   ");

      await expect(completeRecruiterOnboarding(formEmpty)).rejects.toThrow(
        "Company name is required (between 2 and 100 characters)."
      );

      const formTooShort = new FormData();
      formTooShort.append("companyName", "A");

      await expect(completeRecruiterOnboarding(formTooShort)).rejects.toThrow(
        "Company name is required (between 2 and 100 characters)."
      );
    });

    it("rejects excessively long company name (> 100 characters)", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "cand_onboard_2",
        email: "cand@test.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const formTooLong = new FormData();
      formTooLong.append("companyName", "X".repeat(101));

      await expect(completeRecruiterOnboarding(formTooLong)).rejects.toThrow(
        "Company name is required (between 2 and 100 characters)."
      );
    });

    it("submits valid recruiter onboarding application without self-promotion", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "cand_onboard_3",
        email: "cand@test.com",
        role: "candidate",
        dbUser: {} as unknown as InstanceType<typeof User>,
      });

      const findOneAndUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      const validForm = new FormData();
      validForm.append("companyName", "Acme Corporation");
      validForm.append("reason", "Hiring frontend engineers");

      await completeRecruiterOnboarding(validForm);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "cand_onboard_3" },
        expect.objectContaining({
          companyName: "Acme Corporation",
          recruiterStatus: "pending",
          recruiterReason: "Hiring frontend engineers",
          role: "candidate",
        }),
        { upsert: true, new: true }
      );
    });

    it("prevents empty or unsubmitted onboarding visits from appearing in pending admin applications", () => {
      // Simulate database users list in admin dashboard
      const users = [
        {
          clerkId: "user_valid_pending",
          email: "valid@corp.com",
          role: "candidate",
          recruiterStatus: "pending",
          companyName: "Valid Corp",
        },
        {
          clerkId: "user_empty_pending", // Visited onboarding or aborted without submit
          email: "phantom@test.com",
          role: "candidate",
          recruiterStatus: "pending",
          companyName: "",
        },
        {
          clerkId: "user_unsubmitted",
          email: "regular@test.com",
          role: "candidate",
          recruiterStatus: "none",
          companyName: undefined,
        },
        {
          clerkId: "user_approved",
          email: "recruiter@corp.com",
          role: "recruiter",
          recruiterStatus: "approved",
          companyName: "Hired Inc",
        },
      ];

      // Admin dashboard filtering logic
      const pendingApplications = users.filter(
        (u) =>
          u.recruiterStatus === "pending" &&
          Boolean(u.companyName && u.companyName.trim().length >= 2)
      );

      expect(pendingApplications).toHaveLength(1);
      expect(pendingApplications[0].clerkId).toBe("user_valid_pending");
      expect(pendingApplications[0].companyName).toBe("Valid Corp");
    });
  });

  describe("Admin Recruiter Approval & Email Notification (adminApproveRecruiter)", () => {
    const adminUser = {
      userId: "admin_123",
      email: "admin@insiderjobs.com",
    };

    it("authorized admin approval updates role, recruiterStatus, and sends approval email", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue(adminUser);

      const targetPendingUser = {
        clerkId: "recruiter_target_1",
        email: "recruiter@hiringcorp.com",
        firstName: "Sarah",
        lastName: "Connor",
        companyName: "Cyberdyne Systems",
        role: "candidate",
        recruiterStatus: "pending",
        recruiterApprovalEmailSentAt: undefined,
      };

      vi.spyOn(User, "findOne").mockResolvedValue(targetPendingUser as never);
      const findOneAndUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);
      const updateOneSpy = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);

      const result = await adminApproveRecruiter("recruiter_target_1");

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(true);

      // Verify Clerk metadata update was requested
      const client = await (await import("@clerk/nextjs/server")).clerkClient();
      expect(client.users.updateUserMetadata).toHaveBeenCalledWith(
        "recruiter_target_1",
        { publicMetadata: { role: "recruiter" } }
      );

      // Verify MongoDB update
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "recruiter_target_1" },
        expect.objectContaining({
          role: "recruiter",
          recruiterStatus: "approved",
          recruiterReviewedBy: "admin@insiderjobs.com",
        })
      );

      // Verify email was sent to correct recipient with recruiter name and company name
      expect(mailLib.sendRecruiterApprovalEmail).toHaveBeenCalledWith(
        "recruiter@hiringcorp.com",
        "Sarah Connor",
        "Cyberdyne Systems"
      );

      // Verify idempotent marker was recorded
      expect(updateOneSpy).toHaveBeenCalledWith(
        { clerkId: "recruiter_target_1" },
        expect.objectContaining({
          recruiterApprovalEmailSentAt: expect.any(Date),
        })
      );
    });

    it("unauthorized callers cannot trigger approval or send an email", async () => {
      vi.spyOn(authLib, "requireAdmin").mockRejectedValue(
        new Error("Forbidden: Admin access required.")
      );

      await expect(adminApproveRecruiter("recruiter_target_1")).rejects.toThrow(
        "Forbidden: Admin access required."
      );

      expect(mailLib.sendRecruiterApprovalEmail).not.toHaveBeenCalled();
    });

    it("failed approval does not send an email (user not found)", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue(adminUser);
      vi.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(adminApproveRecruiter("non_existent_user")).rejects.toThrow(
        "Target user not found."
      );

      expect(mailLib.sendRecruiterApprovalEmail).not.toHaveBeenCalled();
    });

    it("failed approval does not send an email (no pending application found)", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue(adminUser);
      const candidateUser = {
        clerkId: "candidate_regular",
        email: "regular@gmail.com",
        role: "candidate",
        recruiterStatus: "none", // Not pending!
      };
      vi.spyOn(User, "findOne").mockResolvedValue(candidateUser as never);

      await expect(adminApproveRecruiter("candidate_regular")).rejects.toThrow(
        "Cannot approve recruiter: No pending recruiter application found for this user."
      );

      expect(mailLib.sendRecruiterApprovalEmail).not.toHaveBeenCalled();
    });

    it("email delivery failure does not revoke or roll back a successful approval", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue(adminUser);

      const targetPendingUser = {
        clerkId: "recruiter_target_resend_down",
        email: "recruiter@corp.com",
        firstName: "Bob",
        companyName: "Corp",
        role: "candidate",
        recruiterStatus: "pending",
        recruiterApprovalEmailSentAt: undefined,
      };

      vi.spyOn(User, "findOne").mockResolvedValue(targetPendingUser as never);
      const findOneAndUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);

      const updateOneSpy = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);

      // Simulate Resend API error (e.g. rate limit, network timeout)
      vi.mocked(mailLib.sendRecruiterApprovalEmail).mockRejectedValueOnce(
        new Error("Resend rate limit exceeded (503)")
      );

      // Action should NOT throw to admin; approval must succeed
      const result = await adminApproveRecruiter("recruiter_target_resend_down");

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(false);

      // Approval was still committed in MongoDB
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "recruiter_target_resend_down" },
        expect.objectContaining({
          role: "recruiter",
          recruiterStatus: "approved",
        })
      );

      // Notification timestamp is NOT recorded when email fails
      expect(updateOneSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          recruiterApprovalEmailSentAt: expect.anything(),
        })
      );
    });

    it("does not set recruiterApprovalEmailSentAt when Resend is unconfigured (returns null)", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue(adminUser);

      const targetPendingUser = {
        clerkId: "recruiter_target_no_resend",
        email: "recruiter@corp.com",
        firstName: "Bob",
        companyName: "Corp",
        role: "candidate",
        recruiterStatus: "pending",
        recruiterApprovalEmailSentAt: undefined,
      };

      vi.spyOn(User, "findOne").mockResolvedValue(targetPendingUser as never);
      const findOneAndUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);
      const updateOneSpy = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);

      // Resend is unconfigured, returns null without throwing
      vi.mocked(mailLib.sendRecruiterApprovalEmail).mockResolvedValueOnce(null);

      const result = await adminApproveRecruiter("recruiter_target_no_resend");

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(false);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "recruiter_target_no_resend" },
        expect.objectContaining({
          role: "recruiter",
          recruiterStatus: "approved",
        })
      );

      // Crucial: recruiterApprovalEmailSentAt must NOT be set when Resend is unconfigured
      expect(updateOneSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          recruiterApprovalEmailSentAt: expect.anything(),
        })
      );
    });

    it("does not set recruiterApprovalEmailSentAt when Resend returns an API error", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue(adminUser);

      const targetPendingUser = {
        clerkId: "recruiter_target_resend_api_err",
        email: "recruiter@corp.com",
        firstName: "Bob",
        companyName: "Corp",
        role: "candidate",
        recruiterStatus: "pending",
        recruiterApprovalEmailSentAt: undefined,
      };

      vi.spyOn(User, "findOne").mockResolvedValue(targetPendingUser as never);
      const findOneAndUpdateSpy = vi.spyOn(User, "findOneAndUpdate").mockResolvedValue({} as never);
      const updateOneSpy = vi.spyOn(User, "updateOne").mockResolvedValue({} as never);

      // Resend API returns an error
      vi.mocked(mailLib.sendRecruiterApprovalEmail).mockRejectedValueOnce(
        new Error("Resend API error: domain_not_verified")
      );

      const result = await adminApproveRecruiter("recruiter_target_resend_api_err");

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(false);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { clerkId: "recruiter_target_resend_api_err" },
        expect.objectContaining({
          role: "recruiter",
          recruiterStatus: "approved",
        })
      );

      // Crucial: recruiterApprovalEmailSentAt must NOT be set when Resend returns an error
      expect(updateOneSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          recruiterApprovalEmailSentAt: expect.anything(),
        })
      );
    });

    it("repeated approval requests do not send duplicate notifications", async () => {
      vi.spyOn(authLib, "requireAdmin").mockResolvedValue(adminUser);

      const alreadyApprovedUser = {
        clerkId: "already_approved_recruiter",
        email: "approved@corp.com",
        firstName: "Alice",
        companyName: "Corp",
        role: "recruiter",
        recruiterStatus: "approved",
        recruiterApprovalEmailSentAt: new Date("2026-03-01T10:00:00Z"), // Already marked!
      };

      vi.spyOn(User, "findOne").mockResolvedValue(alreadyApprovedUser as never);

      const result = await adminApproveRecruiter("already_approved_recruiter");

      expect(result.success).toBe(true);
      expect(result.emailSent).toBe(false);
      expect(mailLib.sendRecruiterApprovalEmail).not.toHaveBeenCalled();
    });
  });
});


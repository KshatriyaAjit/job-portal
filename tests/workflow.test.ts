import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Clerk server functions
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getUser: vi.fn().mockResolvedValue({
        id: "candidate_clerk_id",
        firstName: "Alice",
        lastName: "Smith",
        emailAddresses: [{ emailAddress: "alice@example.com" }],
      }),
    },
  }),
}));

// Mock DB connection
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

// Mock Mailer
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

// Mock Gemini Generative AI
const mockGenerateContent = vi.fn();
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      interactions: {
        create: vi.fn().mockImplementation(async () => {
          const res = await mockGenerateContent();
          return {
            output_text:
              typeof res?.response?.text === "function"
                ? res.response.text()
                : String(res?.text || ""),
          };
        }),
      },
      models: {
        generateContent: mockGenerateContent,
      },
    })),
  };
});

import Job from "@/models/Job";
import Application from "@/models/Application";
import User from "@/models/User";
import Profile from "@/models/Profile";
import * as authLib from "@/lib/auth";
import * as mailLib from "@/lib/mail";
import {
  createJob,
  updateJob,
  deleteJob,
  submitApplication,
  updateApplicationStatus,
  bulkUpdateApplicationStatus,
  saveProfile,
  exportApplicantsCSV,
} from "@/app/actions";
import { generateAIScore } from "@/app/actions/ai";
import { normalizeJobSearchParams, buildSearchPath } from "@/lib/search-params";
import mongoose from "mongoose";

describe("Phase 3.1 — End-to-End Candidate to Recruiter Workflow & Negative Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  describe("Complete Golden Path Lifecycle", () => {
    it("executes the full lifecycle: profile -> search -> apply -> ai evaluation -> cache -> invalidation -> status update", async () => {
      // 1. Candidate completes profile
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_alice",
        email: "alice@example.com",
        role: "candidate",
        dbUser: {} as never,
      });

      const profileUpdateSpy = vi.spyOn(Profile, "findOneAndUpdate").mockResolvedValue({} as never);
      const appInvalidateSpy = vi.spyOn(Application, "updateMany").mockResolvedValue({} as never);

      const profileFormData = new FormData();
      profileFormData.append("email", "alice@example.com");
      profileFormData.append("bio", "Senior Fullstack Engineer with 6 years experience in React and Node.");
      profileFormData.append("skills", "React, TypeScript, Next.js, Node.js");
      profileFormData.append("linkedin", "https://linkedin.com/in/alice");
      profileFormData.append("resumeUrl", "https://res.cloudinary.com/demo/image/upload/v1/alice_resume.pdf");

      const profileResult = await saveProfile(profileFormData);
      expect(profileResult.success).toBe(true);
      expect(profileUpdateSpy).toHaveBeenCalled();
      expect(appInvalidateSpy).toHaveBeenCalledWith(
        { userId: "candidate_alice" },
        { $unset: { aiScore: 1, aiAnalysis: 1 } }
      );

      // 2. Candidate searches and filters jobs
      const normalizedParams = normalizeJobSearchParams({
        query: "React",
        location: "Remote",
        type: "Full-time,Contract",
        minSalary: "100000",
        sort: "salary_high",
        page: "2",
      });
      expect(normalizedParams).toEqual({
        query: "React",
        location: "Remote",
        type: ["Full-time", "Contract"],
        minSalary: 100000,
        sort: "salary_high",
        page: 2,
      });

      const nextPath = buildSearchPath("/", { query: "React" }, { page: "3" });
      expect(nextPath).toBe("/?query=React&page=3");

      // 3. Candidate submits application
      const fakeJobId = new mongoose.Types.ObjectId();
      const fakeAppId = new mongoose.Types.ObjectId();

      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: fakeJobId,
        clerkId: "recruiter_bob",
        title: "Senior React Engineer",
        companyName: "Acme Tech",
        description: "<p>We are seeking a Senior React Engineer with Next.js expertise.</p>",
      } as never);

      vi.spyOn(Application, "findOne").mockResolvedValue(null);
      vi.spyOn(Application, "create").mockResolvedValue({
        _id: fakeAppId,
        jobId: fakeJobId,
        userId: "candidate_alice",
        resumeUrl: "https://res.cloudinary.com/demo/image/upload/v1/alice_resume.pdf",
        status: "pending",
      } as never);

      vi.spyOn(User, "findOne").mockImplementation(((query: Record<string, unknown>) => {
        if (query?.clerkId === "candidate_alice") {
          return Promise.resolve({
            clerkId: "candidate_alice",
            email: "alice@example.com",
            firstName: "Alice",
          } as never);
        }
        if (query?.clerkId === "recruiter_bob") {
          return Promise.resolve({
            clerkId: "recruiter_bob",
            email: "bob@acme.com",
            firstName: "Bob",
          } as never);
        }
        return Promise.resolve(null);
      }) as never);

      const appResult = await submitApplication(
        fakeJobId.toString(),
        "https://res.cloudinary.com/demo/image/upload/v1/alice_resume.pdf",
        "Excited to apply!"
      );
      expect(appResult.success).toBe(true);
      expect(mailLib.sendApplicationEmail).toHaveBeenCalledWith(
        "bob@acme.com",
        expect.any(String),
        "Senior React Engineer",
        "https://res.cloudinary.com/demo/image/upload/v1/alice_resume.pdf"
      );
      expect(mailLib.sendApplicationConfirmationEmail).toHaveBeenCalledWith(
        "alice@example.com",
        expect.any(String),
        "Senior React Engineer",
        "Acme Tech"
      );

      // 4. Duplicate application is rejected gracefully
      vi.spyOn(Application, "findOne").mockResolvedValue({ _id: fakeAppId } as never);
      const dupResult = await submitApplication(
        fakeJobId.toString(),
        "https://res.cloudinary.com/demo/image/upload/v1/alice_resume.pdf"
      );
      expect(dupResult.success).toBe(false);
      expect(dupResult.alreadyApplied).toBe(true);

      // 5. Recruiter logs in and generates AI evaluation
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_bob",
        email: "bob@acme.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appDoc = {
        _id: fakeAppId,
        userId: "candidate_alice",
        coverLetter: "Excited to apply!",
        status: "pending",
        jobId: {
          _id: fakeJobId,
          clerkId: "recruiter_bob",
          title: "Senior React Engineer",
          description: "We are seeking a Senior React Engineer with Next.js expertise.",
          updatedAt: new Date("2026-03-01T10:00:00Z"),
        },
        aiScore: undefined as number | undefined,
        aiAnalysis: undefined as unknown,
        save: vi.fn(),
      };

      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue(appDoc),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          userId: "candidate_alice",
          bio: "Senior Fullstack Engineer with 6 years experience.",
          skills: ["React", "TypeScript", "Next.js"],
        }),
      } as never);

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              overallScore: 92,
              skillAlignment: { score: 95, matchedSkills: ["React", "Next.js"], missingSkills: [] },
              experienceAlignment: { score: 90, assessment: "Strong 6-year background." },
              qualificationsAlignment: { score: 90, assessment: "High role fit." },
              keyStrengths: ["Extensive frontend depth"],
              recommendations: "Schedule technical screen.",
              summary: "Excellent candidate fit at 92%.",
            }),
        },
      });

      const aiEvalResult = await generateAIScore(fakeAppId.toString());
      expect(aiEvalResult.score).toBe(92);
      expect(aiEvalResult.cached).toBe(false);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);

      // 6. Recruiter accesses applicant again -> cached evaluation is returned without hitting Gemini API
      appDoc.aiScore = 92;
      appDoc.aiAnalysis = {
        overallScore: 92,
        summary: "Excellent candidate fit at 92%.",
        evaluatedAt: new Date("2026-03-01T11:00:00Z"),
      };

      mockGenerateContent.mockClear();
      const cachedEvalResult = await generateAIScore(fakeAppId.toString());
      expect(cachedEvalResult.score).toBe(92);
      expect(cachedEvalResult.cached).toBe(true);
      expect(mockGenerateContent).not.toHaveBeenCalled();

      // 7. Job is updated by recruiter -> stale evaluations are invalidated
      const jobUpdateSpy = vi.spyOn(Job, "findByIdAndUpdate").mockResolvedValue({} as never);
      const editFormData = new FormData();
      editFormData.append("title", "Lead React Architect");
      editFormData.append("companyName", "Acme Tech");
      editFormData.append("location", "Remote");
      editFormData.append("salary", "160000");
      editFormData.append("jobType", "Full-time");
      editFormData.append("category", "Engineering");
      editFormData.append("description", "<p>Updated requirements for Lead Architect</p>");

      await updateJob(fakeJobId.toString(), editFormData);
      expect(jobUpdateSpy).toHaveBeenCalled();
      expect(appInvalidateSpy).toHaveBeenCalledWith(
        { jobId: fakeJobId.toString() },
        { $unset: { aiScore: 1, aiAnalysis: 1 } }
      );

      // 8. Recruiter updates application status to "interviewing"
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "recruiter_bob",
        email: "bob@acme.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: fakeAppId,
          userId: "candidate_alice",
          status: "pending",
          jobId: { clerkId: "recruiter_bob", title: "Lead React Architect" },
          save: vi.fn().mockResolvedValue(true),
        }),
      } as never);

      const statusResult = await updateApplicationStatus(fakeAppId.toString(), "interviewing");
      expect(statusResult.success).toBe(true);
      expect(mailLib.sendStatusUpdateEmail).toHaveBeenCalledWith(
        "alice@example.com",
        expect.any(String),
        "Lead React Architect",
        "interviewing"
      );
    });
  });

  describe("Negative & Edge Case Security Scenarios", () => {
    it("blocks unauthenticated users from applying to jobs", async () => {
      vi.spyOn(authLib, "requireAuth").mockRejectedValue(new Error("Unauthorized: Please sign in."));

      await expect(
        submitApplication("507f1f77bcf86cd799439011", "https://res.cloudinary.com/demo/resume.pdf")
      ).rejects.toThrow("Unauthorized: Please sign in.");
    });

    it("blocks candidate role from creating, updating, or deleting jobs", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockRejectedValue(
        new Error("Forbidden: Recruiter access required.")
      );

      const formData = new FormData();
      formData.append("title", "Hacker Dev");
      formData.append("companyName", "Fake");
      formData.append("location", "Remote");
      formData.append("salary", "100000");
      formData.append("jobType", "Full-time");
      formData.append("description", "<p>Content</p>");

      await expect(createJob(formData)).rejects.toThrow("Forbidden: Recruiter access required.");
      await expect(updateJob("507f1f77bcf86cd799439011", formData)).rejects.toThrow("Forbidden: Recruiter access required.");
      await expect(deleteJob("507f1f77bcf86cd799439011")).rejects.toThrow("Forbidden: Recruiter access required.");
    });

    it("blocks recruiters from applying to jobs", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "recruiter_bob",
        email: "bob@acme.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      await expect(
        submitApplication("507f1f77bcf86cd799439011", "https://res.cloudinary.com/demo/resume.pdf")
      ).rejects.toThrow("Recruiters cannot submit job applications.");
    });

    it("blocks cross-recruiter IDOR on status updates and AI scoring", async () => {
      // Authenticated as Recruiter Attacker
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "attacker_recruiter",
        email: "attacker@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "attacker_recruiter",
        email: "attacker@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const fakeAppId = new mongoose.Types.ObjectId();
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: fakeAppId,
          userId: "candidate_1",
          jobId: { clerkId: "victim_recruiter", title: "Target Job" }, // OWNED BY SOMEONE ELSE
        }),
      } as never);

      await expect(
        updateApplicationStatus(fakeAppId.toString(), "accepted")
      ).rejects.toThrow("Forbidden: You do not have permission to modify applications for this job.");

      await expect(
        generateAIScore(fakeAppId.toString())
      ).rejects.toThrow("Forbidden: You are not authorized to score candidates for this job.");
    });

    it("rejects bulk status updates containing mixed-ownership application batches", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_me",
        email: "me@company.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const myApp = new mongoose.Types.ObjectId();
      const otherApp = new mongoose.Types.ObjectId();

      vi.spyOn(Application, "find").mockReturnValue({
        populate: vi.fn().mockResolvedValue([
          { _id: myApp, jobId: { clerkId: "recruiter_me" } },
          { _id: otherApp, jobId: { clerkId: "other_recruiter" } },
        ]),
      } as never);

      await expect(
        bulkUpdateApplicationStatus([myApp.toString(), otherApp.toString()], "rejected")
      ).rejects.toThrow(
        "Forbidden: You are not authorized to modify one or more of these applications."
      );
    });

    it("blocks unauthorized CSV export across recruiters", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "attacker_recruiter",
        email: "attacker@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const victimJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: victimJobId,
        clerkId: "victim_recruiter",
      } as never);

      await expect(exportApplicantsCSV(victimJobId.toString())).rejects.toThrow(
        "Forbidden: You do not have permission to export applicants for this job."
      );
    });

    it("safely handles concurrent duplicate application submissions via E11000 duplicate key error", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "c1@example.com",
        role: "candidate",
        dbUser: {} as never,
      });

      const fakeJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: fakeJobId,
        clerkId: "recruiter_1",
        title: "Engineer",
      } as never);

      vi.spyOn(Application, "findOne").mockResolvedValue(null);

      const mongoDupError = new Error("E11000 duplicate key error collection");
      (mongoDupError as unknown as { code: number }).code = 11000;
      vi.spyOn(Application, "create").mockRejectedValue(mongoDupError);

      const result = await submitApplication(
        fakeJobId.toString(),
        "https://res.cloudinary.com/demo/image/upload/v1/resume.pdf"
      );

      expect(result.success).toBe(false);
      expect(result.alreadyApplied).toBe(true);
    });

    it("handles email notification delivery failure without rolling back application submission", async () => {
      vi.spyOn(authLib, "requireAuth").mockResolvedValue({
        userId: "candidate_1",
        email: "c1@example.com",
        role: "candidate",
        dbUser: {} as never,
      });

      const fakeJobId = new mongoose.Types.ObjectId();
      vi.spyOn(Job, "findById").mockResolvedValue({
        _id: fakeJobId,
        clerkId: "recruiter_1",
        title: "Engineer",
        companyName: "Acme",
      } as never);

      vi.spyOn(Application, "findOne").mockResolvedValue(null);
      vi.spyOn(Application, "create").mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as never);
      vi.spyOn(User, "findOne").mockResolvedValue({ email: "recruiter@acme.com" } as never);

      // Email service throws fatal network error
      vi.spyOn(mailLib, "sendApplicationEmail").mockRejectedValue(new Error("Resend rate limit exceeded"));

      const result = await submitApplication(
        fakeJobId.toString(),
        "https://res.cloudinary.com/demo/image/upload/v1/resume.pdf"
      );

      // Application still saved successfully
      expect(result.success).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB connection
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

// Mock Google Gen AI SDK
const mockInteractionsCreate = vi.fn();
const mockModelsGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      interactions: {
        create: mockInteractionsCreate,
      },
      models: {
        generateContent: mockModelsGenerateContent,
      },
    })),
  };
});

import Application from "@/models/Application";
import Profile from "@/models/Profile";
import * as authLib from "@/lib/auth";
import { generateAIScore } from "@/app/actions/ai";
import {
  isTransientError,
  isInvalidApiKeyError,
  isModelUnavailableError,
  isOutdatedModel,
  resolveModelName,
  DEFAULT_PRIMARY_MODEL,
  DEFAULT_FALLBACK_MODEL,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
} from "@/lib/ai-retry";
import mongoose from "mongoose";

interface ErrorWithStatus extends Error {
  status?: number;
}

describe("Phase 2 — AI Candidate-to-Job Matching Engine", () => {
  const defaultEvaluationJson = JSON.stringify({
    overallScore: 88,
    skillAlignment: { score: 90, matchedSkills: ["React", "TypeScript"], missingSkills: [] },
    experienceAlignment: { score: 85, assessment: "Strong relevant background." },
    qualificationsAlignment: { score: 88, assessment: "Solid engineering skills." },
    keyStrengths: ["Full-stack Next.js expertise"],
    recommendations: "Proceed with technical interview.",
    summary: "Strong 88% candidate match.",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-api-key";
    mockInteractionsCreate.mockResolvedValue({
      output_text: defaultEvaluationJson,
    });
    mockModelsGenerateContent.mockResolvedValue({
      text: defaultEvaluationJson,
    });
  });

  describe("Authorization & Validation", () => {
    it("rejects unauthenticated callers or non-recruiters", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockRejectedValue(
        new Error("Forbidden: Recruiter access required.")
      );

      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(generateAIScore(fakeId)).rejects.toThrow("Forbidden: Recruiter access required.");
    });

    it("rejects malformed ObjectIds", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_1",
        email: "recruiter@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const result = await generateAIScore("not-a-valid-id");
      expect(result.score).toBeNull();
      expect(result.error).toBe("INVALID_IDENTIFIER");
    });

    it("enforces job ownership when evaluating an application (IDOR defense)", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_attacker",
        email: "attacker@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: {
            clerkId: "recruiter_victim", // DIFFERENT RECRUITER
            title: "Security Engineer",
          },
        }),
      } as never);

      await expect(generateAIScore(appId.toString())).rejects.toThrow(
        "Forbidden: You are not authorized to score candidates for this job."
      );
    });
  });

  describe("Persistent Caching & Performance", () => {
    it("returns cached evaluation immediately without calling Gemini API", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      const existingEvaluation = {
        overallScore: 88,
        skillAlignment: { score: 90, matchedSkills: ["React", "Node"], missingSkills: ["GraphQL"] },
        experienceAlignment: { score: 85, assessment: "Good experience" },
        qualificationsAlignment: { score: 88, assessment: "Strong fit" },
        keyStrengths: ["Fast learner", "React expert"],
        recommendations: "Schedule interview",
        summary: "Excellent candidate fit.",
        evaluatedAt: new Date(),
      };

      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
          aiScore: 88,
          aiAnalysis: existingEvaluation,
        }),
      } as never);

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBe(88);
      expect(result.cached).toBe(true);
      expect(result.analysis).toEqual(existingEvaluation);
      // Gemini API was NOT called!
      expect(mockInteractionsCreate).not.toHaveBeenCalled();
    });

    it("forces re-evaluation when forceRefresh is true, updating MongoDB", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      const saveMock = vi.fn().mockResolvedValue(true);

      const appDoc = {
        _id: appId,
        userId: "candidate_1",
        coverLetter: "Excited to apply",
        jobId: { clerkId: "recruiter_owner", title: "React Dev", description: "<p>React</p>" },
        aiScore: 70, // Old score
        aiAnalysis: { overallScore: 70 },
        save: saveMock,
      };

      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue(appDoc),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          userId: "candidate_1",
          bio: "Updated senior engineer profile",
          skills: ["React", "TypeScript", "Next.js"],
        }),
      } as never);

      // Mock fresh Gemini response
      mockInteractionsCreate.mockResolvedValue({
        output_text: JSON.stringify({
          overallScore: 94,
          skillAlignment: { score: 95, matchedSkills: ["React", "TypeScript", "Next.js"], missingSkills: [] },
          experienceAlignment: { score: 92, assessment: "Senior depth demonstrated." },
          qualificationsAlignment: { score: 95, assessment: "Excellent credentials." },
          keyStrengths: ["Senior Next.js track record"],
          recommendations: "Proceed to final round interview.",
          summary: "Outstanding candidate match at 94%.",
        }),
      });

      const result = await generateAIScore(appId.toString(), { forceRefresh: true });

      expect(result.score).toBe(94);
      expect(result.cached).toBe(false);
      expect(mockInteractionsCreate).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalled();
      expect(appDoc.aiScore).toBe(94);
    });
  });

  describe("Resilience, Retries & Fallback Handling", () => {
    it("handles transient 503 high demand error with bounded retry and succeeds on next attempt", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      const saveMock = vi.fn().mockResolvedValue(true);
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
          save: saveMock,
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      // Attempt 1 fails with 503 high demand, Attempt 2 succeeds
      mockInteractionsCreate
        .mockRejectedValueOnce(new Error("503 Service Unavailable — This model is currently experiencing high demand."))
        .mockResolvedValueOnce({
          output_text: JSON.stringify({ overallScore: 86, summary: "Recovered successfully on retry." }),
        });

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBe(86);
      expect(result.reason).toBe("Recovered successfully on retry.");
      expect(mockInteractionsCreate).toHaveBeenCalledTimes(2);
    });

    it("handles exhausted 503 retries with clear recoverable SERVICE_UNAVAILABLE error", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      mockInteractionsCreate.mockRejectedValue(
        new Error("503 Service Unavailable — This model is currently experiencing high demand.")
      );

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBeNull();
      expect(result.error).toBe("SERVICE_UNAVAILABLE");
      expect(result.reason).toContain("experiencing high demand");
    });

    it("falls back to secondary supported model when primary model fails with temporary availability error", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      const saveMock = vi.fn().mockResolvedValue(true);
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
          save: saveMock,
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      // Primary model (gemini-3.8-flash) fails with 503, fallback model (gemini-3.7-flash) succeeds
      mockInteractionsCreate.mockImplementation(async ({ model }: { model: string }) => {
        if (model === "gemini-3.7-flash") {
          return {
            output_text: JSON.stringify({ overallScore: 89, summary: "Fallback model evaluation succeeded." }),
          };
        }
        throw new Error("503 Service Unavailable — This model is currently experiencing high demand.");
      });

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBe(89);
      expect(result.reason).toBe("Fallback model evaluation succeeded.");
      expect(mockInteractionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gemini-3.7-flash" })
      );
    });

    it("handles 404 model-unavailable without retrying the invalid model, falling back to secondary model", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      const saveMock = vi.fn().mockResolvedValue(true);
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
          save: saveMock,
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      let primaryCalls = 0;
      mockInteractionsCreate.mockImplementation(async ({ model }: { model: string }) => {
        if (model === "gemini-3.8-flash") {
          primaryCalls++;
          const err: ErrorWithStatus = new Error(
            "404 Not Found — gemini-2.5-flash is no longer available to new users. Update to gemini-3.8-flash."
          );
          err.status = 404;
          throw err;
        }
        if (model === "gemini-3.7-flash") {
          return {
            output_text: JSON.stringify({ overallScore: 91, summary: "Fallback model recovered after 404." }),
          };
        }
        throw new Error("Unexpected model");
      });

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBe(91);
      expect(result.reason).toBe("Fallback model recovered after 404.");
      // Primary model was called only ONCE (no retry loop on 404 model unavailable!)
      expect(primaryCalls).toBe(1);
    });

    it("returns MODEL_UNAVAILABLE error when all models are unavailable", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      mockInteractionsCreate.mockImplementation(async () => {
        const err: ErrorWithStatus = new Error("404 Not Found — This model is no longer available.");
        err.status = 404;
        throw err;
      });

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBeNull();
      expect(result.error).toBe("MODEL_UNAVAILABLE");
      expect(result.reason).toContain("no longer supported");
    });

    it("handles transient 429 rate limits with bounded retry and succeeds", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      const saveMock = vi.fn().mockResolvedValue(true);
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
          save: saveMock,
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      mockInteractionsCreate
        .mockRejectedValueOnce(new Error("429 Resource has been exhausted (e.g. check quota)."))
        .mockResolvedValueOnce({
          output_text: JSON.stringify({ overallScore: 84, summary: "Recovered after rate limit delay." }),
        });

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBe(84);
      expect(mockInteractionsCreate).toHaveBeenCalledTimes(2);
    });

    it("handles exhausted 429 retries with recoverable RATE_LIMITED error", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      mockInteractionsCreate.mockRejectedValue(
        new Error("429 Resource has been exhausted (e.g. check quota).")
      );

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBeNull();
      expect(result.error).toBe("RATE_LIMITED");
      expect(result.reason).toContain("rate-limited");
    });

    it("does not retry permanent configuration errors like invalid API keys", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      mockInteractionsCreate.mockRejectedValue(
        new Error("API key not valid. Please pass a valid API key.")
      );

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBeNull();
      expect(result.error).toBe("INVALID_API_KEY");
      expect(result.reason).toContain("authentication failed");
      // Must not retry
      expect(mockInteractionsCreate).toHaveBeenCalledTimes(1);
    });

    it("prevents duplicate concurrent evaluations for the same application (single-flight deduplication)", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      const saveMock = vi.fn().mockResolvedValue(true);
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
          save: saveMock,
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      // Delay generation to simulate in-flight network call
      mockInteractionsCreate.mockImplementation(async () => {
        await new Promise((res) => setTimeout(res, 25));
        return {
          output_text: JSON.stringify({ overallScore: 78, summary: "Concurrent deduplication verified" }),
        };
      });

      const [res1, res2] = await Promise.all([
        generateAIScore(appId.toString(), { forceRefresh: true }),
        generateAIScore(appId.toString(), { forceRefresh: true }),
      ]);

      expect(res1.score).toBe(78);
      expect(res2.score).toBe(78);
      // Crucial: Only ONE underlying Gemini API call was made despite 2 concurrent requests
      expect(mockInteractionsCreate).toHaveBeenCalledTimes(1);
    });

    it("handles conversational output with regex fallback", async () => {
      vi.spyOn(authLib, "requireRecruiter").mockResolvedValue({
        userId: "recruiter_owner",
        email: "owner@test.com",
        role: "recruiter",
        dbUser: {} as never,
      });

      const appId = new mongoose.Types.ObjectId();
      const saveMock = vi.fn().mockResolvedValue(true);
      vi.spyOn(Application, "findById").mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          _id: appId,
          userId: "candidate_1",
          jobId: { clerkId: "recruiter_owner", title: "React Dev" },
          save: saveMock,
        }),
      } as never);

      vi.spyOn(Profile, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      // Model wraps JSON inside conversational markdown text
      const conversationalOutput = `
Here is my assessment of the candidate:
\`\`\`json
{
  "overallScore": 82,
  "skillAlignment": { "score": 85, "matchedSkills": ["JavaScript"], "missingSkills": ["TypeScript"] },
  "experienceAlignment": { "score": 80, "assessment": "Good foundation." },
  "qualificationsAlignment": { "score": 82, "assessment": "Meets criteria." },
  "keyStrengths": ["Core JS proficiency"],
  "recommendations": "Screen for TypeScript.",
  "summary": "Solid 82% fit."
}
\`\`\`
Hope this helps!
`;
      mockInteractionsCreate.mockResolvedValue({
        output_text: conversationalOutput,
      });

      const result = await generateAIScore(appId.toString());

      expect(result.score).toBe(82);
      expect(result.reason).toBe("Solid 82% fit.");
    });
  });

  describe("Model Defaults, Environment Overrides & Error Classification", () => {
    it("exposes modern default models (gemini-3.8-flash and gemini-3.7-flash)", () => {
      expect(DEFAULT_PRIMARY_MODEL).toBe("gemini-3.8-flash");
      expect(DEFAULT_FALLBACK_MODEL).toBe("gemini-3.7-flash");
      expect(PRIMARY_MODEL).toBe("gemini-3.8-flash");
      expect(FALLBACK_MODEL).toBe("gemini-3.7-flash");
    });

    it("detects outdated/deprecated model identifiers correctly", () => {
      expect(isOutdatedModel("gemini-2.5-flash")).toBe(true);
      expect(isOutdatedModel("gemini-2.0-flash")).toBe(true);
      expect(isOutdatedModel("gemini-1.5-pro")).toBe(true);
      expect(isOutdatedModel("gemini-1.0-pro")).toBe(true);
      expect(isOutdatedModel("gemini-pro")).toBe(true);

      // Modern models are NOT outdated
      expect(isOutdatedModel("gemini-3.8-flash")).toBe(false);
      expect(isOutdatedModel("gemini-3.7-flash")).toBe(false);
      expect(isOutdatedModel("gemini-3.5-flash-lite")).toBe(false);
      expect(isOutdatedModel("gemini-3.1-pro-preview")).toBe(false);
      expect(isOutdatedModel(undefined)).toBe(false);
    });

    it("prevents outdated models in environment variables from overriding defaults", () => {
      expect(resolveModelName("gemini-2.5-flash", DEFAULT_PRIMARY_MODEL)).toBe("gemini-3.8-flash");
      expect(resolveModelName("gemini-2.0-flash", DEFAULT_FALLBACK_MODEL)).toBe("gemini-3.7-flash");
      expect(resolveModelName("gemini-1.5-flash", DEFAULT_PRIMARY_MODEL)).toBe("gemini-3.8-flash");
      expect(resolveModelName(undefined, DEFAULT_PRIMARY_MODEL)).toBe("gemini-3.8-flash");
      expect(resolveModelName("", DEFAULT_PRIMARY_MODEL)).toBe("gemini-3.8-flash");

      // Allows valid modern model overrides
      expect(resolveModelName("gemini-3.1-pro-preview", DEFAULT_PRIMARY_MODEL)).toBe("gemini-3.1-pro-preview");
    });

    it("identifies model unavailable 404 errors accurately", () => {
      const err404: ErrorWithStatus = new Error("404 Not Found — gemini-2.5-flash is no longer available to new users.");
      err404.status = 404;
      expect(isModelUnavailableError(err404)).toBe(true);
      expect(isModelUnavailableError(new Error("models/gemini-2.5-flash is no longer available to new users"))).toBe(true);
      expect(isModelUnavailableError(new Error("model not supported"))).toBe(true);
      expect(isModelUnavailableError(new Error("503 Service Unavailable"))).toBe(false);
      expect(isModelUnavailableError(new Error("429 Rate limit"))).toBe(false);
      expect(isModelUnavailableError(null)).toBe(false);
    });

    it("ensures model unavailable 404 errors are NEVER classified as transient retryable errors", () => {
      const err404: ErrorWithStatus = new Error("404 Not Found — gemini-2.5-flash is no longer available to new users.");
      err404.status = 404;
      expect(isTransientError(err404)).toBe(false);
      expect(isTransientError(new Error("models/gemini-2.5-flash is no longer available to new users"))).toBe(false);
    });

    it("classifies genuine transient errors correctly", () => {
      expect(isTransientError(new Error("503 Service Unavailable"))).toBe(true);
      expect(isTransientError(new Error("This model is currently experiencing high demand."))).toBe(true);
      expect(isTransientError(new Error("429 Resource has been exhausted"))).toBe(true);
      expect(isTransientError(new Error("rate limit exceeded"))).toBe(true);
      expect(isTransientError(new Error("AI_REQUEST_TIMEOUT"))).toBe(true);
      expect(isTransientError(new Error("ETIMEDOUT"))).toBe(true);
    });

    it("classifies permanent errors as non-retryable", () => {
      expect(isTransientError(new Error("API key not valid. Please pass a valid API key."))).toBe(false);
      expect(isTransientError(new Error("API_KEY_INVALID"))).toBe(false);
      expect(isTransientError(new Error("PERMISSION_DENIED"))).toBe(false);
      expect(isTransientError(new Error("INVALID_ARGUMENT: Unsupported field"))).toBe(false);
      expect(isTransientError(new Error("Bad request"))).toBe(false);
      expect(isTransientError(null)).toBe(false);
    });

    it("identifies API key misconfigurations accurately", () => {
      expect(isInvalidApiKeyError(new Error("API key not valid"))).toBe(true);
      expect(isInvalidApiKeyError(new Error("API_KEY_INVALID"))).toBe(true);
      expect(isInvalidApiKeyError(new Error("PERMISSION_DENIED"))).toBe(true);
      expect(isInvalidApiKeyError(new Error("503 Service Unavailable"))).toBe(false);
      expect(isInvalidApiKeyError(new Error("429 Rate Limit"))).toBe(false);
    });
  });
});

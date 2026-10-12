"use server";

import { GoogleGenAI } from "@google/genai";
import { requireRecruiter } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Job, { IJob } from "@/models/Job";
import Application, { IAIEvaluation } from "@/models/Application";
import Profile from "@/models/Profile";
import mongoose from "mongoose";


export interface AIScoreResult {
  score: number | null;
  reason: string;
  analysis?: IAIEvaluation;
  cached?: boolean;
  error?: string;
}

export interface CandidateProfileInput {
  bio?: string | null;
  skills?: string[] | null;
  userId?: string;
}

/**
 * Validates and normalizes raw JSON output from Gemini into a typed IAIEvaluation.
 */
function parseAndValidateEvaluation(raw: unknown): IAIEvaluation | null {
  if (typeof raw !== "object" || raw === null) return null;

  const data = raw as Record<string, unknown>;

  const clampScore = (val: unknown): number => {
    if (typeof val === "number" && !isNaN(val)) {
      return Math.min(100, Math.max(0, Math.round(val)));
    }
    return 50;
  };

  const sanitizeStrings = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 10);
  };

  const overallScore = clampScore(data.overallScore ?? data.score);

  const rawSkill = (data.skillAlignment as Record<string, unknown>) || {};
  const skillAlignment = {
    score: clampScore(rawSkill.score ?? overallScore),
    matchedSkills: sanitizeStrings(rawSkill.matchedSkills),
    missingSkills: sanitizeStrings(rawSkill.missingSkills),
  };

  const rawExp = (data.experienceAlignment as Record<string, unknown>) || {};
  const experienceAlignment = {
    score: clampScore(rawExp.score ?? overallScore),
    assessment: typeof rawExp.assessment === "string" ? rawExp.assessment.trim() : "Experience assessed based on candidate profile.",
  };

  const rawQual = (data.qualificationsAlignment as Record<string, unknown>) || {};
  const qualificationsAlignment = {
    score: clampScore(rawQual.score ?? overallScore),
    assessment: typeof rawQual.assessment === "string" ? rawQual.assessment.trim() : "Qualifications evaluated against job requirements.",
  };

  const keyStrengths = sanitizeStrings(data.keyStrengths);
  const recommendations = typeof data.recommendations === "string"
    ? data.recommendations.trim()
    : "Review candidate application and discuss technical qualifications.";

  const summary = typeof data.summary === "string"
    ? data.summary.trim()
    : typeof data.reason === "string"
    ? data.reason.trim()
    : `Candidate match evaluated at ${overallScore}%.`;

  return {
    overallScore,
    skillAlignment,
    experienceAlignment,
    qualificationsAlignment,
    keyStrengths: keyStrengths.length > 0 ? keyStrengths : ["Candidate profile reviewed."],
    recommendations,
    summary,
    evaluatedAt: new Date(),
  };
}

// In-flight evaluation tracker to prevent duplicate concurrent evaluations for the same application
const inFlightEvaluations = new Map<string, Promise<AIScoreResult>>();

import {
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  isInvalidApiKeyError,
  isModelUnavailableError,
  callGeminiWithRetryAndFallback,
} from "@/lib/ai-retry";

/**
 * Generates or retrieves an AI candidate-job match score.
 * Enforces recruiter authentication, job ownership verification, persistent caching on Application,
 * structured scoring rubric, transient retry with exponential backoff, and concurrency deduplication.
 */
export async function generateAIScore(
  targetId: string,
  profileOrOptions?: CandidateProfileInput | { forceRefresh?: boolean }
): Promise<AIScoreResult> {
  // 1. Enforce recruiter authentication first
  const authUser = await requireRecruiter();

  // 2. Validate identifier
  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    return { score: null, reason: "Invalid job or application identifier.", error: "INVALID_IDENTIFIER" };
  }

  // 3. Concurrency deduplication: reuse in-flight evaluation if already running for this target
  if (inFlightEvaluations.has(targetId)) {
    return inFlightEvaluations.get(targetId)!;
  }

  const evalPromise = (async () => {
    try {
      return await executeEvaluationCore(targetId, authUser.userId, profileOrOptions);
    } finally {
      inFlightEvaluations.delete(targetId);
    }
  })();

  inFlightEvaluations.set(targetId, evalPromise);
  return await evalPromise;
}

/**
 * Core evaluation logic after authentication and concurrency control.
 */
async function executeEvaluationCore(
  targetId: string,
  authUserId: string,
  profileOrOptions?: CandidateProfileInput | { forceRefresh?: boolean }
): Promise<AIScoreResult> {
  await connectDB();

  // Determine if targetId is an Application or a Job
  const application = await Application.findById(targetId).populate<{ jobId: IJob }>("jobId");
  let job: IJob | null = null;
  let candidateBio = "No bio provided";
  let candidateSkills: string[] = [];
  let candidateCoverLetter = "";

  const forceRefresh = !!(
    profileOrOptions &&
    typeof profileOrOptions === "object" &&
    "forceRefresh" in profileOrOptions &&
    profileOrOptions.forceRefresh
  );

  if (application) {
    // Target is an Application
    job = application.jobId as IJob;
    if (!job) {
      return { score: null, reason: "Associated job listing not found.", error: "JOB_NOT_FOUND" };
    }

    // Enforce recruiter ownership of the job
    if (job.clerkId !== authUserId) {
      throw new Error("Forbidden: You are not authorized to score candidates for this job.");
    }

    // Check for cached evaluation and verify freshness against job updates
    if (!forceRefresh && application.aiScore !== undefined && application.aiAnalysis) {
      const evalTime = application.aiAnalysis.evaluatedAt
        ? new Date(application.aiAnalysis.evaluatedAt).getTime()
        : 0;
      const jobUpdateTime = job.updatedAt ? new Date(job.updatedAt).getTime() : 0;
      const isFresh = evalTime >= jobUpdateTime;

      if (isFresh) {
        return {
          score: application.aiScore,
          reason: application.aiAnalysis.summary,
          analysis: application.aiAnalysis,
          cached: true,
        };
      }
      // Stale cache detected: job was updated after last evaluation -> recompute fresh score
    }

    // Extract candidate data from DB
    const [profileDoc] = await Promise.all([
      Profile.findOne({ userId: application.userId }).lean(),
    ]);

    candidateBio = profileDoc?.bio || "No bio provided";
    candidateSkills = Array.isArray(profileDoc?.skills) ? profileDoc.skills : [];
    candidateCoverLetter = application.coverLetter || "";
  } else {
    // Check if targetId is a Job (backward compatibility)
    job = await Job.findById(targetId);
    if (!job) {
      return { score: null, reason: "Job or application record not found.", error: "NOT_FOUND" };
    }

    if (job.clerkId !== authUserId) {
      throw new Error("Forbidden: You are not authorized to score candidates for this job.");
    }

    const inputProfile = profileOrOptions as CandidateProfileInput | undefined;
    candidateBio = typeof inputProfile?.bio === "string" ? inputProfile.bio : "No bio provided";
    candidateSkills = Array.isArray(inputProfile?.skills) ? inputProfile.skills : [];
  }

  // Validate and sanitize inputs
  const sanitizedBio = candidateBio.slice(0, 1500);
  const sanitizedSkills = candidateSkills
    .slice(0, 50)
    .filter((s): s is string => typeof s === "string")
    .join(", ") || "No skills listed";
  const sanitizedCoverLetter = candidateCoverLetter.slice(0, 2000) || "None provided";
  const sanitizedDescription = job.description
    ? job.description.replace(/<[^>]*>/g, " ").slice(0, 2000).trim()
    : "No description provided";

  // Ensure API key is configured
  const currentApiKey = process.env.GEMINI_API_KEY;
  if (!currentApiKey) {
    return {
      score: null,
      reason: "AI matching service is currently unconfigured.",
      error: "API_KEY_MISSING",
    };
  }

  try {
    const genAI = new GoogleGenAI({ apiKey: currentApiKey });
    const primaryModelName = PRIMARY_MODEL;
    const fallbackModelName = FALLBACK_MODEL;

    const prompt = `
You are an expert Talent Acquisition Architect and Technical Recruiter assessing candidate fitness for a role.

JOB DETAILS:
- Title: ${job.title}
- Company: ${job.companyName || "Company"}
- Type: ${job.jobType || "Full-time"}
- Description: ${sanitizedDescription}

CANDIDATE INFORMATION:
- Bio: ${sanitizedBio}
- Skills: ${sanitizedSkills}
- Cover Letter / Statement: ${sanitizedCoverLetter}

SCORING RUBRIC:
1. Skill Alignment (40% weight): Compare candidate skills and background with required and preferred skills in the job description. Distinguish matched skills from missing/unaddressed skills.
2. Experience Alignment (35% weight): Assess relevance and depth of past experience, seniority match, and domain knowledge.
3. Qualifications & Communication (25% weight): Assess education/credentials (if mentioned in bio/cover letter), communication clarity, and candidate motivation.
IMPORTANT: Base your assessment strictly on the information provided. If the candidate has not provided skills or background, explicitly list missing skills/information and assign an appropriately lower score without inventing details.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object matching the following structure, with NO surrounding markdown formatting or backticks:
{
  "overallScore": <integer between 0 and 100>,
  "skillAlignment": {
    "score": <integer between 0 and 100>,
    "matchedSkills": [<strings of matched skills>],
    "missingSkills": [<strings of missing or needed skills>]
  },
  "experienceAlignment": {
    "score": <integer between 0 and 100>,
    "assessment": "<1-2 sentence assessment of experience depth and relevance>"
  },
  "qualificationsAlignment": {
    "score": <integer between 0 and 100>,
    "assessment": "<1-2 sentence assessment of qualifications and role fit>"
  },
  "keyStrengths": [<1-3 concise bullet points highlighting top candidate strengths>],
  "recommendations": "<1-2 sentence actionable next-step recommendation for the recruiter>",
  "summary": "<1-2 sentence executive summary of overall candidate fit>"
}
`.trim();

    // Execute generation with retry and fallback
    const { text: rawText } = await callGeminiWithRetryAndFallback(
      genAI,
      prompt,
      primaryModelName,
      fallbackModelName
    );

    const cleanedText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      // Regex extraction fallback for JSON within conversational output
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("PARSING_ERROR");
      }
    }

    const evaluation = parseAndValidateEvaluation(parsed);
    if (!evaluation) {
      return { score: null, reason: "Could not parse AI evaluation score.", error: "INVALID_AI_OUTPUT" };
    }

    // Cache evaluation in MongoDB if target was an Application
    if (application) {
      application.aiScore = evaluation.overallScore;
      application.aiAnalysis = evaluation;
      await application.save();
    }

    return {
      score: evaluation.overallScore,
      reason: evaluation.summary,
      analysis: evaluation,
      cached: false,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    console.error("AI Generation Error:", message);

    if (isInvalidApiKeyError(error)) {
      return {
        score: null,
        reason: "AI matching service authentication failed. Please verify your API key.",
        error: "INVALID_API_KEY",
      };
    }

    if (isModelUnavailableError(error)) {
      return {
        score: null,
        reason: "The requested AI model is unavailable or no longer supported. Please check your model configuration.",
        error: "MODEL_UNAVAILABLE",
      };
    }

    if (message === "AI_REQUEST_TIMEOUT" || message.includes("TIMEOUT")) {
      return {
        score: null,
        reason: "AI matching request timed out after multiple attempts. Please try again.",
        error: "TIMEOUT",
      };
    }

    if (
      message.includes("503") ||
      message.toLowerCase().includes("service unavailable") ||
      message.toLowerCase().includes("high demand") ||
      message.toLowerCase().includes("overloaded")
    ) {
      return {
        score: null,
        reason: "The AI matching service is currently experiencing high demand. Please try again in a few moments.",
        error: "SERVICE_UNAVAILABLE",
      };
    }

    if (
      message.includes("429") ||
      message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("resource exhausted") ||
      message.toLowerCase().includes("rate limit")
    ) {
      return {
        score: null,
        reason: "AI matching service is currently busy or rate-limited. Please try again in a few moments.",
        error: "RATE_LIMITED",
      };
    }

    return {
      score: null,
      reason: "AI service temporarily unavailable. Please try again later.",
      error: message,
    };
  }
}
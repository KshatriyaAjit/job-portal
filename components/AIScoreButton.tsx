"use client";

import { useState } from "react";
import { generateAIScore, AIScoreResult, CandidateProfileInput } from "@/app/actions/ai";
import { IAIEvaluation } from "@/models/Application";
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Lightbulb 
} from "lucide-react";

interface AIScoreButtonProps {
  applicationId?: string;
  jobId: string;
  candidateProfile?: CandidateProfileInput;
  cachedScore?: number;
  cachedAnalysis?: IAIEvaluation;
}

export default function AIScoreButton({ 
  applicationId, 
  jobId, 
  candidateProfile, 
  cachedScore, 
  cachedAnalysis 
}: AIScoreButtonProps) {
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState<AIScoreResult | null>(() => {
    if (cachedScore !== undefined && cachedScore !== null) {
      return {
        score: cachedScore,
        reason: cachedAnalysis?.summary || `Candidate match evaluated at ${cachedScore}%.`,
        analysis: cachedAnalysis,
        cached: true,
      };
    }
    return null;
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const targetId = applicationId || jobId;

  async function handleGenerate(forceRefresh = false) {
    setLoading(true);
    try {
      const result = await generateAIScore(
        targetId, 
        applicationId ? { forceRefresh } : candidateProfile
      );
      setScoreData(result);
      if (result.score !== null) {
        setIsExpanded(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "AI generation failed";
      setScoreData({
        score: null,
        reason: message,
        error: message,
      });
    } finally {
      setLoading(false);
    }
  }

  // If score exists and is valid
  if (scoreData?.score !== null && scoreData?.score !== undefined) {
    const score = scoreData.score;
    const isHigh = score >= 80;
    const isMedium = score >= 60 && score < 80;

    const badgeColor = isHigh
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : isMedium
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : "bg-amber-50 text-amber-900 border-amber-200";

    const scoreTagColor = isHigh
      ? "bg-emerald-600 text-white"
      : isMedium
      ? "bg-blue-600 text-white"
      : "bg-amber-600 text-white";

    return (
      <div className={`mt-3 p-4 rounded-xl border text-sm transition w-full ${badgeColor}`}>
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black shadow-sm ${scoreTagColor}`}>
              {score}% Match
            </span>
            <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              AI Candidate Evaluation
            </span>
            {scoreData.cached && (
              <span className="text-[10px] bg-white/70 px-2 py-0.5 rounded border border-black/10 text-gray-600">
                Cached
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {scoreData.analysis && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-semibold underline flex items-center gap-1 hover:opacity-80 transition cursor-pointer"
              >
                <span>{isExpanded ? "Hide Details" : "View Breakdown"}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleGenerate(true)}
              disabled={loading}
              title="Re-run AI evaluation"
              className="p-1 rounded hover:bg-black/5 text-gray-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Executive Summary */}
        <p className="mt-2 text-xs leading-relaxed text-gray-800">
          {scoreData.reason}
        </p>

        {/* Expandable Rubric Breakdown */}
        {isExpanded && scoreData.analysis && (
          <div className="mt-3 pt-3 border-t border-black/10 space-y-3 text-xs">
            {/* Skills Alignment */}
            <div className="bg-white/80 p-3 rounded-lg border border-black/5">
              <div className="flex items-center justify-between mb-1.5 font-bold text-gray-900">
                <span>Skill Alignment (40%)</span>
                <span className="text-gray-600">{scoreData.analysis.skillAlignment.score}%</span>
              </div>
              
              {scoreData.analysis.skillAlignment.matchedSkills.length > 0 && (
                <div className="mb-2">
                  <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1 mb-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Matched Skills:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {scoreData.analysis.skillAlignment.matchedSkills.map((s, idx) => (
                      <span key={idx} className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {scoreData.analysis.skillAlignment.missingSkills.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-rose-800 flex items-center gap-1 mb-1">
                    <XCircle className="w-3 h-3 text-rose-600" /> Missing / Unaddressed Skills:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {scoreData.analysis.skillAlignment.missingSkills.map((s, idx) => (
                      <span key={idx} className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[11px] font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Experience & Qualifications Alignments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-white/80 p-3 rounded-lg border border-black/5">
                <div className="flex items-center justify-between font-bold text-gray-900 mb-1">
                  <span>Experience Alignment (35%)</span>
                  <span className="text-gray-600">{scoreData.analysis.experienceAlignment.score}%</span>
                </div>
                <p className="text-gray-700 leading-snug">
                  {scoreData.analysis.experienceAlignment.assessment}
                </p>
              </div>

              <div className="bg-white/80 p-3 rounded-lg border border-black/5">
                <div className="flex items-center justify-between font-bold text-gray-900 mb-1">
                  <span>Qualifications & Fit (25%)</span>
                  <span className="text-gray-600">{scoreData.analysis.qualificationsAlignment.score}%</span>
                </div>
                <p className="text-gray-700 leading-snug">
                  {scoreData.analysis.qualificationsAlignment.assessment}
                </p>
              </div>
            </div>

            {/* Key Strengths */}
            {scoreData.analysis.keyStrengths.length > 0 && (
              <div className="bg-white/80 p-3 rounded-lg border border-black/5">
                <span className="font-bold text-gray-900 block mb-1">Key Strengths:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-gray-700">
                  {scoreData.analysis.keyStrengths.map((str, idx) => (
                    <li key={idx}>{str}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recruiter Recommendation */}
            {scoreData.analysis.recommendations && (
              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg flex items-start gap-2 text-amber-900">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Recruiter Next Step: </span>
                  <span>{scoreData.analysis.recommendations}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // If score generation failed with an error
  if (scoreData?.error) {
    return (
      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-900">AI Analysis Notice: </span>
            <span className="text-amber-800">{scoreData.reason}</span>
          </div>
        </div>
        <button
          onClick={() => handleGenerate(true)}
          disabled={loading}
          className="text-xs font-bold text-amber-900 underline hover:text-amber-700 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Retry
        </button>
      </div>
    );
  }

  // Default state: trigger button
  return (
    <button
      onClick={() => handleGenerate(false)}
      disabled={loading}
      className="mt-2 flex items-center gap-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-200 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {loading ? "Evaluating candidate fit..." : "Evaluate with AI"}
    </button>
  );
}
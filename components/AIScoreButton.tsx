"use client";

import { useState } from "react";
import { generateAIScore } from "@/app/actions/ai"; // Import the function we just made
import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  jobDescription: string;
  candidateProfile: any;
}

export default function AIScoreButton({ jobDescription, candidateProfile }: Props) {
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState<{ score: number; reason: string } | null>(null);

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generateAIScore(jobDescription, candidateProfile);
      setScoreData(result);
    } catch (error) {
      alert("AI Failed to generate score");
    } finally {
      setLoading(false);
    }
  }

  // If score exists, show it
  if (scoreData) {
    return (
      <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="font-bold text-indigo-900">AI Match: {scoreData.score}%</span>
        </div>
        <p className="text-indigo-700 leading-snug">{scoreData.reason}</p>
      </div>
    );
  }

  // Otherwise, show button
  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="mt-2 flex items-center gap-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-200 transition"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {loading ? "Analyzing..." : "Analyze with AI"}
    </button>
  );
}
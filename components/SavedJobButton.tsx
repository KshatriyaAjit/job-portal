"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleSavedJob } from "@/app/actions";
import { useRouter } from "next/navigation";

interface SavedJobButtonProps {
  jobId: string;
  initialIsSaved: boolean;
}

export default function SavedJobButton({ jobId, initialIsSaved }: SavedJobButtonProps) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const router = useRouter();

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent clicking the job card link
    e.stopPropagation();

    // 1. Optimistic Update (Instant UI change)
    const newState = !isSaved;
    setIsSaved(newState);

    try {
      // 2. Call Server Action
      await toggleSavedJob(jobId);
      router.refresh(); // Sync with server
    } catch (error) {
      // 3. Revert if it fails
      setIsSaved(!newState);
      console.error("Failed to save job:", error);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2 rounded-full hover:bg-red-50 transition z-10 relative cursor-pointer"
      title={isSaved ? "Unsave Job" : "Save Job"}
    >
      <Heart
        className={`w-6 h-6 transition-colors duration-200 ${
          isSaved ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-400"
        }`}
      />
    </button>
  );
}
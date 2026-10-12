"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { adminUpdateUserRole } from "@/app/actions";

interface AdminRoleToggleButtonProps {
  clerkId: string;
  currentRole: "candidate" | "recruiter";
}

export default function AdminRoleToggleButton({
  clerkId,
  currentRole,
}: AdminRoleToggleButtonProps) {
  const [isPending, startTransition] = useTransition();
  const isRecruiter = currentRole === "recruiter";
  const targetRole = isRecruiter ? "candidate" : "recruiter";

  const handleToggle = () => {
    startTransition(async () => {
      try {
        await adminUpdateUserRole(clerkId, targetRole);
      } catch (err) {
        console.error("Failed to update user role:", err);
      }
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleToggle}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
        isRecruiter
          ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
          : "border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100"
      }`}
    >
      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {isRecruiter ? "Set as Candidate" : "Promote to Recruiter"}
    </button>
  );
}


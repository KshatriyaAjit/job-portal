"use client";

import { useTransition, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { adminApproveRecruiter, adminRejectRecruiter } from "@/app/actions";

interface AdminRecruiterDecisionButtonsProps {
  clerkId: string;
}

export default function AdminRecruiterDecisionButtons({
  clerkId,
}: AdminRecruiterDecisionButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(null);

  const handleApprove = () => {
    setActiveAction("approve");
    startTransition(async () => {
      try {
        await adminApproveRecruiter(clerkId);
      } catch (err) {
        console.error("Failed to approve recruiter:", err);
      } finally {
        setActiveAction(null);
      }
    });
  };

  const handleReject = () => {
    setActiveAction("reject");
    startTransition(async () => {
      try {
        await adminRejectRecruiter(clerkId);
      } catch (err) {
        console.error("Failed to reject recruiter:", err);
      } finally {
        setActiveAction(null);
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleApprove}
        className="px-3 py-1.5 rounded-lg text-xs font-bold transition border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending && activeAction === "approve" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
        Approve
      </button>

      <button
        type="button"
        disabled={isPending}
        onClick={handleReject}
        className="px-3 py-1.5 rounded-lg text-xs font-bold transition border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending && activeAction === "reject" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
        Reject
      </button>
    </div>
  );
}


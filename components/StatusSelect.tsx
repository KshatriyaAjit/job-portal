"use client";

import { updateApplicationStatus } from "@/app/actions";
import { useState } from "react";

interface Props {
  applicationId: string;
  currentStatus: string;
}

export default function StatusSelect({ applicationId, currentStatus }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setLoading(true);
    
    try {
      await updateApplicationStatus(applicationId, newStatus);
    } catch (error) {
      console.error("Failed to update status", error);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={loading}
      className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer disabled:cursor-not-allowed transition-colors ${
        status === "accepted" ? "bg-green-100 text-green-800 border-green-200" :
        status === "rejected" ? "bg-red-100 text-red-800 border-red-200" :
        status === "interviewing" ? "bg-blue-100 text-blue-800 border-blue-200" :
        "bg-gray-100 text-gray-800 border-gray-200"
      }`}
    >
      <option value="pending">⏳ Pending</option>
      <option value="interviewing">📞 Interviewing</option>
      <option value="accepted">✅ Hired</option>
      <option value="rejected">❌ Rejected</option>
    </select>
  );
}
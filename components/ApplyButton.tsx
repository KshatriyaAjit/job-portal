"use client";

import { useState } from "react";
import { submitApplication } from "@/app/actions";
import { Loader2, Send, FileText, CheckCircle } from "lucide-react";
import Link from "next/link";

interface Props {
  jobId: string;
  profile: any;
}

export default function ApplyButton({ jobId, profile }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [hasApplied, setHasApplied] = useState(false);

  async function handleApply() {
    if (!profile?.resumeUrl) {
      alert("Please upload a resume in your profile first!");
      return;
    }

    setIsLoading(true);
    try {
      // 👇 Pass coverLetter to server action
      await submitApplication(jobId, profile.resumeUrl, coverLetter);
      setHasApplied(true);
      setIsOpen(false);
    } catch (error) {
      alert("Failed to apply. You may have already applied.");
    } finally {
      setIsLoading(false);
    }
  }

  if (hasApplied) {
    return (
      <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
        <button disabled className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold cursor-not-allowed opacity-90 flex items-center justify-center gap-2 mx-auto">
          <CheckCircle className="w-5 h-5" />
          Application Sent
        </button>
        <Link href="/my-applications" className="text-green-700 text-sm mt-2 font-medium hover:underline block">
            View in My Applications
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition transform hover:-translate-y-1 flex items-center justify-center gap-2"
      >
        Apply Now 🚀
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Complete Application</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Resume Check */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Resume</label>
                {profile?.resumeUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700">
                    <FileText className="w-5 h-5" />
                    <span className="text-sm font-medium truncate">Resume on file</span>
                    <span className="text-xs bg-blue-200 px-2 py-0.5 rounded ml-auto">Ready</span>
                  </div>
                ) : (
                  <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                    ⚠️ No resume found. <Link href="/profile" className="underline font-bold">Upload one here</Link> before applying.
                  </div>
                )}
              </div>

              {/* Cover Letter Input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Cover Letter / Why Hire Me? <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={5}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="I am the perfect fit for this role because..."
                  className="w-full border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleApply}
                  disabled={isLoading || !profile?.resumeUrl}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                  Submit Application
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
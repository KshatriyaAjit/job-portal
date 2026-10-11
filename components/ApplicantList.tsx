"use client";

import { useState } from "react";
import { FileText, Filter, MessageSquare, Quote } from "lucide-react";
import StatusSelect from "@/components/StatusSelect";
import AIScoreButton from "@/components/AIScoreButton";

interface ApplicantListProps {
  applications: any[];
  profiles: any[];
  jobDescription: string;
}

export default function ApplicantList({ applications, profiles, jobDescription }: ApplicantListProps) {
  const [filter, setFilter] = useState("all");
  
  // Track which cover letter is currently expanded (by application ID)
  const [expandedCoverLetter, setExpandedCoverLetter] = useState<string | null>(null);

  const filteredApps = applications.filter((app) => {
    if (filter === "all") return true;
    return app.status === filter;
  });

  return (
    <div className="bg-gray-50 p-4">
      
      {/* Header & Filter Control */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
           <span className="font-bold text-gray-700 text-sm">Candidates</span>
           <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold">
             {filteredApps.length}
           </span>
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none cursor-pointer hover:border-blue-400 transition"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="interviewing">Interviewing</option>
            <option value="accepted">Hired</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {filteredApps.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400 italic">No candidates found with this status.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredApps.map((app) => {
            const candidateProfile = profiles.find((p) => p.userId === app.userId);
            const isExpanded = expandedCoverLetter === app._id.toString();

            return (
              <div key={app._id.toString()} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition">
                
                <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {app.userId.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">Candidate ID: {app.userId.slice(0, 8)}...</p>
                      <p className="text-xs text-gray-500">Applied: {new Date(app.createdAt).toLocaleDateString("en-GB")}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <StatusSelect 
                      applicationId={app._id.toString()} 
                      currentStatus={app.status} 
                    />

                    {/* Resume Button */}
                    <a 
                      href={app.resumeUrl}
                      target="_blank" 
                      rel="noopener noreferrer"
                      title="View Resume"
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 transition"
                    >
                      <FileText className="w-4 h-4" />
                    </a>

                    {/* 👇 Cover Letter Toggle Button */}
                    {app.coverLetter && (
                      <button
                        onClick={() => setExpandedCoverLetter(isExpanded ? null : app._id.toString())}
                        title="View Cover Letter"
                        className={`p-2 rounded-lg border transition ${
                          isExpanded 
                            ? "bg-purple-50 text-purple-600 border-purple-200" 
                            : "text-gray-500 hover:text-purple-600 hover:bg-purple-50 border-gray-200"
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 👇 Cover Letter Section (Expandable) */}
                {isExpanded && app.coverLetter && (
                  <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200 relative animate-in fade-in slide-in-from-top-2">
                    <Quote className="w-8 h-8 text-gray-200 absolute top-2 left-2 -z-0" />
                    <p className="text-sm text-gray-700 whitespace-pre-wrap relative z-10 pl-6 border-l-2 border-purple-300">
                      {app.coverLetter}
                    </p>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3 mt-1">
                  {candidateProfile ? (
                       <AIScoreButton 
                         jobDescription={jobDescription}
                         candidateProfile={{
                           ...candidateProfile,
                           _id: candidateProfile._id,
                           createdAt: candidateProfile.createdAt, 
                           updatedAt: candidateProfile.updatedAt
                         }}
                        />
                  ) : (
                      <p className="text-xs text-gray-400 italic pl-1">
                        Profile incomplete. AI analysis unavailable.
                      </p>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
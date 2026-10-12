"use client";

import { useState } from "react";
import { 
  FileText, 
  Filter, 
  MessageSquare, 
  Quote, 
  Mail, 
  Calendar, 
  Globe, 
  Github, 
  Linkedin, 
  Briefcase,
  ExternalLink,
  ArrowUpDown,
  Download,
  CheckSquare,
  Square,
  Loader2,
  CheckCircle2
} from "lucide-react";
import StatusSelect from "@/components/StatusSelect";
import AIScoreButton from "@/components/AIScoreButton";
import { IAIEvaluation } from "@/models/Application";
import { bulkUpdateApplicationStatus, exportApplicantsCSV } from "@/app/actions";

export interface SerializedApplication {
  _id: string;
  jobId: string;
  userId: string;
  resumeUrl: string;
  coverLetter?: string;
  status: string;
  aiScore?: number;
  aiAnalysis?: IAIEvaluation;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedProfile {
  _id: string;
  userId: string;
  email: string;
  bio?: string;
  skills?: string[];
  resumeUrl?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SerializedUser {
  clerkId: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

interface ApplicantListProps {
  jobId: string;
  jobTitle?: string;
  applications: SerializedApplication[];
  profiles: SerializedProfile[];
  users?: SerializedUser[];
  jobDescription?: string;
}

export default function ApplicantList({
  jobId,
  jobTitle,
  applications,
  profiles,
  users = [],
}: ApplicantListProps) {
  const [localApplications, setLocalApplications] = useState<SerializedApplication[]>(applications);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("interviewing");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedCoverLetter, setExpandedCoverLetter] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Filter and Sort
  const filteredAndSortedApps = [...localApplications]
    .filter((app) => {
      if (filter === "all") return true;
      return app.status === filter;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "score_desc") {
        const scoreA = typeof a.aiScore === "number" ? a.aiScore : -1;
        const scoreB = typeof b.aiScore === "number" ? b.aiScore : -1;
        return scoreB - scoreA;
      }
      if (sortBy === "name_asc") {
        const userA = users.find((u) => u.clerkId === a.userId);
        const userB = users.find((u) => u.clerkId === b.userId);
        const nameA = [userA?.firstName, userA?.lastName].filter(Boolean).join(" ") || userA?.email || a.userId;
        const nameB = [userB?.firstName, userB?.lastName].filter(Boolean).join(" ") || userB?.email || b.userId;
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

  // Bulk Selection Toggles
  const allFilteredSelected =
    filteredAndSortedApps.length > 0 &&
    filteredAndSortedApps.every((app) => selectedIds.includes(app._id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedApps.map((a) => a._id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  // Bulk Status Update Handler
  async function handleBulkUpdate() {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    setActionNotice(null);
    try {
      const result = await bulkUpdateApplicationStatus(selectedIds, bulkStatus);
      if (result.success) {
        setLocalApplications((prev) =>
          prev.map((app) =>
            selectedIds.includes(app._id) ? { ...app, status: bulkStatus } : app
          )
        );
        setActionNotice(`Successfully updated ${result.count} applicants to "${bulkStatus}".`);
        setSelectedIds([]);
        setTimeout(() => setActionNotice(null), 5000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update applicants.";
      alert(msg);
    } finally {
      setIsBulkUpdating(false);
    }
  }

  // CSV Export Handler
  async function handleExportCSV() {
    setIsExporting(true);
    try {
      const res = await exportApplicantsCSV(jobId);
      if (!res.success || !res.csv) {
        throw new Error(res.error || "Failed to generate CSV export.");
      }

      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", res.filename || `applicants-${jobId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "CSV export failed.";
      alert(msg);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        {/* Left: Heading and Stats */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 text-sm">Applicants</span>
          <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
            {localApplications.length}
          </span>
          {jobTitle && (
            <span className="text-xs text-gray-500 font-medium hidden md:inline">
              for {jobTitle}
            </span>
          )}
        </div>

        {/* Right: Controls (Filter, Sort, CSV Export) */}
        {localApplications.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Status */}
            <div className="relative">
              <Filter className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer hover:border-blue-400 transition"
              >
                <option value="all">All Statuses ({localApplications.length})</option>
                <option value="pending">Pending</option>
                <option value="interviewing">Interviewing</option>
                <option value="accepted">Accepted / Hired</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer hover:border-blue-400 transition"
              >
                <option value="newest">Newest Application</option>
                <option value="oldest">Oldest Application</option>
                <option value="score_desc">Highest AI Match Score</option>
                <option value="name_asc">Candidate Name (A-Z)</option>
              </select>
            </div>

            {/* CSV Export Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting}
              title="Export all applicants to CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 hover:text-blue-600 hover:border-blue-300 border border-gray-300 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-gray-500" />
              )}
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Feedback Banner */}
      {actionNotice && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Bulk Action Bar (Visible when 1 or more applicants are selected) */}
      {selectedIds.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              <span>{selectedIds.length} selected</span>
            </button>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Apply status to selected candidates:</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="pending">Pending</option>
              <option value="interviewing">Interviewing</option>
              <option value="accepted">Accepted / Hired</option>
              <option value="rejected">Rejected</option>
            </select>

            <button
              type="button"
              onClick={handleBulkUpdate}
              disabled={isBulkUpdating}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {isBulkUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{isBulkUpdating ? "Updating..." : "Update Selected"}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-gray-500 hover:text-gray-700 px-2 py-1 underline font-medium cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Applicants List */}
      {localApplications.length === 0 ? (
        <div className="text-center py-10 bg-white border border-dashed border-gray-200 rounded-xl p-6">
          <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">No applicants yet</p>
          <p className="text-xs text-gray-400 mt-1">
            When candidates submit applications for this role, their profiles and resumes will appear here.
          </p>
        </div>
      ) : filteredAndSortedApps.length === 0 ? (
        <div className="text-center py-8 bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">No applicants currently matched with status &ldquo;{filter}&rdquo;.</p>
          <button
            onClick={() => setFilter("all")}
            className="text-xs text-blue-600 font-bold hover:underline mt-2 cursor-pointer"
          >
            Show all candidates
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select All Checkbox Row */}
          <div className="flex items-center gap-2 px-1 text-xs text-gray-500">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 hover:text-gray-800 transition font-medium cursor-pointer"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-gray-400" />
              )}
              <span>Select all {filteredAndSortedApps.length} candidates</span>
            </button>
          </div>

          <div className="grid gap-4">
            {filteredAndSortedApps.map((app) => {
              const candidateProfile = profiles.find((p) => p.userId === app.userId);
              const candidateUser = users.find((u) => u.clerkId === app.userId);

              const fullName = [candidateUser?.firstName, candidateUser?.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();

              const displayName =
                fullName ||
                candidateProfile?.email ||
                candidateUser?.email ||
                `Applicant (${app.userId.slice(0, 8)})`;
              const contactEmail = candidateProfile?.email || candidateUser?.email;
              const initials = (fullName || displayName)
                .split(" ")
                .map((p) => p[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              const isExpanded = expandedCoverLetter === app._id;
              const isSelected = selectedIds.includes(app._id);

              return (
                <div
                  key={app._id}
                  className={`bg-white p-5 rounded-xl border transition ${
                    isSelected ? "border-blue-400 bg-blue-50/20 shadow-sm" : "border-gray-200 hover:border-blue-300 shadow-sm"
                  }`}
                >
                  {/* Top Section: Checkbox, Avatar, Candidate Meta, and Actions */}
                  <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3.5">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleSelect(app._id)}
                        className="mt-1 text-gray-400 hover:text-blue-600 transition cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      {/* Avatar */}
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                        {initials}
                      </div>

                      <div>
                        <h4 className="font-bold text-base text-gray-900 leading-tight">
                          {displayName}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                          {contactEmail && (
                            <span className="flex items-center gap-1 text-gray-600 font-medium">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              <a
                                href={`mailto:${contactEmail}`}
                                className="hover:text-blue-600 hover:underline"
                              >
                                {contactEmail}
                              </a>
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-gray-400">
                            <Calendar className="w-3.5 h-3.5" />
                            Applied{" "}
                            {new Date(app.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Status Select, Resume Link, Cover Letter Button */}
                    <div className="flex items-center gap-2 self-start md:self-center">
                      <StatusSelect
                        applicationId={app._id}
                        currentStatus={app.status}
                      />

                      {/* Resume Button */}
                      <a
                        href={app.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Verified Resume (PDF)"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Resume</span>
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                      </a>

                      {/* Cover Letter Button */}
                      {app.coverLetter && (
                        <button
                          type="button"
                          onClick={() => setExpandedCoverLetter(isExpanded ? null : app._id)}
                          title="View Cover Letter"
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            isExpanded
                              ? "bg-purple-100 text-purple-700 border-purple-300"
                              : "bg-gray-50 text-gray-700 hover:bg-purple-50 hover:text-purple-700 border-gray-200"
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Cover Letter</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Candidate Bio & Social Links */}
                  {candidateProfile &&
                    (candidateProfile.bio ||
                      (candidateProfile.skills && candidateProfile.skills.length > 0) ||
                      candidateProfile.linkedin ||
                      candidateProfile.github ||
                      candidateProfile.portfolio) && (
                      <div className="bg-gray-50 p-3.5 rounded-lg mb-3 text-xs border border-gray-100 space-y-2">
                        {candidateProfile.bio && (
                          <p className="text-gray-700 leading-relaxed italic">
                            &ldquo;{candidateProfile.bio}&rdquo;
                          </p>
                        )}

                        {candidateProfile.skills && candidateProfile.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {candidateProfile.skills.map((skill, i) => (
                              <span
                                key={i}
                                className="bg-white text-gray-700 px-2.5 py-0.5 rounded-md border border-gray-200 text-[11px] font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Social/Portfolio Links */}
                        {(candidateProfile.linkedin ||
                          candidateProfile.github ||
                          candidateProfile.portfolio) && (
                          <div className="flex flex-wrap gap-3 pt-1 text-gray-500">
                            {candidateProfile.linkedin && (
                              <a
                                href={candidateProfile.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-blue-600 transition"
                              >
                                <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                              </a>
                            )}
                            {candidateProfile.github && (
                              <a
                                href={candidateProfile.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-gray-900 transition"
                              >
                                <Github className="w-3.5 h-3.5" /> GitHub
                              </a>
                            )}
                            {candidateProfile.portfolio && (
                              <a
                                href={candidateProfile.portfolio}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-purple-600 transition"
                              >
                                <Globe className="w-3.5 h-3.5" /> Portfolio
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  {/* Cover Letter Accordion */}
                  {isExpanded && app.coverLetter && (
                    <div className="mb-3 bg-purple-50/50 p-4 rounded-lg border border-purple-100 relative">
                      <Quote className="w-6 h-6 text-purple-200 absolute top-2 left-2" />
                      <p className="text-xs text-gray-800 whitespace-pre-wrap relative z-10 pl-5 border-l-2 border-purple-400 font-sans leading-relaxed">
                        {app.coverLetter}
                      </p>
                    </div>
                  )}

                  {/* AI Match Score Trigger & Display */}
                  <div className="border-t border-gray-100 pt-3">
                    <AIScoreButton
                      applicationId={app._id}
                      jobId={jobId}
                      candidateProfile={{
                        bio: candidateProfile?.bio,
                        skills: candidateProfile?.skills,
                        userId: candidateProfile?.userId,
                      }}
                      cachedScore={app.aiScore}
                      cachedAnalysis={app.aiAnalysis}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import { saveProfile } from "@/app/actions";
import { Upload, Save, Loader2, X } from "lucide-react";
import { ProfileData } from "./ProfileWrapper";

interface ProfileFormProps {
  initialData: Partial<ProfileData>;
  userId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ProfileForm({ initialData, onSuccess, onCancel }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    email: initialData?.email || "",
    bio: initialData?.bio || "",
    skills: initialData?.skills?.join(", ") || "",
    linkedin: initialData?.linkedin || "",
    github: initialData?.github || "",
    portfolio: initialData?.portfolio || "",
    resumeUrl: initialData?.resumeUrl || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size and type validation
    if (file.size > 10 * 1024 * 1024) {
      alert("❌ Resume file size must be under 10MB.");
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("❌ Only PDF documents are accepted.");
      return;
    }

    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "jobportal_preset");

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      if (!cloudName) {
        throw new Error("Cloudinary cloud name is not configured.");
      }

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: data,
      });

      const json = await res.json();

      if (!res.ok || !json.secure_url) {
        throw new Error(json.error?.message || "Upload rejected by Cloudinary.");
      }

      setFormData((prev) => ({ ...prev, resumeUrl: json.secure_url }));
      alert("✅ Resume Uploaded Successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      console.error("Resume Upload Error:", message);
      alert(`❌ Upload failed: ${message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const submissionData = new FormData();
      submissionData.append("email", formData.email);
      submissionData.append("bio", formData.bio);
      submissionData.append("skills", formData.skills);
      submissionData.append("linkedin", formData.linkedin);
      submissionData.append("github", formData.github);
      submissionData.append("portfolio", formData.portfolio);
      submissionData.append("resumeUrl", formData.resumeUrl);

      await saveProfile(submissionData);
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save profile";
      console.error(message);
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
      
      {/* Cancel Button */}
      <button type="button" onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer">
        <X className="w-6 h-6" />
      </button>

      <h2 className="text-xl font-bold mb-4">Edit Profile</h2>

      {/* Bio */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Professional Bio</label>
        <textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          rows={4}
          className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Tell recruiters about yourself..."
        />
      </div>

      {/* Skills */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Skills (Comma separated)</label>
        <input
          name="skills"
          value={formData.skills}
          onChange={handleChange}
          className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="e.g. React, Node.js, TypeScript, MongoDB"
        />
      </div>

      {/* Social Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">LinkedIn URL</label>
          <input
            name="linkedin"
            value={formData.linkedin}
            onChange={handleChange}
            className="w-full border rounded-lg p-3"
            placeholder="https://linkedin.com/in/..."
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">GitHub URL</label>
          <input
            name="github"
            value={formData.github}
            onChange={handleChange}
            className="w-full border rounded-lg p-3"
            placeholder="https://github.com/..."
          />
        </div>
      </div>

      {/* Resume Upload */}
      <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 text-center">
        <label className="block text-sm font-bold text-gray-900 mb-2">Resume (PDF)</label>
        {formData.resumeUrl && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-green-600 font-bold text-sm">✅ Resume on File</span>
          </div>
        )}
        <label className={`${uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"} bg-white border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 inline-flex items-center gap-2`}>
          {uploading ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading..." : "Upload New Resume (PDF)"}
          <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-lg hover:bg-gray-200 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || uploading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
          Save Profile
        </button>
      </div>
    </form>
  );
}
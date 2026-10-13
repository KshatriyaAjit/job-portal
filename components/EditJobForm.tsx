"use client";

import { useState } from "react";
import { updateJob } from "@/app/actions";
import RichTextEditor from "@/components/RichTextEditor";
import { AlertCircle, Loader2 } from "lucide-react";
import { JOB_CATEGORIES } from "@/lib/categories";

interface EditJobFormProps {
  job: {
    _id: string;
    title: string;
    companyName: string;
    location: string;
    salary: number;
    jobType: string;
    category?: string;
    description: string;
  };
}

export default function EditJobForm({ job }: EditJobFormProps) {
  const [description, setDescription] = useState(job.description);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bind the Job ID to the server action so it knows which job to update
  const updateJobWithId = updateJob.bind(null, job._id);


async function handleSubmit(formData: FormData) {
  setErrorMessage(null);

  const plainText = description.replace(/<[^>]*>/g, " ").trim();

  if (!plainText) {
    setErrorMessage("Job description cannot be empty.");
    return;
  }

  setIsSubmitting(true);

  // Append the rich-text description to FormData.
  formData.set("description", description);

  try {
    // updateJob redirects to /dashboard after a successful update.
    await updateJobWithId(formData);
  } catch (err: unknown) {
    // A Next.js redirect is represented internally by NEXT_REDIRECT.
    // Let Next.js handle that redirect instead of displaying an error.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }

    console.error("Update error:", err);

    const msg =
      err instanceof Error
        ? err.message
        : "Failed to update job posting. Please try again.";

    setErrorMessage(msg);
  } finally {
    setIsSubmitting(false);
  }
}


  return (
    <form action={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Cannot Update Job</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}
        
      {/* Title */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Job Title</label>
        <input 
            type="text" 
            name="title" 
            defaultValue={job.title}
            required 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
          />
        </div>

        {/* Company & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Company Name</label>
            <input 
              type="text" 
              name="companyName" 
              defaultValue={job.companyName}
              required 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Location</label>
            <input 
              type="text" 
              name="location" 
              defaultValue={job.location}
              required 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
        </div>

        {/* Salary, Type & Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Annual Salary ($)</label>
            <input 
              type="number" 
              name="salary" 
              defaultValue={job.salary}
              min="1"
              max="50000000"
              required 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Job Type</label>
            <select 
              name="jobType" 
              defaultValue={job.jobType}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Job Category</label>
            <select 
              name="category" 
              defaultValue={job.category || "Other"}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
            >
              {JOB_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rich Text Description */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Job Description</label>
          <RichTextEditor value={description} onChange={setDescription} />
        </div>

        <div className="pt-4">
            <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Updating Job Posting...</span>
                  </>
                ) : (
                  <span>Update Job Posting</span>
                )}
            </button>
        </div>
      </form>
  );
}
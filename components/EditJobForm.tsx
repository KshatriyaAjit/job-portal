"use client";

import { useState } from "react";
import { updateJob } from "@/app/actions";
import RichTextEditor from "@/components/RichTextEditor";

interface EditJobFormProps {
  job: {
    _id: string;
    title: string;
    companyName: string;
    location: string;
    salary: number;
    jobType: string;
    description: string;
  };
}

export default function EditJobForm({ job }: EditJobFormProps) {
  const [description, setDescription] = useState(job.description);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bind the Job ID to the server action so it knows which job to update
  const updateJobWithId = updateJob.bind(null, job._id);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    
    // 👇 Vital: Manually append the rich text description to FormData
    formData.set("description", description);

    // Call the server action
    await updateJobWithId(formData);
    
    // The action usually redirects, but we stop loading just in case
    setIsSubmitting(false); 
  }

  return (
    <form action={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        
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

        {/* Salary & Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Annual Salary ($)</label>
            <input 
              type="number" 
              name="salary" 
              defaultValue={job.salary}
              required 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Job Type</label>
            <select 
              name="jobType" 
              defaultValue={job.jobType}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </div>
        </div>

        {/* Rich Text Description */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Job Description</label>
          {/* 👇 Using the RichTextEditor with state */}
          <RichTextEditor value={description} onChange={setDescription} />
        </div>

        <div className="pt-4">
            <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSubmitting ? "Updating..." : "Update Job Posting"}
            </button>
        </div>
      </form>
  );
}
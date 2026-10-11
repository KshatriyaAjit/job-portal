"use client";

import { useState } from "react";
import { createJob } from "@/app/actions"; // Imports the Server Action
import RichTextEditor from "@/components/RichTextEditor";
import { useRouter } from "next/navigation";

export default function PostJobPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    
    // Append the rich text description to the form data manually
    formData.set("description", description);

    try {
      const result = await createJob(formData);

      if (result.success) {
        router.push("/dashboard");
      }
    
    } catch (error) {
      console.error("Submission Error:", error);
      setIsSubmitting(false);
      alert("Failed to post job. Please try again.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 font-sans">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Post a New Job</h1>
      
      <form action={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-200">
        
        {/* Title */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Job Title</label>
          <input 
            type="text" 
            name="title" 
            placeholder="e.g. Senior React Developer"
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
              placeholder="e.g. TechCorp Inc."
              required 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Location</label>
            <input 
              type="text" 
              name="location" 
              placeholder="e.g. Remote, New York, Mumbai"
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
              placeholder="e.g. 80000"
              required 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Job Type</label>
            <select 
              name="jobType" 
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
          {/* 👇 Using our new component */}
          <RichTextEditor value={description} onChange={setDescription} />
        </div>

        <div className="pt-4">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Posting..." : "Post Job Now"}
          </button>
        </div>

      </form>
    </div>
  );
}
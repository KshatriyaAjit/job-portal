import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import Application from "@/models/Application";
import Profile from "@/models/Profile";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import ApplyButton from "@/components/ApplyButton";
import { ArrowRight, Briefcase, MapPin } from "lucide-react";
import { sanitizeRichText } from "@/lib/sanitize";
import { getAuthenticatedUser } from "@/lib/auth";
import mongoose from "mongoose";

interface JobPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailsPage({ params }: JobPageProps) {
  const { id } = await params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    notFound();
  }
  
  const { userId } = await auth();
  const authContext = await getAuthenticatedUser();
  const userRole = authContext?.role;

  await connectDB();
  
  // 1. Fetch Current Job and Increment Views
  const job = await Job.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true }
  );
  
  if (!job) notFound();

  // 2. Fetch Similar Jobs (Same Job Type, excluding current job)
  const similarJobs = await Job.find({
    _id: { $ne: id },     // Not the current job
    jobType: job.jobType, // Matches the same type (e.g. Full-time)
  })
  .limit(3)
  .sort({ createdAt: -1 });

  // 3. Fetch Candidate Profile (for Quick Apply)
  let profile = null;
  if (userId) {
    const profileDoc = await Profile.findOne({ userId }).lean();
    if (profileDoc) {
        profile = {
            ...profileDoc,
            _id: profileDoc._id.toString(),
            createdAt: profileDoc.createdAt?.toISOString(),
            updatedAt: profileDoc.updatedAt?.toISOString(),
        };
    }
  }

  // 4. Check if already applied
  let hasApplied = false;
  if (userId) {
    const existingApplication = await Application.findOne({ jobId: id, userId });
    hasApplied = !!existingApplication;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      
      {/* 👇 CHANGED: Increased max-width to 7xl so it takes up more screen space */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Back Link */}
        <Link href="/" className="text-gray-500 hover:text-blue-600 mb-6 inline-block font-medium transition">
          &larr; Back to Jobs
        </Link>

        {/* Grid Layout: Main Content (2/3) | Sidebar (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Main Job Details (Takes 8 out of 12 columns) */}
          <div className="lg:col-span-8">
              <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8 shadow-sm">
                  
                  {/* Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div>
                          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-gray-900">{job.title}</h1>
                          <p className="text-xl text-gray-500 font-medium">{job.companyName}</p>
                      </div>
                      <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-lg font-bold border border-green-200 whitespace-nowrap">
                          ${job.salary.toLocaleString()}
                      </span>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 mb-8 text-gray-600">
                      <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200 font-medium text-sm">
                          <MapPin className="w-4 h-4" /> {job.location}
                      </span>
                      <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200 font-medium text-sm">
                          <Briefcase className="w-4 h-4" /> {job.jobType}
                      </span>
                      {job.category && (
                        <span className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-md border border-purple-200 font-medium text-sm">
                            🏷️ {job.category}
                        </span>
                      )}
                  </div>

                  {/* Description */}
                  {/* 👇 ADDED: break-words to prevent text overflowing the card */}
                  <div className="mb-10 text-gray-700 leading-relaxed break-words">
                      <h3 className="text-xl font-bold mb-4 text-gray-900">Job Description</h3>
                      <div 
                          className="prose max-w-none text-gray-600"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichText(job.description) }} 
                      />
                  </div>

                  {/* Apply Section */}
                  <div className="border-t border-gray-100 pt-8">
                      <SignedOut>
                          <div className="bg-gray-50 p-6 rounded-xl text-center border border-gray-200">
                          <p className="mb-4 text-gray-600 font-medium">Sign in to apply for this position.</p>
                          <SignInButton mode="modal">
                              <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold transition shadow-sm hover:shadow-md cursor-pointer">
                              Sign In to Apply
                              </button>
                          </SignInButton>
                          </div>
                      </SignedOut>

                      <SignedIn>
                          {userRole === 'recruiter' ? (
                              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-center font-bold">
                                  🚫 Recruiters cannot apply to jobs.
                              </div>
                          ) : hasApplied ? (
                              <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                                  <button disabled className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold cursor-not-allowed opacity-90 flex items-center justify-center gap-2 mx-auto">
                                  ✅ Application Sent
                                  </button>
                                  <Link href="/my-applications" className="text-green-700 text-sm mt-2 font-medium hover:underline block">
                                      View in My Applications
                                  </Link>
                              </div>
                          ) : (
                              <ApplyButton jobId={id} profile={profile} /> 
                          )}
                      </SignedIn>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: Similar Jobs Sidebar (Takes 4 out of 12 columns) */}
          <div className="lg:col-span-4 space-y-6">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
                  Similar Jobs
              </h3>
              
              {similarJobs.length === 0 ? (
                  <div className="text-gray-400 text-sm italic border rounded-lg p-4 bg-white text-center">
                      No similar jobs found.
                  </div>
              ) : (
                  <div className="flex flex-col gap-4">
                      {similarJobs.map((simJob) => (
                          <Link href={`/jobs/${simJob._id}`} key={simJob._id.toString()} className="block group">
                              <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                                  <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition text-lg line-clamp-1">
                                      {simJob.title}
                                  </h4>
                                  <p className="text-sm text-gray-500 mb-3">{simJob.companyName}</p>
                                  
                                  <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600">
                                      <span className="bg-gray-100 px-2 py-1 rounded">
                                          {simJob.location}
                                      </span>
                                      <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                                          ${simJob.salary.toLocaleString()}
                                      </span>
                                  </div>
                                  
                                  <div className="mt-4 flex items-center text-blue-600 text-sm font-bold group-hover:gap-2 transition-all">
                                      View Details <ArrowRight className="w-4 h-4 ml-1" />
                                  </div>
                              </div>
                          </Link>
                      ))}
                  </div>
              )}
          </div>

        </div>
      </div>
    </div>
  );
}
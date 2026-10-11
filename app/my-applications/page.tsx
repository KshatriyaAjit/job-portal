import { connectDB } from "@/lib/db";
import Application from "@/models/Application";
import Job from "@/models/Job"; // 👈 Important: Must import Job so Mongoose knows about it
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, MapPin, Calendar, Building2, Clock, Phone, CheckCircle, XCircle } from "lucide-react";

export default async function MyApplicationsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/candidate-login");

  await connectDB();

  // 1. Fetch applications & Populate Job Details
  // .populate("jobId") acts like a SQL JOIN. It replaces the 'jobId' string with the actual Job object.
  const applications = await Application.find({ userId })
    .populate("jobId") 
    .sort({ createdAt: -1 });

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <Link href="/">
             <button className="text-sm font-medium text-blue-600 hover:underline">
               Browse more jobs &rarr;
             </button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        
        {applications.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-blue-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No applications yet</h3>
            <p className="text-gray-500 mt-2 mb-6">Start applying to jobs to track them here.</p>
            
            <Link href="/">
              <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition">
                Find a Job
              </button>
            </Link>
          </div>
        ) : (
          /* Applications List */
          <div className="space-y-4">
            {applications.map((app) => {
              // Handle case where job was deleted by recruiter
              if (!app.jobId) return null;

              const job = app.jobId;

              // Helper for Status Badge styling
              const getStatusBadge = (status: string) => {
                switch(status) {
                    case "interviewing":
                        return (
                            <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                                <Phone className="w-3 h-3" /> Interviewing
                            </span>
                        );
                    case "accepted":
                        return (
                            <span className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                                <CheckCircle className="w-3 h-3" /> Hired
                            </span>
                        );
                    case "rejected":
                        return (
                            <span className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">
                                <XCircle className="w-3 h-3" /> Rejected
                            </span>
                        );
                    default: // pending
                        return (
                            <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold border border-yellow-200">
                                <Clock className="w-3 h-3" /> Pending
                            </span>
                        );
                }
              };

              return (
                <div key={app._id.toString()} className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    
                    {/* Job Info */}
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-1">
                        {job.title}
                      </h2>
                      <div className="flex items-center gap-2 text-gray-600 text-sm mb-3">
                        <Building2 className="w-4 h-4" />
                        <span className="font-medium">{job.companyName}</span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                         <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {job.location}
                         </span>
                         <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Applied: {new Date(app.createdAt).toLocaleDateString("en-GB")}
                         </span>
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div className="flex flex-col items-end gap-3 min-w-[120px]">
                        {getStatusBadge(app.status)}
                        
                        <Link href={`/jobs/${job._id}`} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition">
                            View Job &rarr;
                        </Link>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
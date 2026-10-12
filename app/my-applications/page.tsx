import { connectDB } from "@/lib/db";
import Application from "@/models/Application";
import Job, { IJob } from "@/models/Job";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, MapPin, Calendar, Building2, Clock, Phone, CheckCircle, XCircle } from "lucide-react";

export default async function MyApplicationsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/candidate-login");

  await connectDB();

  // Make sure Job model is registered in Mongoose
  if (!Job) {
    console.warn("Job model not loaded");
  }

  // 1. Fetch applications & Populate Job Details
  const rawApplications = await Application.find({ userId })
    .populate<{ jobId: IJob | null }>("jobId")
    .sort({ createdAt: -1 });

  // Filter out any applications where the job was deleted by the recruiter
  const applications = rawApplications.filter(
    (app): app is typeof app & { jobId: IJob } => Boolean(app.jobId)
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Browse more jobs &rarr;
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        {applications.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 p-8">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-blue-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No applications yet</h3>
            <p className="text-gray-500 mt-2 mb-6 text-sm max-w-md mx-auto">
              Start exploring open positions and submit applications to track them here.
            </p>
            
            <Link 
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm text-sm"
            >
              Find a Job Now &rarr;
            </Link>
          </div>
        ) : (
          /* Applications List */
          <div className="space-y-4">
            {applications.map((app) => {
              const job = app.jobId;

              const getStatusBadge = (status: string) => {
                switch (status) {
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
                  default:
                    return (
                      <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold border border-yellow-200">
                        <Clock className="w-3 h-3" /> Pending Review
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
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{job.companyName}</span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" /> {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" /> Applied: {new Date(app.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div className="flex flex-col items-end gap-3 min-w-[120px]">
                      {getStatusBadge(app.status)}
                      
                      <Link 
                        href={`/jobs/${job._id.toString()}`} 
                        className="text-sm font-bold text-blue-600 hover:text-blue-800 transition"
                      >
                        View Job Listing &rarr;
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
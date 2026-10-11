import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import Application from "@/models/Application";
import Profile from "@/models/Profile";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, MapPin, Calendar, Pencil, Trash2, Eye } from "lucide-react"; // 👈 Added Eye icon
import { deleteJob } from "@/app/actions";
import ApplicantList from "@/components/ApplicantList";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  await connectDB();

  const jobs = await Job.find({ clerkId: userId }).sort({ createdAt: -1 });
  
  const jobIds = jobs.map((job) => job._id);
  const applications = await Application.find({ jobId: { $in: jobIds } });

  const applicantIds = applications.map(app => app.userId);
  const profiles = await Profile.find({ userId: { $in: applicantIds } }).lean();

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-20 z-40">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recruiter Dashboard</h1>
            <p className="text-sm text-gray-500">Manage your job postings and view candidates</p>
          </div>
          <Link href="/post-job">
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition shadow-sm">
              <Plus className="w-5 h-5" />
              Post New Job
            </button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        
        {jobs.length === 0 ? (
          /* EMPTY STATE */
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="text-blue-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No jobs posted yet</h3>
            <p className="text-gray-500 mt-2 mb-6">Create your first job listing to start receiving applications.</p>
            <Link href="/post-job">
              <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition">
                Create Job Listing &rarr;
              </button>
            </Link>
          </div>
        ) : (
          /* JOBS LIST */
          <div className="space-y-6">
            {jobs.map((job) => {
              // Prepare data for the specific job
              const jobApplications = applications.filter(
                (app) => app.jobId.toString() === job._id.toString()
              );

              // Convert Mongoose objects to plain JS objects for the client component
              const plainApplications = jobApplications.map(app => ({
                ...app.toObject(),
                _id: app._id.toString(),
                jobId: app.jobId.toString(),
                createdAt: app.createdAt.toISOString(),
                updatedAt: app.updatedAt.toISOString(),
              }));

              const plainProfiles = profiles.map(p => ({
                 ...p,
                 _id: p._id.toString(),
                 createdAt: p.createdAt?.toISOString(),
                 updatedAt: p.updatedAt?.toISOString(),
              }));

              return (
                <div key={job._id.toString()} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  
                  {/* Job Card Header */}
                  <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.location}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(job.createdAt).toLocaleDateString()}</span>
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200 text-xs font-bold">
                          ${job.salary.toLocaleString()}
                        </span>
                        {/* 👇 ADDED: View Counter */}
                        <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 text-xs font-bold">
                           <Eye className="w-3 h-3" /> {job.views || 0} Views
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Link href={`/jobs/${job._id}/edit`}>
                        <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition border border-gray-200">
                            <Pencil className="w-4 h-4" />
                            <span className="text-sm font-medium">Edit</span>
                        </button>
                      </Link>

                      <form action={deleteJob.bind(null, job._id.toString())}>
                        <button 
                            type="submit"
                            className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition border border-red-200"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Delete</span>
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Applicant List */}
                  <ApplicantList 
                    applications={plainApplications} 
                    profiles={plainProfiles}
                    jobDescription={job.description} 
                  />

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
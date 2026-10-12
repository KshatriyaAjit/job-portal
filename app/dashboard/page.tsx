import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import Application from "@/models/Application";
import Profile from "@/models/Profile";
import User from "@/models/User";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, MapPin, Calendar, Pencil, Eye, Briefcase } from "lucide-react";
import { deleteJob } from "@/app/actions";
import ApplicantList from "@/components/ApplicantList";
import DeleteConfirmButton from "@/components/DeleteConfirmButton";
import { getAuthenticatedUser } from "@/lib/auth";

export default async function DashboardPage() {
  const authContext = await getAuthenticatedUser();
  if (!authContext) {
    redirect("/recruiter-login");
  }
  if (authContext.role !== "recruiter") {
    redirect("/recruiter-onboarding");
  }

  const userId = authContext.userId;

  await connectDB();

  // 1. Fetch only jobs owned by this recruiter
  const jobs = await Job.find({ clerkId: userId }).sort({ createdAt: -1 });
  
  const jobIds = jobs.map((job) => job._id);
  const applications = await Application.find({ jobId: { $in: jobIds } }).sort({ createdAt: -1 });

  const applicantIds = applications.map((app) => app.userId);

  // 2. Resolve both candidate Profile and User records in parallel
  const [profiles, applicantUsers] = await Promise.all([
    Profile.find({ userId: { $in: applicantIds } }).lean(),
    User.find({ clerkId: { $in: applicantIds } }).select("clerkId firstName lastName email").lean(),
  ]);

  const plainUsers = applicantUsers.map((u) => ({
    clerkId: u.clerkId,
    firstName: u.firstName || undefined,
    lastName: u.lastName || undefined,
    email: u.email,
  }));

  const plainProfiles = profiles.map((p) => ({
    ...p,
    _id: p._id.toString(),
    createdAt: p.createdAt?.toISOString(),
    updatedAt: p.updatedAt?.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-20 z-40">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recruiter Dashboard</h1>
            <p className="text-sm text-gray-500">Manage your job postings and view candidate applicants</p>
          </div>
          <Link href="/post-job">
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold transition shadow-sm cursor-pointer">
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
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 p-8">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="text-blue-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No jobs posted yet</h3>
            <p className="text-gray-500 mt-2 mb-6 text-sm max-w-md mx-auto">
              Create your first job listing to start receiving applications and matching candidates with AI.
            </p>
            <Link href="/post-job">
              <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition cursor-pointer">
                Post a Job Now &rarr;
              </button>
            </Link>
          </div>
        ) : (
          /* JOB LISTINGS */
          <div className="space-y-6">
            {jobs.map((job) => {
              const jobApplications = applications.filter(
                (app) => app.jobId.toString() === job._id.toString()
              );

              const plainApplications = jobApplications.map((app) => ({
                _id: app._id.toString(),
                jobId: app.jobId.toString(),
                userId: app.userId,
                resumeUrl: app.resumeUrl,
                coverLetter: app.coverLetter || undefined,
                status: app.status,
                aiScore: typeof app.aiScore === "number" ? app.aiScore : undefined,
                aiAnalysis: app.aiAnalysis
                  ? {
                      overallScore: app.aiAnalysis.overallScore,
                      skillAlignment: {
                        score: app.aiAnalysis.skillAlignment?.score ?? app.aiAnalysis.overallScore,
                        matchedSkills: app.aiAnalysis.skillAlignment?.matchedSkills || [],
                        missingSkills: app.aiAnalysis.skillAlignment?.missingSkills || [],
                      },
                      experienceAlignment: {
                        score: app.aiAnalysis.experienceAlignment?.score ?? app.aiAnalysis.overallScore,
                        assessment: app.aiAnalysis.experienceAlignment?.assessment || "",
                      },
                      qualificationsAlignment: {
                        score: app.aiAnalysis.qualificationsAlignment?.score ?? app.aiAnalysis.overallScore,
                        assessment: app.aiAnalysis.qualificationsAlignment?.assessment || "",
                      },
                      keyStrengths: app.aiAnalysis.keyStrengths || [],
                      recommendations: app.aiAnalysis.recommendations || "",
                      summary: app.aiAnalysis.summary || "",
                      evaluatedAt: app.aiAnalysis.evaluatedAt instanceof Date 
                        ? app.aiAnalysis.evaluatedAt.toISOString() 
                        : String(app.aiAnalysis.evaluatedAt || ""),
                    }
                  : undefined,
                createdAt: app.createdAt.toISOString(),
                updatedAt: app.updatedAt.toISOString(),
              }));

              return (
                <div 
                  key={job._id.toString()} 
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition hover:shadow-md"
                >
                  {/* Job Header */}
                  <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-gray-400" /> {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" /> {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                        <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded border border-green-200 text-xs font-bold">
                          ${job.salary.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded border border-purple-100 text-xs font-bold">
                          <Eye className="w-3.5 h-3.5" /> {job.views || 0} Views
                        </span>
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded border border-blue-100 text-xs font-bold">
                          {jobApplications.length} {jobApplications.length === 1 ? "Applicant" : "Applicants"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Link href={`/jobs/${job._id.toString()}/edit`}>
                        <button className="flex items-center gap-1.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition border border-gray-200 text-sm font-medium cursor-pointer">
                          <Pencil className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                      </Link>

                      <DeleteConfirmButton 
                        itemId={job._id.toString()}
                        itemTitle={job.title}
                        itemType="job listing"
                        onDelete={deleteJob}
                      />
                    </div>
                  </div>

                  {/* Applicant List with Candidate Details */}
                  <div className="p-6 bg-gray-50/50">
                    <ApplicantList 
                      jobId={job._id.toString()}
                      jobTitle={job.title}
                      applications={plainApplications} 
                      profiles={plainProfiles}
                      users={plainUsers}
                    />
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
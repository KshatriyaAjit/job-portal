import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import Profile from "@/models/Profile";
import Application from "@/models/Application";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ShieldAlert, Trash2, Users, Briefcase, FileText } from "lucide-react";
import { adminDeleteJob } from "@/app/actions";
import Link from "next/link";

export default async function AdminDashboard() {
  const user = await currentUser();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  // 🔒 Security Gate: Kick out anyone who isn't the admin
  if (!user || user.emailAddresses[0].emailAddress !== adminEmail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <ShieldAlert className="w-20 h-20 text-red-600 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-500 mt-2">You do not have permission to view this page.</p>
        <Link href="/" className="mt-6 text-blue-600 hover:underline">Go Home</Link>
      </div>
    );
  }

  await connectDB();

  // Fetch Stats
  const jobCount = await Job.countDocuments();
  const userCount = await Profile.countDocuments(); // Approximate candidate count
  const appCount = await Application.countDocuments();

  // Fetch All Jobs (Sorted by Newest)
  const jobs = await Job.find({}).sort({ createdAt: -1 });

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      
      {/* Admin Header */}
      <div className="bg-gray-900 text-white py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="text-red-500 w-8 h-8" />
            <h1 className="text-3xl font-bold">Admin Console</h1>
          </div>
          <p className="text-gray-400">Master control view. Use with caution.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
               <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900">{jobCount}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-full text-purple-600">
               <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase">Candidates</p>
              <p className="text-3xl font-bold text-gray-900">{userCount}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600">
               <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold uppercase">Applications</p>
              <p className="text-3xl font-bold text-gray-900">{appCount}</p>
            </div>
          </div>
        </div>

        {/* Content Moderation Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Manage Jobs</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold border-b">Job Title</th>
                  <th className="p-4 font-bold border-b">Company</th>
                  <th className="p-4 font-bold border-b">Date Posted</th>
                  <th className="p-4 font-bold border-b text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job._id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-bold text-gray-900">
                      <Link href={`/jobs/${job._id}`} className="hover:text-blue-600 hover:underline">
                        {job.title}
                      </Link>
                    </td>
                    <td className="p-4">{job.companyName}</td>
                    <td className="p-4">{new Date(job.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="p-4 text-right">
                      {/* Server Action Form for Instant Delete */}
                      <form action={adminDeleteJob.bind(null, job._id.toString())}>
                        <button className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded font-bold transition flex items-center gap-1 ml-auto">
                          <Trash2 className="w-4 h-4" /> Force Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {jobs.length === 0 && (
                <div className="p-8 text-center text-gray-500">No jobs found in the database.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
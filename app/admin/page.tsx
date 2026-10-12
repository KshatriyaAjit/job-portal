import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import Profile from "@/models/Profile";
import Application from "@/models/Application";
import { currentUser } from "@clerk/nextjs/server";
import User from "@/models/User";
import { ShieldAlert, Users, Briefcase, FileText, UserCheck, Clock } from "lucide-react";
import { adminDeleteJob } from "@/app/actions";
import { isConfiguredAdmin } from "@/lib/auth";
import Link from "next/link";
import DeleteConfirmButton from "@/components/DeleteConfirmButton";
import AdminRecruiterDecisionButtons from "@/components/AdminRecruiterDecisionButtons";
import AdminRoleToggleButton from "@/components/AdminRoleToggleButton";
import { serializeAdminJob, serializeAdminUser, AdminJobDTO, AdminUserDTO } from "@/lib/dto";

export default async function AdminDashboard() {
  const user = await currentUser();
  const primaryEmail = user?.emailAddresses?.[0]?.emailAddress;

  // 🔒 Security Gate: Kick out anyone who isn't the designated admin
  if (!user || !isConfiguredAdmin(primaryEmail)) {
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

  // Fetch All Jobs and Users using .lean() for raw plain objects
  const [rawJobs, rawUsers] = await Promise.all([
    Job.find({}).sort({ createdAt: -1 }).lean(),
    User.find({}).sort({ createdAt: -1 }).lean(),
  ]);

  // Transform database records into strictly serializable DTOs at the server/client boundary
  const jobs: AdminJobDTO[] = rawJobs.map(serializeAdminJob);
  const users: AdminUserDTO[] = rawUsers.map(serializeAdminUser);

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
                  <tr key={job.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-bold text-gray-900">
                      <Link href={`/jobs/${job.id}`} className="hover:text-blue-600 hover:underline">
                        {job.title}
                      </Link>
                    </td>
                    <td className="p-4">{job.companyName}</td>
                    <td className="p-4">
                      {job.createdAt ? new Date(job.createdAt).toLocaleDateString("en-GB") : "Recently"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end">
                        <DeleteConfirmButton
                          itemId={job.id}
                          itemTitle={job.title}
                          itemType="job listing (Admin Force Delete)"
                          buttonText="Force Delete"
                          onDelete={adminDeleteJob}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded font-bold transition flex items-center gap-1 border border-red-200 text-xs"
                        />
                      </div>
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

        {/* Pending Recruiter Applications Section */}
        {(() => {
          const pendingApplications = users.filter(
            (u) =>
              u.recruiterStatus === "pending" &&
              Boolean(u.companyName && u.companyName.trim().length >= 2)
          );
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-10">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span>Pending Recruiter Applications</span>
                    {pendingApplications.length > 0 && (
                      <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        {pendingApplications.length} Pending
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Review and approve or reject candidate requests to post jobs and access applicant data
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-medium">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>{pendingApplications.length} Awaiting Approval</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                {pendingApplications.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-bold border-b">Applicant</th>
                        <th className="p-4 font-bold border-b">Company / Org</th>
                        <th className="p-4 font-bold border-b">Scope / Reason</th>
                        <th className="p-4 font-bold border-b">Requested At</th>
                        <th className="p-4 font-bold border-b text-right">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                      {pendingApplications.map((u) => (
                        <tr key={u.clerkId} className="hover:bg-gray-50 transition">
                          <td className="p-4 font-bold text-gray-900">
                            {u.email}
                            <span className="block font-mono text-xs font-normal text-gray-400">
                              {u.clerkId}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-gray-900">
                            {u.companyName}
                          </td>
                          <td className="p-4 text-xs text-gray-600 max-w-xs truncate">
                            {u.recruiterReason || "—"}
                          </td>
                          <td className="p-4 text-xs text-gray-500">
                            {u.recruiterRequestedAt ? new Date(u.recruiterRequestedAt).toLocaleDateString() : "Recently"}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <AdminRecruiterDecisionButtons clerkId={u.clerkId} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No pending recruiter applications. All requests have been reviewed.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* User Role Management Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-10">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">User Role Management</h2>
              <p className="text-xs text-gray-500 mt-1">Inspect and manage trusted user roles (candidate vs recruiter)</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 font-medium">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>{users.length} Users</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold border-b">User Email</th>
                  <th className="p-4 font-bold border-b">Clerk ID</th>
                  <th className="p-4 font-bold border-b">Role</th>
                  <th className="p-4 font-bold border-b">Application Status</th>
                  <th className="p-4 font-bold border-b text-right">Role Assignment</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                {users.map((u) => {
                  const isRecruiter = u.role === "recruiter";

                  return (
                    <tr key={u.clerkId} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-bold text-gray-900">
                        {u.email}
                        {u.companyName && (
                          <span className="block text-xs font-normal text-gray-500">
                            {u.companyName}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-500">
                        {u.clerkId}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            isRecruiter
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        {u.recruiterStatus === "pending" && Boolean(u.companyName && u.companyName.trim().length >= 2) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Pending Review
                          </span>
                        )}
                        {u.recruiterStatus === "approved" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Approved
                          </span>
                        )}
                        {u.recruiterStatus === "rejected" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Rejected
                          </span>
                        )}
                        {(!u.recruiterStatus || u.recruiterStatus === "none" || (u.recruiterStatus === "pending" && (!u.companyName || u.companyName.trim().length < 2))) && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <AdminRoleToggleButton clerkId={u.clerkId} currentRole={u.role} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="p-8 text-center text-gray-500">No users found in database.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
import Link from "next/link";
import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server"; 
import { Briefcase, ShieldAlert } from "lucide-react";
import { getAuthenticatedUser, isConfiguredAdmin } from "@/lib/auth";

export default async function Navbar() {
  const authContext = await getAuthenticatedUser();
  const userRole = authContext?.role;

  // Check admin status against server-configured admin email
  let isAdmin = false;
  if (authContext) {
    const user = await currentUser();
    const primaryEmail = user?.emailAddresses?.[0]?.emailAddress;
    isAdmin = isConfiguredAdmin(primaryEmail);
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-blue-600 rounded-full p-2 group-hover:bg-blue-700 transition">
            <Briefcase className="text-white h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            Insider<span className="font-normal">jobs</span>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          <SignedOut>
            <Link 
              href="/recruiter-login" 
              className="text-gray-600 font-medium hover:text-blue-600 transition"
            >
              Recruiter Login
            </Link>

            <Link 
              href="/candidate-login" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold transition shadow-sm hover:shadow-md text-sm"
            >
              Candidate Login
            </Link>
          </SignedOut>

          <SignedIn>
            {/* ADMIN LINK (Only visible to Admin) */}
            {isAdmin && (
              <Link 
                href="/admin" 
                className="flex items-center gap-1 text-red-600 font-bold hover:bg-red-50 px-3 py-2 rounded-lg transition border border-transparent hover:border-red-100"
              >
                <ShieldAlert className="w-4 h-4" />
                Admin
              </Link>
            )}

            {/* Recruiter Navigation */}
            {userRole === "recruiter" && (
              <>
                <Link
                  href="/dashboard"
                  className="text-gray-600 font-medium hover:text-blue-600 transition"
                >
                  Recruiter Dashboard
                </Link>
                <Link
                  href="/post-job"
                  className="text-gray-600 font-medium hover:text-blue-600 transition"
                >
                  Post a Job
                </Link>
              </>
            )}

            {/* Candidate Navigation (Rendered when user is NOT a recruiter) */}
            {userRole !== "recruiter" && (
              <>
                <Link
                  href="/my-applications"
                  className="text-gray-600 font-medium hover:text-blue-600 transition"
                >
                  My Applications
                </Link>
                <Link
                  href="/saved-jobs"
                  className="text-gray-600 font-medium hover:text-blue-600 transition"
                >
                  Saved Jobs
                </Link>
                <Link
                  href="/profile"
                  className="text-gray-600 font-medium hover:text-blue-600 transition"
                >
                  My Profile
                </Link>
              </>
            )}

            <UserButton
              appearance={{
                elements: { avatarBox: "w-10 h-10 border-2 border-gray-100" },
              }}
            />
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}
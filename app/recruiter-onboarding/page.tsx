import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Briefcase, Clock } from "lucide-react";
import Link from "next/link";
import RecruiterOnboardingForm from "@/components/RecruiterOnboardingForm";
import { serializeOnboardingUser, RecruiterOnboardingUserDTO } from "@/lib/dto";

export default async function RecruiterOnboardingPage() {
  const authContext = await getAuthenticatedUser();

  if (!authContext) {
    redirect("/recruiter-login");
  }

  // If already an authorized recruiter, redirect directly to dashboard
  if (authContext.role === "recruiter") {
    redirect("/dashboard");
  }

  const userDTO: RecruiterOnboardingUserDTO = serializeOnboardingUser(
    authContext.dbUser,
    authContext.email
  );

  const isPending =
    userDTO.recruiterStatus === "pending" &&
    Boolean(userDTO.companyName && userDTO.companyName.trim().length >= 2);
  const isRejected = userDTO.recruiterStatus === "rejected";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
          <Briefcase className="w-7 h-7" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          {isPending ? "Application Under Review" : "Recruiter Access Application"}
        </h1>
        <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">
          {isPending
            ? "Your recruiter application has been submitted and is currently awaiting administrator review."
            : "Submit your organization details to request recruiter access. All accounts require administrator verification."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-gray-200/50 sm:rounded-2xl border border-gray-100 sm:px-10">
          
          {/* PENDING STATE */}
          {isPending ? (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-amber-900">
                  Verification in Progress
                </h3>
                <p className="mt-2 text-xs text-amber-800 leading-relaxed text-left">
                  We received your request for{" "}
                  <strong className="text-amber-950 font-semibold">{userDTO.companyName || "your company"}</strong>.
                  To protect applicant privacy and prevent unauthorized job listings, all recruiter accounts must be verified and approved by an administrator before access is granted.
                </p>
              </div>

              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 text-xs space-y-2 text-gray-600">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">Applicant:</span>
                  <span className="font-mono text-gray-900">{userDTO.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">Company:</span>
                  <span className="font-medium text-gray-900">{userDTO.companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">Status:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                    Pending Review
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition"
                >
                  Return to Job Board
                </Link>
              </div>
            </div>
          ) : (
            /* APPLICATION FORM (New or Re-apply) */
            <RecruiterOnboardingForm
              initialCompanyName={userDTO.companyName}
              isRejected={isRejected}
            />
          )}

        </div>
      </div>
    </div>
  );
}

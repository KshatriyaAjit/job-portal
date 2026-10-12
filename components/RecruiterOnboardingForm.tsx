"use client";

import { useTransition, useState } from "react";
import { Building2, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { completeRecruiterOnboarding } from "@/app/actions";
import Link from "next/link";

interface RecruiterOnboardingFormProps {
  initialCompanyName?: string | null;
  isRejected?: boolean;
}

export default function RecruiterOnboardingForm({
  initialCompanyName = "",
  isRejected = false,
}: RecruiterOnboardingFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await completeRecruiterOnboarding(formData);
      } catch (err: unknown) {
        // Next.js redirect() throws a special error with a digest starting with NEXT_REDIRECT.
        // We must re-throw it so Next.js can perform the navigation.
        if (
          typeof err === "object" &&
          err !== null &&
          "digest" in err &&
          typeof (err as { digest: string }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        const message = err instanceof Error ? err.message : "Failed to submit application.";
        setError(message);
      }
    });
  };

  return (
    <>
      {isRejected && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800 leading-relaxed">
            <span className="font-semibold block text-red-900 mb-0.5">Application Not Approved</span>
            Your previous request was not approved. You may submit updated organization credentials below for reconsideration.
          </div>
        </div>
      )}

      <div className="mb-6 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 leading-relaxed">
          <span className="font-semibold block text-blue-900 mb-0.5">Administrator Approval Required</span>
          Recruiter permissions grant access to applicant resumes, contact details, and job management. An administrator will review your application before recruiter access is granted.
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="companyName" className="block text-sm font-semibold text-gray-700">
            Company / Organization Name <span className="text-red-500">*</span>
          </label>
          <div className="mt-1.5 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Building2 className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              name="companyName"
              id="companyName"
              required
              minLength={2}
              maxLength={100}
              defaultValue={initialCompanyName || ""}
              placeholder="e.g. Acme Tech, Stripe, Google"
              className="block w-full pl-11 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm placeholder:text-gray-400 transition"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-semibold text-gray-700">
            Hiring Scope / Organization Website <span className="text-gray-400 font-normal text-xs">(optional)</span>
          </label>
          <div className="mt-1.5">
            <textarea
              name="reason"
              id="reason"
              rows={3}
              maxLength={500}
              placeholder="e.g. Hiring for frontend and backend engineers. Company domain: acme.com"
              className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm placeholder:text-gray-400 transition"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Application...</span>
              </>
            ) : (
              <>
                <span>Submit Recruiter Application</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-gray-100 pt-5 text-center">
        <Link
          href="/"
          className="text-xs font-medium text-gray-500 hover:text-gray-700 transition"
        >
          Cancel and return to Job Board as Candidate
        </Link>
      </div>
    </>
  );
}


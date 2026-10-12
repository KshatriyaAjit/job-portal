import Link from "next/link";
import { Briefcase, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <Briefcase className="w-8 h-8" />
      </div>

      <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">404 - Page Not Found</h1>
      <p className="text-gray-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
        The job listing, profile, or page you were looking for does not exist, has expired, or may have been removed.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-sm text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Browse Available Jobs</span>
        </Link>
      </div>
    </div>
  );
}

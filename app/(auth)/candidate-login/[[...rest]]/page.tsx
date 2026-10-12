import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { X } from "lucide-react"; // Import the X icon

export default function CandidateLoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 relative overflow-hidden">
      
      {/* 1. Candidate Theme Background */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center blur-sm scale-110"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?q=80&w=2070&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 bg-black/30"></div>
      </div>

      {/* 2. Login Card */}
      <div className="relative z-10 bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        
        {/* CLOSE BUTTON */}
        <Link href="/" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition cursor-pointer">
          <X className="w-6 h-6" />
        </Link>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Job Seeker Login</h1>
          <p className="text-gray-500 text-sm mt-2">Sign in to apply for jobs and track status</p>
        </div>

        <SignIn 
          appearance={{
            elements: {
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
              card: "shadow-none p-0",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "border-gray-300 text-gray-600 hover:bg-gray-50",
            }
          }}
          fallbackRedirectUrl="/"
          signUpUrl="/candidate-sign-up"
        />
      </div>
    </div>
  );
}
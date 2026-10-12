import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { X } from "lucide-react";

export default function RecruiterSignUpPage() {
  return (
    // Added 'py-12' here to prevent full-height stretching
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100 relative overflow-y-auto py-12">
      
      {/* Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center blur-sm scale-110"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop')" }}
      >
        <div className="absolute inset-0 bg-blue-900/40"></div>
      </div>

      {/* Sign Up Card */}
      <div className="relative z-10 bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        
        {/* CLOSE BUTTON */}
        <Link href="/" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition cursor-pointer">
          <X className="w-6 h-6" />
        </Link>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Recruiter Sign Up</h1>
          <p className="text-gray-500 text-sm mt-2">Create an account to post jobs</p>
        </div>

        <SignUp 
          appearance={{
            elements: {
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
              card: "shadow-none p-0",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              // This helps keep the form clean
              rootBox: "w-full",
            }
          }}
          fallbackRedirectUrl="/recruiter-onboarding"
          signInUrl="/recruiter-login"
        />
      </div>
    </div>
  );
}
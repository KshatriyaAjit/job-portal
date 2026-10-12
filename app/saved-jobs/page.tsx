import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import SavedJob from "@/models/SavedJob";
import JobRow from "@/components/JobRow";
import SavedJobButton from "@/components/SavedJobButton";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart, ArrowLeft } from "lucide-react";

export default async function SavedJobsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/candidate-login");

  await connectDB();

  // 1. Find all SavedJob entries for this user
  const savedEntries = await SavedJob.find({ userId });
  
  // 2. Extract the Job IDs
  const jobIds = savedEntries.map((entry) => entry.jobId);

  // 3. Fetch the actual Job details
  const savedJobs = await Job.find({ _id: { $in: jobIds } }).sort({ createdAt: -1 });

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition text-gray-500">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500 fill-red-500" />
            My Saved Jobs
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        
        {savedJobs.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="text-red-400 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No saved jobs yet</h3>
            <p className="text-gray-500 mt-2 mb-6">Jobs you bookmark will appear here for quick access.</p>
            
            <Link href="/">
              <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition cursor-pointer">
                Browse Jobs &rarr;
              </button>
            </Link>
          </div>
        ) : (
          /* Saved Jobs List */
          <div className="space-y-4">
            {savedJobs.map((job) => (
              <JobRow 
                key={job._id.toString()}
                job={{
                  ...job.toObject(),
                  _id: job._id.toString(),
                  createdAt: job.createdAt.toISOString()
                }}
                // We pass the button here too, so they can "Unsave" directly from this list
                actionButton={
                  <SavedJobButton 
                    jobId={job._id.toString()} 
                    initialIsSaved={true} // It's obviously saved if it's on this page
                  />
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
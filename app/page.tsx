import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import SavedJob from "@/models/SavedJob";
import JobRow from "@/components/JobRow";
import SearchBox from "@/components/SearchBox";
import FilterSidebar from "@/components/FilterSidebar"; 
import SavedJobButton from "@/components/SavedJobButton";
import QuickFilters from "@/components/QuickFilters"; // 👈 Import new component
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ 
    query?: string; 
    location?: string; 
    page?: string; 
    type?: string; 
    minSalary?: string;
  }>;
}

export default async function Home({ searchParams }: PageProps) {
  await connectDB();
  const { query, location, page, type, minSalary } = await searchParams;
  const { userId } = await auth();

  // 1. Pagination Setup
  const currentPage = parseInt(page || "1");
  const limit = 5; 
  const skip = (currentPage - 1) * limit;

  // 2. Build Advanced Filter
  const filter: any = {};
  
  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { companyName: { $regex: query, $options: "i" } },
    ];
  }
  if (location) filter.location = { $regex: location, $options: "i" };
  if (minSalary) filter.salary = { $gte: parseInt(minSalary) };
  if (type) filter.jobType = { $in: type.split(",") };

  // 3. Fetch Jobs & Total Count
  const jobs = await Job.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalJobs = await Job.countDocuments(filter);
  const totalPages = Math.ceil(totalJobs / limit);

  // 4. Fetch User's Saved Jobs
  let savedJobIds: string[] = [];
  if (userId) {
    const savedJobs = await SavedJob.find({ userId });
    savedJobIds = savedJobs.map((s) => s.jobId.toString());
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      
      {/* Hero Section */}
      {/* 👇 CHANGED: Solid blue -> Gradient Background */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 py-20 px-4 text-center shadow-lg relative overflow-hidden">
        
        {/* Optional: Subtle background pattern/blob for texture */}
        <div className="absolute top-0 left-0 w-full h-full bg-white/5 pointer-events-none mix-blend-overlay"></div>

        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight drop-shadow-sm relative z-10">
          Find your next dream career
        </h1>
        <p className="text-blue-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed relative z-10 font-light">
          Search thousands of job listings from top companies and startups.
        </p>
        
        <div className="relative z-10 max-w-3xl mx-auto">
           <SearchBox />
        </div>

        {/* 👇 NEW: Quick Filters Component */}
        <div className="relative z-10">
           <QuickFilters />
        </div>

      </div>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 mt-12 flex flex-col md:flex-row gap-8">
        
        {/* Left Side: Filter Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
           <FilterSidebar />
        </div>

        {/* Right Side: Job Results */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Latest Jobs</h2>
            <span className="text-gray-500 font-medium bg-white border border-gray-200 px-4 py-1.5 rounded-full text-sm shadow-sm">
              {totalJobs} Found
            </span>
          </div>
          
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">No jobs match your filters</h3>
                <p className="text-gray-500 mt-2">Try adjusting your search or clearing filters.</p>
                <Link href="/" className="text-blue-600 font-bold hover:underline mt-4 inline-block px-6 py-2 bg-blue-50 rounded-lg">
                  Clear all filters
                </Link>
              </div>
            ) : (
              jobs.map((job) => {
                const isSaved = savedJobIds.includes(job._id.toString());

                return (
                  <JobRow 
                    key={job._id.toString()} 
                    job={{
                      ...job.toObject(),
                      _id: job._id.toString(),
                      createdAt: job.createdAt.toISOString()
                    }}
                    actionButton={
                      userId ? (
                        <SavedJobButton 
                          jobId={job._id.toString()} 
                          initialIsSaved={isSaved} 
                        />
                      ) : null
                    }
                  />
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {currentPage > 1 && (
                <Link 
                  href={`/?page=${currentPage - 1}`}
                  className="p-2 border rounded hover:bg-gray-100 transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Link>
              )}
              
              <span className="px-4 py-2 font-bold text-gray-700">
                Page {currentPage} of {totalPages}
              </span>

              {currentPage < totalPages && (
                <Link 
                  href={`/?page=${currentPage + 1}`}
                  className="p-2 border rounded hover:bg-gray-100 transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
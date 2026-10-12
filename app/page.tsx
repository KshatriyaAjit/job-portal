import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import SavedJob from "@/models/SavedJob";
import JobRow from "@/components/JobRow";
import SearchBox from "@/components/SearchBox";
import FilterSidebar from "@/components/FilterSidebar"; 
import SavedJobButton from "@/components/SavedJobButton";
import QuickFilters from "@/components/QuickFilters";
import SortSelect from "@/components/SortSelect";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ChevronLeft, ChevronRight, Briefcase } from "lucide-react";
import { normalizeJobSearchParams, buildSearchPath } from "@/lib/search-params";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function Home({ searchParams }: PageProps) {
  await connectDB();
  const rawParams = await searchParams;
  const parsed = normalizeJobSearchParams(rawParams);
  const { userId } = await auth();

  const limit = 5; 
  const currentPage = parsed.page;
  const skip = (currentPage - 1) * limit;

  // 1. Build Query Filter with ReDoS prevention
  const filter: Parameters<typeof Job.find>[0] = {};
  
  if (parsed.query) {
    const safeQuery = escapeRegex(parsed.query);
    filter.$or = [
      { title: { $regex: safeQuery, $options: "i" } },
      { companyName: { $regex: safeQuery, $options: "i" } },
    ];
  }
  if (parsed.location) {
    const safeLocation = escapeRegex(parsed.location);
    filter.location = { $regex: safeLocation, $options: "i" };
  }
  if (parsed.minSalary) {
    filter.salary = { $gte: parsed.minSalary };
  }
  if (parsed.type && parsed.type.length > 0) {
    filter.jobType = { $in: parsed.type };
  }

  // 2. Determine Sort Options
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (parsed.sort === "oldest") {
    sortOption = { createdAt: 1 };
  } else if (parsed.sort === "salary_high") {
    sortOption = { salary: -1, createdAt: -1 };
  } else if (parsed.sort === "salary_low") {
    sortOption = { salary: 1, createdAt: -1 };
  }

  // 3. Fetch Jobs & Total Count
  const [jobs, totalJobs] = await Promise.all([
    Job.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit),
    Job.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalJobs / limit));

  // 4. Fetch User's Saved Jobs for Action Button state
  let savedJobIds: string[] = [];
  if (userId) {
    const savedJobs = await SavedJob.find({ userId });
    savedJobIds = savedJobs.map((s) => s.jobId.toString());
  }

  const prevPageUrl = currentPage > 1
    ? buildSearchPath("/", rawParams, { page: (currentPage - 1).toString() })
    : null;

  const nextPageUrl = currentPage < totalPages
    ? buildSearchPath("/", rawParams, { page: (currentPage + 1).toString() })
    : null;

  const hasActiveFilters = Boolean(
    parsed.query || parsed.location || parsed.minSalary || (parsed.type && parsed.type.length > 0)
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 py-20 px-4 text-center shadow-lg relative overflow-hidden">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Latest Jobs</h2>
              <span className="text-gray-600 font-semibold bg-white border border-gray-200 px-3.5 py-1 rounded-full text-sm shadow-sm">
                {totalJobs} {totalJobs === 1 ? "Job" : "Jobs"} Found
              </span>
            </div>

            <div className="flex items-center gap-3">
              <SortSelect />
            </div>
          </div>
          
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm p-8">
                <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">No jobs match your criteria</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto text-sm leading-relaxed">
                  {hasActiveFilters 
                    ? "Try loosening your search keywords, increasing salary range, or clearing some filters."
                    : "There are currently no active job postings on the board. Check back soon!"}
                </p>
                {hasActiveFilters && (
                  <Link 
                    href="/" 
                    className="inline-block mt-6 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-sm text-sm cursor-pointer"
                  >
                    Clear All Filters
                  </Link>
                )}
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

          {/* Pagination Controls with Parameter Preservation */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-10">
              {prevPageUrl ? (
                <Link 
                  href={prevPageUrl}
                  className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-semibold transition shadow-sm text-sm cursor-pointer"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-400 font-semibold cursor-not-allowed text-sm">
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </span>
              )}
              
              <span className="px-4 py-2 font-bold text-gray-700 text-sm">
                Page {currentPage} of {totalPages}
              </span>

              {nextPageUrl ? (
                <Link 
                  href={nextPageUrl}
                  className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-semibold transition shadow-sm text-sm cursor-pointer"
                  aria-label="Next Page"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-400 font-semibold cursor-not-allowed text-sm">
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, ChevronDown, ChevronUp } from "lucide-react";

export default function QuickFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showMore, setShowMore] = useState(false);

  // Check if any filters are currently active
  const hasFilters = searchParams.toString().length > 0;

  // 1. Primary Filters (Always Visible)
  const primaryFilters = [
    { label: "🌎 Remote", value: "location=Remote" },
    { label: "💻 Full-time", value: "type=Full-time" },
    { label: "🎓 Internship", value: "type=Internship" },
    { label: "⚙️ Engineering", value: "query=Engineering" },
    { label: "🎨 Design", value: "query=Design" },
  ];

  // 2. Extra Filters (Hidden inside "More")
  const extraFilters = [
    { label: "💰 $100k+", value: "minSalary=100000" },
    { label: "📝 Contract", value: "type=Contract" },
    { label: "🚀 Startup", value: "query=Startup" },
    { label: "🧠 Data Science", value: "query=Data" },
    { label: "📱 Mobile Dev", value: "query=Mobile" },
    { label: "👔 Management", value: "query=Manager" },
  ];

  const handleFilterClick = (filterValue: string) => {
    // Simple logic: Push the new URL
    router.push(`/?${filterValue}`);
  };

  const clearAll = () => {
    router.push("/");
  };

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      
      {/* Filter Row */}
      <div className="flex flex-wrap justify-center gap-3 animate-fade-in-up">
        <span className="text-blue-100 text-sm font-medium pt-2 hidden md:block opacity-80">
          Trending:
        </span>
        
        {/* Render Primary Filters */}
        {primaryFilters.map((filter) => (
          <button
            key={filter.label}
            onClick={() => handleFilterClick(filter.value)}
            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-sm font-medium transition border border-white/20 backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
          >
            {filter.label}
          </button>
        ))}

        {/* "More" Toggle Button */}
        <button
          onClick={() => setShowMore(!showMore)}
          className="bg-white/20 hover:bg-white/30 text-white px-5 py-2 rounded-full text-sm font-bold transition border border-white/30 backdrop-blur-md flex items-center gap-1"
        >
          {showMore ? "Less" : "More"}
          {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Filters Section */}
      {showMore && (
        <div className="flex flex-wrap justify-center gap-3 animate-fade-in-down max-w-3xl">
          {extraFilters.map((filter) => (
            <button
              key={filter.label}
              onClick={() => handleFilterClick(filter.value)}
              className="bg-white/5 hover:bg-white/15 text-blue-50 px-4 py-1.5 rounded-full text-sm transition border border-white/10 backdrop-blur-md"
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Clear All Button (Only visible if filters are active) */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10 px-4 py-1.5 rounded-full text-sm transition mt-2 border border-transparent hover:border-white/10"
        >
          <X className="w-4 h-4" />
          Clear all filters
        </button>
      )}

    </div>
  );
}
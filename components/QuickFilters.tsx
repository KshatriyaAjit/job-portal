"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { buildSearchPath } from "@/lib/search-params";

interface FilterDef {
  label: string;
  key: "location" | "type" | "query" | "minSalary";
  val: string;
}

export default function QuickFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showMore, setShowMore] = useState(false);

  const primaryFilters: FilterDef[] = [
    { label: "🌎 Remote", key: "location", val: "Remote" },
    { label: "💻 Full-time", key: "type", val: "Full-time" },
    { label: "🎓 Internship", key: "type", val: "Internship" },
    { label: "⚙️ Engineering", key: "query", val: "Engineering" },
    { label: "🎨 Design", key: "query", val: "Design" },
  ];

  const extraFilters: FilterDef[] = [
    { label: "💰 $100k+", key: "minSalary", val: "100000" },
    { label: "📝 Contract", key: "type", val: "Contract" },
    { label: "🚀 Startup", key: "query", val: "Startup" },
    { label: "🧠 Data Science", key: "query", val: "Data" },
    { label: "📱 Mobile Dev", key: "query", val: "Mobile" },
    { label: "👔 Management", key: "query", val: "Manager" },
  ];

  function isFilterActive(filter: FilterDef): boolean {
    if (filter.key === "type") {
      const activeTypes = searchParams.get("type")?.split(",").map((s) => s.trim()) || [];
      return activeTypes.includes(filter.val);
    }
    return searchParams.get(filter.key) === filter.val;
  }

  function handleFilterToggle(filter: FilterDef) {
    const currentlyActive = isFilterActive(filter);

    let nextValue: string | null = null;
    if (filter.key === "type") {
      const currentTypes = searchParams.get("type")?.split(",").map((s) => s.trim()).filter(Boolean) || [];
      if (currentlyActive) {
        const remaining = currentTypes.filter((t) => t !== filter.val);
        nextValue = remaining.length > 0 ? remaining.join(",") : null;
      } else {
        nextValue = [...currentTypes, filter.val].join(",");
      }
    } else {
      nextValue = currentlyActive ? null : filter.val;
    }

    const nextPath = buildSearchPath(pathname, searchParams, {
      [filter.key]: nextValue,
      page: null, // Reset to first page on filter toggle
    });

    router.push(nextPath);
  }

  function handleClearAll() {
    router.push(pathname);
  }

  const hasAnyFilter = Boolean(
    searchParams.get("query") ||
    searchParams.get("location") ||
    searchParams.get("type") ||
    searchParams.get("minSalary")
  );

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      {/* Primary Row */}
      <div className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto px-4">
        <span className="text-blue-100 text-sm font-semibold pt-2 hidden md:block opacity-90">
          Trending:
        </span>

        {primaryFilters.map((filter) => {
          const active = isFilterActive(filter);
          return (
            <button
              key={filter.label}
              onClick={() => handleFilterToggle(filter)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition border shadow-sm cursor-pointer ${
                active
                  ? "bg-white text-blue-700 font-bold border-white shadow-md scale-105"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20 hover:scale-105"
              }`}
            >
              {filter.label}
            </button>
          );
        })}

        <button
          onClick={() => setShowMore(!showMore)}
          className="text-blue-100 hover:text-white text-sm font-medium flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
        >
          {showMore ? "Less" : "More"}
          {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {hasAnyFilter && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 text-xs text-red-200 hover:text-white bg-red-500/20 hover:bg-red-500/40 border border-red-300/30 px-3 py-1.5 rounded-full transition cursor-pointer"
            title="Clear all active filters"
          >
            <X className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Expanded Row */}
      {showMore && (
        <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto px-4">
          {extraFilters.map((filter) => {
            const active = isFilterActive(filter);
            return (
              <button
                key={filter.label}
                onClick={() => handleFilterToggle(filter)}
                className={`px-3.5 py-1 rounded-full text-xs font-medium transition border cursor-pointer ${
                  active
                    ? "bg-white text-blue-700 font-bold border-white shadow-sm scale-105"
                    : "bg-white/10 hover:bg-white/20 text-white border-white/20 hover:scale-105"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
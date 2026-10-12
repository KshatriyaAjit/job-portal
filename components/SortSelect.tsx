"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { buildSearchPath } from "@/lib/search-params";

export default function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort") || "newest";

  const handleSortChange = (newSort: string) => {
    const nextPath = buildSearchPath(pathname, searchParams, {
      sort: newSort === "newest" ? null : newSort,
      page: null, // Reset to first page on sort change
    });
    router.push(nextPath);
  };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
      <ArrowUpDown className="w-4 h-4 text-gray-400" />
      <span className="font-medium text-xs uppercase tracking-wider text-gray-500 hidden sm:inline">Sort:</span>
      <select
        value={currentSort}
        onChange={(e) => handleSortChange(e.target.value)}
        className="bg-transparent text-sm font-semibold text-gray-800 outline-none cursor-pointer hover:text-blue-600 transition"
      >
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="salary_high">Highest Salary</option>
        <option value="salary_low">Lowest Salary</option>
      </select>
    </div>
  );
}


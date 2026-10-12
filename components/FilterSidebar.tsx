"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { buildSearchPath } from "@/lib/search-params";
import { RotateCcw } from "lucide-react";

export default function FilterSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive filter state directly from URL searchParams without local state lag
  const minSalary = searchParams.get("minSalary") || "";
  const jobTypes = searchParams.get("type")?.split(",").map((t) => t.trim()).filter(Boolean) || [];

  const updateFilters = (salary: string, types: string[]) => {
    const nextPath = buildSearchPath(pathname, searchParams, {
      minSalary: salary || null,
      type: types.length > 0 ? types.join(",") : null,
      page: null, // Reset to first page whenever filtering changes
    });

    router.push(nextPath);
  };

  const handleSalaryChange = (value: string) => {
    updateFilters(value, jobTypes);
  };

  const handleTypeChange = (type: string) => {
    const updated = jobTypes.includes(type)
      ? jobTypes.filter((t) => t !== type)
      : [...jobTypes, type];
    updateFilters(minSalary, updated);
  };

  const clearSidebarFilters = () => {
    const nextPath = buildSearchPath(pathname, searchParams, {
      minSalary: null,
      type: null,
      page: null,
    });
    router.push(nextPath);
  };

  const hasSidebarFilters = Boolean(minSalary || jobTypes.length > 0);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit w-full md:w-64">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Filters</h3>
        {hasSidebarFilters && (
          <button
            onClick={clearSidebarFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 transition cursor-pointer"
            title="Reset Salary & Type filters"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Salary Filter */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">Min Salary</label>
        <select 
          value={minSalary} 
          onChange={(e) => handleSalaryChange(e.target.value)}
          className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer"
        >
          <option value="">Any</option>
          <option value="30000">$30,000+</option>
          <option value="50000">$50,000+</option>
          <option value="80000">$80,000+</option>
          <option value="100000">$100,000+</option>
          <option value="150000">$150,000+</option>
        </select>
      </div>

      {/* Job Type Filter */}
      <div>
        <label className="text-sm font-semibold text-gray-700 mb-2 block">Job Type</label>
        <div className="space-y-2.5">
          {["Full-time", "Part-time", "Contract", "Internship"].map((type) => (
            <label key={type} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-700 hover:text-blue-600 transition">
              <input 
                type="checkbox" 
                checked={jobTypes.includes(type)}
                onChange={() => handleTypeChange(type)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
              />
              <span>{type}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function FilterSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State for filters
  const [minSalary, setMinSalary] = useState(searchParams.get("minSalary") || "");
  const [jobTypes, setJobTypes] = useState<string[]>(
    searchParams.get("type")?.split(",") || []
  );

  // Apply filters when state changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (minSalary) params.set("minSalary", minSalary);
    else params.delete("minSalary");

    if (jobTypes.length > 0) params.set("type", jobTypes.join(","));
    else params.delete("type");

    // Reset to page 1 when filtering
    params.set("page", "1");

    router.push(`/?${params.toString()}`);
  }, [minSalary, jobTypes, router]);

  const handleTypeChange = (type: string) => {
    if (jobTypes.includes(type)) {
      setJobTypes(jobTypes.filter((t) => t !== type));
    } else {
      setJobTypes([...jobTypes, type]);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit w-full md:w-64">
      <h3 className="font-bold text-gray-900 mb-4">Filters</h3>

      {/* Salary Filter */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-gray-700 mb-2 block">Min Salary</label>
        <select 
          value={minSalary} 
          onChange={(e) => setMinSalary(e.target.value)}
          className="w-full border p-2 rounded text-sm"
        >
          <option value="">Any</option>
          <option value="30000">$30,000+</option>
          <option value="50000">$50,000+</option>
          <option value="80000">$80,000+</option>
          <option value="100000">$100,000+</option>
        </select>
      </div>

      {/* Job Type Filter */}
      <div>
        <label className="text-sm font-semibold text-gray-700 mb-2 block">Job Type</label>
        <div className="space-y-2">
          {["Full-time", "Part-time", "Contract", "Internship"].map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={jobTypes.includes(type)}
                onChange={() => handleTypeChange(type)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">{type}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
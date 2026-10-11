"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Search, MapPin, X } from "lucide-react"; 

export default function SearchBox() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const [term, setTerm] = useState(searchParams.get("query")?.toString() || "");
  const [location, setLocation] = useState(searchParams.get("location")?.toString() || "");

  function handleSearch() {
    const params = new URLSearchParams(searchParams);
    
    if (term) params.set("query", term);
    else params.delete("query");

    if (location) params.set("location", location);
    else params.delete("location");

    replace(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setTerm("");
    setLocation("");
    replace(pathname);
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-xl max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4">
        
        {/* Keyword Input */}
        <div className="flex-1 relative group">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-600" />
          <input
            className="w-full pl-10 px-4 py-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder-gray-500"
            placeholder="Job title, keywords, or company"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        
        {/* Location Input */}
        <div className="flex-1 relative group">
          <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-600" />
          <input
            className="w-full pl-10 px-4 py-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder-gray-500"
            placeholder="City, state, or 'Remote'"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button 
            onClick={handleSearch} 
            className="px-8 py-3 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-sm"
          >
            Find Jobs
          </button>
          
          {(term || location) && (
            <button 
              onClick={clearFilters}
              className="px-4 py-3 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-all"
              title="Clear Filters"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
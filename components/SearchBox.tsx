"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, MapPin, X } from "lucide-react";
import { buildSearchPath } from "@/lib/search-params";

export default function SearchBox() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const urlQuery = searchParams.get("query") || "";
  const urlLocation = searchParams.get("location") || "";

  const [term, setTerm] = useState(urlQuery);
  const [location, setLocation] = useState(urlLocation);

  // Keep input fields synchronized with URL parameters (e.g. Back/Forward, Quick Filters)
  useEffect(() => {
    setTerm(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    setLocation(urlLocation);
  }, [urlLocation]);

  function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();

    const nextPath = buildSearchPath(pathname, searchParams, {
      query: term.trim() || null,
      location: location.trim() || null,
      page: null, // Always reset to page 1 on new search
    });

    router.push(nextPath);
  }

  function clearSearchInputs() {
    setTerm("");
    setLocation("");

    // Clears ONLY query and location, preserving salary, type, sort
    const nextPath = buildSearchPath(pathname, searchParams, {
      query: null,
      location: null,
      page: null,
    });

    router.push(nextPath);
  }

  const hasSearchInput = Boolean(term || location || urlQuery || urlLocation);

  return (
    <form onSubmit={handleSearch} className="bg-white p-4 rounded-xl shadow-xl max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Keyword Input */}
        <div className="flex-1 relative group">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition" />
          <input
            className="w-full pl-10 px-4 py-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder-gray-500"
            placeholder="Job title, keywords, or company"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        {/* Location Input */}
        <div className="flex-1 relative group">
          <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition" />
          <input
            className="w-full pl-10 px-4 py-3 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-gray-900 placeholder-gray-500"
            placeholder="City, state, or 'Remote'"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-8 py-3 rounded-md bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-98 cursor-pointer"
          >
            Find Jobs
          </button>

          {hasSearchInput && (
            <button
              type="button"
              onClick={clearSearchInputs}
              className="px-4 py-3 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-all flex items-center justify-center cursor-pointer"
              title="Clear Search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans animate-pulse">
      {/* Hero Skeleton */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 py-20 px-4 text-center">
        <div className="h-10 bg-white/20 rounded-md max-w-md mx-auto mb-4"></div>
        <div className="h-5 bg-white/10 rounded-md max-w-xs mx-auto mb-8"></div>
        <div className="h-14 bg-white/30 rounded-xl max-w-3xl mx-auto mb-6"></div>
        <div className="flex justify-center gap-2 max-w-xl mx-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-20 bg-white/20 rounded-full"></div>
          ))}
        </div>
      </div>

      {/* Main Layout Skeleton */}
      <div className="max-w-7xl mx-auto px-4 mt-12 flex flex-col md:flex-row gap-8">
        {/* Left Filter Skeleton */}
        <div className="w-full md:w-64 bg-white p-6 rounded-xl border border-gray-200 h-64">
          <div className="h-5 w-24 bg-gray-200 rounded mb-6"></div>
          <div className="h-10 bg-gray-100 rounded mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-gray-100 rounded w-3/4"></div>
            ))}
          </div>
        </div>

        {/* Right Job Cards Skeleton */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-center mb-6">
            <div className="h-7 w-36 bg-gray-200 rounded"></div>
            <div className="h-7 w-24 bg-gray-100 rounded-full"></div>
          </div>

          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
              <div className="space-y-2.5 flex-1">
                <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                <div className="flex gap-4">
                  <div className="h-3 bg-gray-100 rounded w-20"></div>
                  <div className="h-3 bg-gray-100 rounded w-20"></div>
                </div>
              </div>
              <div className="h-9 w-24 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


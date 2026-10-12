export default function SavedJobsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white border-b border-gray-200 h-20">
        <div className="max-w-4xl mx-auto px-6 h-full flex items-center gap-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
          <div className="h-6 w-44 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* List Skeleton */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 flex justify-between items-center">
            <div className="space-y-2.5 flex-1">
              <div className="h-5 w-56 bg-gray-200 rounded"></div>
              <div className="h-4 w-32 bg-gray-100 rounded"></div>
              <div className="flex gap-4">
                <div className="h-3 w-24 bg-gray-100 rounded"></div>
                <div className="h-3 w-28 bg-gray-100 rounded"></div>
              </div>
            </div>
            <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}


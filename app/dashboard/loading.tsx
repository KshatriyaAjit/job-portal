export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white border-b border-gray-200 h-20">
        <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-200 rounded"></div>
            <div className="h-3.5 w-64 bg-gray-100 rounded"></div>
          </div>
          <div className="h-10 w-32 bg-gray-200 rounded-lg"></div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-5 w-48 bg-gray-200 rounded"></div>
                <div className="flex gap-3">
                  <div className="h-4 w-20 bg-gray-100 rounded"></div>
                  <div className="h-4 w-20 bg-gray-100 rounded"></div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-16 bg-gray-100 rounded"></div>
                <div className="h-8 w-16 bg-gray-100 rounded"></div>
              </div>
            </div>

            <div className="h-32 bg-gray-50 rounded-lg border border-gray-100"></div>
          </div>
        ))}
      </div>
    </div>
  );
}


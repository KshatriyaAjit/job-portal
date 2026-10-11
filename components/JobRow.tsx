import Link from "next/link";
import { ReactNode } from "react";

interface JobProps {
  job: {
    _id: string;
    title: string;
    companyName: string;
    location: string;
    salary: number;
    createdAt: string;
  };
  actionButton?: ReactNode; // 👈 1. New prop for the heart button
}

export default function JobRow({ job, actionButton }: JobProps) {
  return (
    <div className="group bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Job Info */}
        <div className="flex-1">
          <h2 className="font-bold text-xl text-gray-900 group-hover:text-blue-600 transition-colors">
            {job.title}
          </h2>
          <p className="text-gray-500 font-medium mb-3">{job.companyName}</p>
          
          <div className="flex flex-wrap gap-2 text-sm font-medium">
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full border border-gray-200">
              📍 {job.location}
            </span>
            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100">
              💵 ${job.salary.toLocaleString()}
            </span>
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
              📅 {new Date(job.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        {/* Actions Container (Right Side) */}
        <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          
          {/* 👇 2. Render the Heart Button here */}
          {actionButton && (
            <div className="shrink-0">
              {actionButton}
            </div>
          )}

          <Link 
            href={`/jobs/${job._id}`} 
            className="flex-1 md:flex-none text-center px-6 py-2.5 rounded-lg border-2 border-blue-600 text-blue-600 font-bold hover:bg-blue-600 hover:text-white transition-all whitespace-nowrap"
          >
            View Details
          </Link>
        </div>

      </div>
    </div>
  );
}
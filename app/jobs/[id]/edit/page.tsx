import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import EditJobForm from "@/components/EditJobForm"; // 👈 Import the new component

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { id } = await params;

  await connectDB();
  
  // Use .lean() to get a plain JavaScript object
  const jobDoc = await Job.findById(id).lean();

  if (!jobDoc || jobDoc.clerkId !== userId) {
    redirect("/dashboard");
  }

  // 👇 Serialize data: Convert ObjectId and Dates to strings to pass to Client Component
  const job = {
    _id: jobDoc._id.toString(),
    title: jobDoc.title,
    companyName: jobDoc.companyName,
    location: jobDoc.location,
    salary: jobDoc.salary,
    jobType: jobDoc.jobType,
    description: jobDoc.description,
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 font-sans">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Edit Job Posting</h1>
      
      {/* 👇 Pass the data to the Client Component */}
      <EditJobForm job={job} />
    </div>
  );
}
import { connectDB } from "@/lib/db";
import Job from "@/models/Job";
import { notFound, redirect } from "next/navigation";
import EditJobForm from "@/components/EditJobForm";
import { getAuthenticatedUser } from "@/lib/auth";
import mongoose from "mongoose";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const authContext = await getAuthenticatedUser();
  if (!authContext) redirect("/recruiter-login");
  if (authContext.role !== "recruiter") redirect("/");

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    notFound();
  }

  await connectDB();
  
  const jobDoc = await Job.findById(id).lean();

  if (!jobDoc) {
    notFound();
  }

  // Enforce ownership: only the posting recruiter can edit their job
  if (jobDoc.clerkId !== authContext.userId) {
    redirect("/dashboard");
  }

  // Serialize data to pass to Client Component
  const job = {
    _id: jobDoc._id.toString(),
    title: jobDoc.title,
    companyName: jobDoc.companyName,
    location: jobDoc.location,
    salary: jobDoc.salary,
    jobType: jobDoc.jobType,
    category: jobDoc.category || "Other",
    description: jobDoc.description,
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-6 font-sans">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Edit Job Posting</h1>
      <EditJobForm job={job} />
    </div>
  );
}
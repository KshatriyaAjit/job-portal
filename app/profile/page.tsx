import { connectDB } from "@/lib/db";
import Profile from "@/models/Profile";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ProfileWrapper from "@/components/ProfileWrapper"; 

export default async function ProfilePage() {
  const { userId } = await auth();
  const user = await currentUser();
  
  if (!userId) redirect("/");

  await connectDB();

  // Fetch Profile
  const profile = await Profile.findOne({ userId }).lean();

  // Clean data for client component
  const cleanProfile = profile ? {
    ...profile,
    _id: profile._id.toString(),
    createdAt: profile.createdAt?.toISOString(),
    updatedAt: profile.updatedAt?.toISOString(),
  } : null;

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans min-h-screen bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Candidate Profile</h1>
        <p className="text-gray-500">Manage your professional identity</p>
      </div>

      <ProfileWrapper 
          profile={cleanProfile} 
          userId={userId} 
          userEmail={user?.emailAddresses[0].emailAddress || ""}
      />
    </div>
  );
}
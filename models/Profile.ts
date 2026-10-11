import mongoose from "mongoose";

const ProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true }, // Links to Clerk User
    email: { type: String, required: true },
    
    // Professional Details
    bio: { type: String },
    skills: { type: [String] }, // Array of strings e.g. ["React", "Node"]
    resumeUrl: { type: String }, // The "Default" resume
    
    // Social Links
    linkedin: { type: String },
    github: { type: String },
    portfolio: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Profile || mongoose.model("Profile", ProfileSchema);
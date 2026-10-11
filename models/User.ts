import mongoose, { Document, Model } from "mongoose";

export interface IUser extends Document {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: "candidate" | "recruiter";
  resume?: string; // URL to resume
  createdAt: Date;
}

const UserSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, unique: true }, // Links to Clerk
    email: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    role: { 
      type: String, 
      enum: ["candidate", "recruiter"], 
      default: "candidate" 
    },
    resume: { type: String },
  },
  { timestamps: true }
);

// This trick prevents Next.js from creating the model multiple times
const User: Model<IUser> = mongoose.models.User || mongoose.model("User", UserSchema);

export default User;
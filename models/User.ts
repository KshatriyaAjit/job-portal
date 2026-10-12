import mongoose, { Model } from "mongoose";

export type UserRole = "candidate" | "recruiter";
export type RecruiterStatus = "none" | "pending" | "approved" | "rejected";

export interface IUser {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  resume?: string;
  companyName?: string;
  recruiterStatus?: RecruiterStatus;
  recruiterReason?: string;
  recruiterRequestedAt?: Date;
  recruiterReviewedAt?: Date;
  recruiterReviewedBy?: string;
  recruiterApprovalEmailSentAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new mongoose.Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    role: {
      type: String,
      enum: ["candidate", "recruiter"],
      default: "candidate",
    },
    resume: { type: String },
    companyName: { type: String },
    recruiterStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    recruiterReason: { type: String },
    recruiterRequestedAt: { type: Date },
    recruiterReviewedAt: { type: Date },
    recruiterReviewedBy: { type: String },
    recruiterApprovalEmailSentAt: { type: Date },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
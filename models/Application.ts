import mongoose, { Document, Model } from "mongoose";

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  userId: string;
  resumeUrl: string;
  coverLetter?: string; // 👈 Added optional field
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
}

const ApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    userId: { type: String, required: true },
    resumeUrl: { type: String, required: true },
    coverLetter: { type: String }, // 👈 Added to Schema
    status: { 
      type: String, 
      enum: ["pending", "interviewing", "accepted", "rejected"], 
      default: "pending" 
    },
  },
  { timestamps: true }
);

const Application: Model<IApplication> = mongoose.models.Application || mongoose.model("Application", ApplicationSchema);

export default Application;
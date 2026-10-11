import mongoose, { Document, Model } from "mongoose";

export interface IJob extends Document {
  title: string;
  description: string;
  companyName: string;
  location: string;
  salary: number;
  jobType: string;
  clerkId: string; // The ID of the Recruiter who posted it
  createdAt: Date;
  views: number; // 👈 Added views field to interface
}

const JobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    companyName: { type: String, required: true },
    location: { type: String, required: true },
    jobType: { 
      type: String, 
      required: true, 
      enum: ["Full-time", "Part-time", "Contract", "Internship"],
      default: "Full-time" 
    },
    salary: { type: Number, required: true },
    clerkId: { type: String, required: true }, // We link the job to the user
    views: { type: Number, default: 0 }, // 👈 Added views field to schema with default 0
  },
  { timestamps: true }
);

const Job: Model<IJob> = mongoose.models.Job || mongoose.model("Job", JobSchema);

export default Job;
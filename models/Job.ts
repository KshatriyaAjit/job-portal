import mongoose, { Document, Model } from "mongoose";
import {
  JOB_CATEGORIES,
  JobCategory,
  isValidJobCategory,
  inferLegacyJobCategory,
} from "@/lib/categories";

export { JOB_CATEGORIES, isValidJobCategory, inferLegacyJobCategory };
export type { JobCategory };

export interface IJob extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  companyName: string;
  location: string;
  salary: number;
  jobType: string;
  category: JobCategory;
  clerkId: string;
  createdAt: Date;
  updatedAt: Date;
  views: number;
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
      default: "Full-time",
    },
    category: {
      type: String,
      required: true,
      enum: JOB_CATEGORIES,
      default: "Other",
      index: true,
    },
    salary: { type: Number, required: true },
    clerkId: { type: String, required: true, index: true },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

JobSchema.index({ createdAt: -1 });

const Job: Model<IJob> = mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);

export default Job;
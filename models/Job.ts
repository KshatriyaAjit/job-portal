import mongoose, { Document, Model } from "mongoose";

export interface IJob extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  companyName: string;
  location: string;
  salary: number;
  jobType: string;
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
    salary: { type: Number, required: true },
    clerkId: { type: String, required: true, index: true },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

JobSchema.index({ createdAt: -1 });

const Job: Model<IJob> = mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);

export default Job;
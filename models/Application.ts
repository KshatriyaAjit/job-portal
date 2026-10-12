import mongoose, { Document, Model } from "mongoose";

export type ApplicationStatus = "pending" | "interviewing" | "accepted" | "rejected";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "pending",
  "interviewing",
  "accepted",
  "rejected",
];

export interface IAIEvaluation {
  overallScore: number;
  skillAlignment: {
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
  };
  experienceAlignment: {
    score: number;
    assessment: string;
  };
  qualificationsAlignment: {
    score: number;
    assessment: string;
  };
  keyStrengths: string[];
  recommendations: string;
  summary: string;
  evaluatedAt: Date | string;
}

export interface IApplication extends Document {
  _id: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  userId: string;
  resumeUrl: string;
  coverLetter?: string;
  status: ApplicationStatus;
  aiScore?: number;
  aiAnalysis?: IAIEvaluation;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    userId: { type: String, required: true, index: true },
    resumeUrl: { type: String, required: true },
    coverLetter: { type: String },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "pending",
    },
    aiScore: { type: Number, min: 0, max: 100 },
    aiAnalysis: {
      overallScore: { type: Number },
      skillAlignment: {
        score: { type: Number },
        matchedSkills: { type: [String], default: [] },
        missingSkills: { type: [String], default: [] },
      },
      experienceAlignment: {
        score: { type: Number },
        assessment: { type: String },
      },
      qualificationsAlignment: {
        score: { type: Number },
        assessment: { type: String },
      },
      keyStrengths: { type: [String], default: [] },
      recommendations: { type: String },
      summary: { type: String },
      evaluatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate applications for the same job and user
ApplicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });

const Application: Model<IApplication> =
  mongoose.models.Application || mongoose.model<IApplication>("Application", ApplicationSchema);

export default Application;
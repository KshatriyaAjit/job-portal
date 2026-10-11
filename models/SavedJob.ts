import mongoose, { Schema, model, models } from "mongoose";

const SavedJobSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true, // Faster queries
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate saves (One user can save a job only once)
SavedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const SavedJob = models.SavedJob || model("SavedJob", SavedJobSchema);

export default SavedJob;
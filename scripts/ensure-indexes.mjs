import dns from "node:dns";
import mongoose from "mongoose";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore in environments where setting DNS servers is restricted
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI is not defined in environment variables or .env.local");
  process.exit(1);
}

const isApplyMode = process.argv.includes("--apply");

async function run() {
  console.log("=== Insider Jobs: Database Index & Integrity Verification ===");
  console.log(`Execution Mode: ${isApplyMode ? "APPLY (writes and deduplication permitted)" : "INSPECT ONLY (non-destructive audit)"}`);
  console.log("Connecting to MongoDB...");

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });
  } catch (connErr) {
    console.error("❌ MongoDB Connection Failed:", connErr.message);
    console.error("\nTroubleshooting connection:");
    console.error("1. Verify the MongoDB Atlas cluster is active and not paused.");
    console.error("2. Verify that your current IP address is whitelisted in MongoDB Atlas Network Access.");
    console.error("3. Verify DNS resolution for the cluster SRV record.");
    process.exit(1);
  }

  console.log("✅ Connected successfully to MongoDB.");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ Database instance not found on connection.");
    process.exit(1);
  }

  const applicationsCol = db.collection("applications");

  console.log("\n--- Phase 1: Inspecting Duplicate Applications ---");
  const duplicates = await applicationsCol
    .aggregate([
      {
        $group: {
          _id: { jobId: "$jobId", userId: "$userId" },
          count: { $sum: 1 },
          docs: { $push: { id: "$_id", createdAt: "$createdAt" } },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  if (duplicates.length === 0) {
    console.log("✅ Zero duplicate applications found. Dataset is clean.");
  } else {
    console.log(`⚠️ Detected ${duplicates.length} duplicate application group(s):`);
    for (const dup of duplicates) {
      console.log(`  - JobId: ${dup._id.jobId}, UserId: ${dup._id.userId}, Count: ${dup.count}`);
      console.log(`    Records:`, JSON.stringify(dup.docs));
    }

    if (!isApplyMode) {
      console.log("\n🔒 Non-destructive inspection mode: No records were modified.");
      console.log("To resolve duplicates and create the unique index, run with: node --env-file=.env.local scripts/ensure-indexes.mjs --apply");
    } else {
      console.log("\n🧹 Applying deduplication (preserving earliest record in each group)...");
      for (const dup of duplicates) {
        // Sort by createdAt ascending to preserve original submission
        const sorted = dup.docs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const keep = sorted[0];
        const removeIds = sorted.slice(1).map(d => d.id);
        console.log(`  Preserving ${keep.id}, deleting duplicate IDs: ${removeIds.join(", ")}`);
        await applicationsCol.deleteMany({ _id: { $in: removeIds } });
      }
      console.log("✅ Deduplication complete.");
    }
  }

  console.log("\n--- Phase 2: Inspecting and Ensuring Indexes on 'applications' ---");
  const appIndexes = await applicationsCol.indexes();
  const hasAppCompoundIndex = appIndexes.some(
    (idx) => idx.key && idx.key.jobId === 1 && idx.key.userId === 1 && idx.unique
  );

  if (hasAppCompoundIndex) {
    console.log("✅ Compound unique index { jobId: 1, userId: 1 } ALREADY EXISTS on 'applications'.");
  } else {
    console.log("⚠️ Compound unique index { jobId: 1, userId: 1 } is NOT present on 'applications'.");
    if (isApplyMode) {
      if (duplicates.length > 0 && !isApplyMode) {
        console.error("❌ Cannot create unique index while duplicate records exist.");
      } else {
        console.log("Creating unique compound index { jobId: 1, userId: 1 }...");
        await applicationsCol.createIndex({ jobId: 1, userId: 1 }, { unique: true });
        console.log("✅ Compound unique index created successfully.");
      }
    } else {
      console.log("ℹ️ In non-destructive mode: index creation skipped.");
    }
  }

  console.log("\n--- Phase 3: Inspecting Auxiliary Indexes ---");
  const jobsCol = db.collection("jobs");
  const jobIndexes = await jobsCol.indexes();
  const hasClerkIndex = jobIndexes.some(idx => idx.key && idx.key.clerkId === 1);
  const hasCreatedAtIndex = jobIndexes.some(idx => idx.key && idx.key.createdAt === -1);
  console.log(`Jobs clerkId index: ${hasClerkIndex ? "✅ Present" : "⚠️ Missing"}`);
  console.log(`Jobs createdAt index: ${hasCreatedAtIndex ? "✅ Present" : "⚠️ Missing"}`);

  const savedJobsCol = db.collection("savedjobs");
  const savedJobIndexes = await savedJobsCol.indexes();
  const hasSavedJobUnique = savedJobIndexes.some(
    idx => idx.key && idx.key.userId === 1 && idx.key.jobId === 1 && idx.unique
  );
  console.log(`SavedJobs unique compound index: ${hasSavedJobUnique ? "✅ Present" : "⚠️ Missing"}`);

  if (isApplyMode) {
    if (!hasClerkIndex) await jobsCol.createIndex({ clerkId: 1 });
    if (!hasCreatedAtIndex) await jobsCol.createIndex({ createdAt: -1 });
    if (!hasSavedJobUnique) await savedJobsCol.createIndex({ userId: 1, jobId: 1 }, { unique: true });
    console.log("✅ Auxiliary indexes verified and updated.");
  }

  console.log("\n🎉 Verification complete.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

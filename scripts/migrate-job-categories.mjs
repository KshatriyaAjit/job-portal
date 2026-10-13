import dns from "node:dns";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";

// Attempt to configure DNS for MongoDB Atlas SRV resolution
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore in environments where setting DNS servers is restricted
}

// Load .env.local if MONGODB_URI is not present in process.env
let MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const match = envContent.match(/^MONGODB_URI=(.+)$/m);
      if (match) {
        MONGODB_URI = match[1].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } catch (err) {
    console.warn("Could not read .env.local file:", err.message);
  }
}

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI is not defined in environment variables or .env.local");
  process.exit(1);
}

const isApplyMode = process.argv.includes("--apply");

const VALID_CATEGORIES = [
  "Engineering",
  "Design",
  "Data Science",
  "Mobile Development",
  "Management",
  "Marketing",
  "Sales",
  "Finance",
  "Human Resources",
  "Customer Support",
  "Startup",
  "Other",
];

function inferCategory(title = "", description = "") {
  const text = `${title} ${description}`.toLowerCase();

  if (/\b(design|designer|ui\/ux|ux|ui|figma|graphic|product designer)\b/i.test(text)) {
    return "Design";
  }
  if (/\b(data science|data scientist|machine learning|deep learning|nlp|data analyst|data engineer|analytics|ai engineer|big data)\b/i.test(text)) {
    return "Data Science";
  }
  if (/\b(mobile|ios|android|swift|kotlin|flutter|react native)\b/i.test(text)) {
    return "Mobile Development";
  }
  if (/\b(manager|management|product manager|engineering manager|project manager|scrum|director|head of|vp)\b/i.test(text)) {
    return "Management";
  }
  if (/\b(marketing|seo|sem|content marketing|social media|growth hacker|brand)\b/i.test(text)) {
    return "Marketing";
  }
  if (/\b(sales|account executive|business development|bdr|sdr|account manager)\b/i.test(text)) {
    return "Sales";
  }
  if (/\b(finance|financial|accountant|accounting|cfo|controller|payroll|tax|audit)\b/i.test(text)) {
    return "Finance";
  }
  if (/\b(hr|human resources|recruiter|recruiting|talent|people operations|people ops)\b/i.test(text)) {
    return "Human Resources";
  }
  if (/\b(support|customer support|customer success|help desk|client support)\b/i.test(text)) {
    return "Customer Support";
  }
  if (/\b(startup|founding|early stage|co-founder)\b/i.test(text)) {
    return "Startup";
  }
  if (/\b(engineer|engineering|developer|software|frontend|backend|fullstack|devops|architect|qa|programmer|coder)\b/i.test(text)) {
    return "Engineering";
  }
  return "Other";
}

async function run() {
  console.log("=== Insider Jobs: Legacy Job Category Migration & Audit ===");
  console.log(`Execution Mode: ${isApplyMode ? "APPLY (updates will be written to MongoDB)" : "DRY RUN / INSPECT ONLY (pass --apply to execute)"}`);
  console.log("Connecting to MongoDB Atlas...");

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });
  } catch (connErr) {
    console.error("❌ MongoDB Connection Failed:", connErr.message);
    process.exit(1);
  }

  console.log("✅ Connected successfully to MongoDB.\n");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ Database instance not found.");
    process.exit(1);
  }

  const jobsCol = db.collection("jobs");
  const totalJobs = await jobsCol.countDocuments({});
  console.log(`Total jobs in database: ${totalJobs}`);

  // Query for legacy jobs with missing, null, or invalid categories
  const legacyJobs = await jobsCol
    .find({
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: { $nin: VALID_CATEGORIES } },
      ],
    })
    .toArray();

  console.log(`Jobs requiring category backfill/migration: ${legacyJobs.length}`);

  if (legacyJobs.length === 0) {
    console.log("🎉 All jobs already have valid categories. No migration needed.");
    await mongoose.disconnect();
    return;
  }

  const categoryBreakdown = {};

  for (const job of legacyJobs) {
    const inferred = inferCategory(job.title, job.description);
    categoryBreakdown[inferred] = (categoryBreakdown[inferred] || 0) + 1;

    console.log(`- Job: "${job.title}" (${job._id}) -> Inferred Category: "${inferred}"`);

    if (isApplyMode) {
      await jobsCol.updateOne(
        { _id: job._id },
        { $set: { category: inferred } }
      );
    }
  }

  console.log("\n--- Inferred Category Breakdown ---");
  for (const [cat, count] of Object.entries(categoryBreakdown)) {
    console.log(`  ${cat}: ${count}`);
  }

  if (isApplyMode) {
    console.log(`\n✅ Successfully updated ${legacyJobs.length} job records in MongoDB Atlas.`);
  } else {
    console.log("\nℹ️ Dry run completed. No records were modified. Run with `--apply` to commit changes.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});


/**
 * Shared job categories and validation for Insider Jobs.
 */

export const JOB_CATEGORIES = [
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
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

/**
 * Validates whether a value is one of the supported JobCategory enum values.
 */
export function isValidJobCategory(val: unknown): val is JobCategory {
  return typeof val === "string" && (JOB_CATEGORIES as readonly string[]).includes(val);
}

/**
 * Safely infers a JobCategory for legacy jobs that were created before
 * categories were introduced to the database schema.
 */
export function inferLegacyJobCategory(title: string, description: string = ""): JobCategory {
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


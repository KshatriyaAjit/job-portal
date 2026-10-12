
export interface AdminJobDTO {
  id: string;
  title: string;
  companyName: string;
  createdAt: string;
}

export interface AdminUserDTO {
  id: string;
  clerkId: string;
  email: string;
  role: "candidate" | "recruiter";
  companyName: string | null;
  recruiterStatus: "none" | "pending" | "approved" | "rejected";
  recruiterReason: string | null;
  recruiterRequestedAt: string | null;
  recruiterReviewedAt: string | null;
  recruiterReviewedBy: string | null;
  recruiterApprovalEmailSentAt: string | null;
  createdAt: string | null;
}

export interface RecruiterOnboardingUserDTO {
  userId: string;
  email: string;
  role: "candidate" | "recruiter";
  companyName: string | null;
  recruiterStatus: "none" | "pending" | "approved" | "rejected";
  recruiterReason: string | null;
  recruiterRequestedAt: string | null;
}

export function toIdString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "bigint" || typeof val === "boolean") {
    return String(val);
  }
  if (typeof val === "object") {
    // If it's a BSON ObjectId (has toHexString or is instance of Types.ObjectId)
    if (typeof (val as { toHexString?: unknown }).toHexString === "function") {
      return (val as { toHexString: () => string }).toHexString();
    }
    // Check if it's an object with an _id property (and not self-referential)
    if ("_id" in val && (val as { _id: unknown })._id !== val && (val as { _id: unknown })._id !== undefined) {
      return toIdString((val as { _id: unknown })._id);
    }
    if (typeof (val as { toString?: unknown }).toString === "function") {
      const str = (val as { toString: () => string }).toString();
      if (str !== "[object Object]") {
        return str;
      }
    }
  }
  return String(val);
}

/**
 * Safely converts a Date, string, or number to an ISO 8601 string or null.
 */
export function toIsoStringOrNull(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString();
  }
  if (typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * Transforms a raw or Mongoose Job document into an explicit, serializable AdminJobDTO.
 * Guarantees no ObjectIds, Date objects, or model methods cross the server/client boundary.
 */
export function serializeAdminJob(job: {
  _id?: unknown;
  id?: unknown;
  title?: string | null;
  companyName?: string | null;
  createdAt?: unknown;
}): AdminJobDTO {
  return {
    id: toIdString(job._id || job.id),
    title: job.title || "",
    companyName: job.companyName || "",
    createdAt: toIsoStringOrNull(job.createdAt) || new Date().toISOString(),
  };
}

/**
 * Transforms a raw or Mongoose User document into an explicit, serializable AdminUserDTO.
 * Guarantees no ObjectIds, Date objects, or model methods cross the server/client boundary.
 */
export function serializeAdminUser(user: {
  _id?: unknown;
  id?: unknown;
  clerkId?: string | null;
  email?: string | null;
  role?: string | null;
  companyName?: string | null;
  recruiterStatus?: string | null;
  recruiterReason?: string | null;
  recruiterRequestedAt?: unknown;
  recruiterReviewedAt?: unknown;
  recruiterReviewedBy?: string | null;
  recruiterApprovalEmailSentAt?: unknown;
  createdAt?: unknown;
}): AdminUserDTO {
  return {
    id: toIdString(user._id || user.id),
    clerkId: user.clerkId || "",
    email: user.email || "",
    role: user.role === "recruiter" ? "recruiter" : "candidate",
    companyName: user.companyName ? String(user.companyName).trim() : null,
    recruiterStatus: (
      user.recruiterStatus === "pending" ||
      user.recruiterStatus === "approved" ||
      user.recruiterStatus === "rejected"
    )
      ? user.recruiterStatus
      : "none",
    recruiterReason: user.recruiterReason ? String(user.recruiterReason).trim() : null,
    recruiterRequestedAt: toIsoStringOrNull(user.recruiterRequestedAt),
    recruiterReviewedAt: toIsoStringOrNull(user.recruiterReviewedAt),
    recruiterReviewedBy: user.recruiterReviewedBy ? String(user.recruiterReviewedBy).trim() : null,
    recruiterApprovalEmailSentAt: toIsoStringOrNull(user.recruiterApprovalEmailSentAt),
    createdAt: toIsoStringOrNull(user.createdAt),
  };
}

/**
 * Transforms an authenticated User document into an explicit, serializable RecruiterOnboardingUserDTO.
 * Guarantees no ObjectIds, Date objects, or model methods cross the server/client boundary.
 */
export function serializeOnboardingUser(
  user: {
    clerkId?: string | null;
    userId?: string | null;
    email?: string | null;
    role?: string | null;
    companyName?: string | null;
    recruiterStatus?: string | null;
    recruiterReason?: string | null;
    recruiterRequestedAt?: unknown;
  } | null | undefined,
  fallbackEmail: string = ""
): RecruiterOnboardingUserDTO {
  return {
    userId: user?.clerkId || user?.userId || "",
    email: user?.email || fallbackEmail || "",
    role: user?.role === "recruiter" ? "recruiter" : "candidate",
    companyName: user?.companyName ? String(user.companyName).trim() : null,
    recruiterStatus: (
      user?.recruiterStatus === "pending" ||
      user?.recruiterStatus === "approved" ||
      user?.recruiterStatus === "rejected"
    )
      ? user.recruiterStatus
      : "none",
    recruiterReason: user?.recruiterReason ? String(user.recruiterReason).trim() : null,
    recruiterRequestedAt: toIsoStringOrNull(user?.recruiterRequestedAt),
  };
}

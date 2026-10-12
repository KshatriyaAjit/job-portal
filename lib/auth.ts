import { auth, currentUser } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db";
import User, { IUser, UserRole } from "@/models/User";

/**
 * Retrieves the trusted server-configured admin email.
 * Requires server-only ADMIN_EMAIL. Does not accept client-side NEXT_PUBLIC_ADMIN_EMAIL.
 */
export function getAdminEmail(): string | undefined {
  return process.env.ADMIN_EMAIL?.trim() || undefined;
}

/**
 * Checks if the given email corresponds to the configured administrator.
 * Fails closed if ADMIN_EMAIL is not configured or empty.
 */
export function isConfiguredAdmin(email?: string | null): boolean {
  const adminEmail = getAdminEmail();
  if (!adminEmail || !email) return false;
  return email.toLowerCase().trim() === adminEmail.toLowerCase().trim();
}

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  role: UserRole;
  dbUser: IUser;
}

/**
 * Retrieves the current authenticated user and their trusted MongoDB profile.
 * If the user exists in Clerk but not yet in MongoDB (e.g. webhook latency),
 * it synchronizes them safely with role defaults.
 * 
 * NOTE: Client-controlled unsafeMetadata is never trusted to grant recruiter or admin roles.
 * Only server-controlled publicMetadata or existing MongoDB record determines the role.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUserContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  await connectDB();
  let dbUser = await User.findOne({ clerkId: userId });

  const clerkUser = await currentUser();
  const primaryEmail =
    clerkUser?.emailAddresses?.[0]?.emailAddress || dbUser?.email || "";

  if (!dbUser && clerkUser) {
    // Determine initial role: only check server-controlled publicMetadata, NEVER client-controlled unsafeMetadata
    const initialRole: UserRole =
      (clerkUser.publicMetadata?.role as UserRole) === "recruiter"
        ? "recruiter"
        : "candidate";

    try {
      dbUser = await User.findOneAndUpdate(
        { clerkId: userId },
        {
          $setOnInsert: {
            clerkId: userId,
            email: primaryEmail,
            firstName: clerkUser.firstName || undefined,
            lastName: clerkUser.lastName || undefined,
            role: initialRole,
            recruiterStatus: initialRole === "recruiter" ? "approved" : "none",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err: unknown) {
      const mongoErr = err as { code?: number; message?: string };
      // Handle E11000 duplicate key error caused by concurrent inserts (e.g. Navbar + Onboarding page race)
      if (mongoErr?.code === 11000 || mongoErr?.message?.includes("E11000")) {
        dbUser = await User.findOne({ clerkId: userId });
      } else {
        throw err;
      }
    }
  }

  if (!dbUser) return null;

  // Defensive normalization: If a user document has recruiterStatus: "pending" but lacks
  // a valid company name (>= 2 chars), they never completed a valid onboarding submission.
  // Normalize recruiterStatus back to "none" so they are presented with the onboarding form
  // and do not appear as a phantom pending applicant in the admin dashboard.
  if (
    dbUser.recruiterStatus === "pending" &&
    (!dbUser.companyName || dbUser.companyName.trim().length < 2)
  ) {
    dbUser.recruiterStatus = "none";
    await User.updateOne({ clerkId: userId }, { recruiterStatus: "none" });
  }

  // Synchronization between Clerk server-side publicMetadata and MongoDB:
  // 1. If the user's recruiter application is pending or rejected, their effective role MUST NEVER be recruiter!
  if (dbUser.recruiterStatus === "pending" || dbUser.recruiterStatus === "rejected") {
    if (dbUser.role !== "candidate") {
      dbUser.role = "candidate";
      await User.updateOne({ clerkId: userId }, { role: "candidate" });
    }
  } else if (clerkUser?.publicMetadata?.role === "recruiter" && dbUser.role !== "recruiter") {
    // 2. If Clerk publicMetadata specifies 'recruiter' and user is not pending or rejected, synchronize to recruiter.
    dbUser.role = "recruiter";
    dbUser.recruiterStatus = "approved";
    await User.updateOne({ clerkId: userId }, { role: "recruiter", recruiterStatus: "approved" });
  } else if (clerkUser?.publicMetadata?.role === "candidate" && dbUser.role === "recruiter" && dbUser.recruiterStatus !== "approved") {
    // 3. If Clerk explicitly specifies 'candidate' and user is not an approved recruiter, synchronize to candidate.
    dbUser.role = "candidate";
    await User.updateOne({ clerkId: userId }, { role: "candidate" });
  }

  // 4. Do not silently downgrade an existing legitimate recruiter to candidate because role data is temporarily missing in Clerk.
  // The database record remains authoritative for existing and approved recruiters.

  return {
    userId,
    email: dbUser.email || primaryEmail,
    role: dbUser.role,
    dbUser,
  };
}

/**
 * Enforces that a user is authenticated. Throws an error if not.
 */
export async function requireAuth(): Promise<AuthenticatedUserContext> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Unauthorized: You must be signed in.");
  }
  return user;
}

/**
 * Enforces that the authenticated user possesses the 'recruiter' role.
 * Role check is strictly performed against the database record, never client metadata.
 */
export async function requireRecruiter(): Promise<AuthenticatedUserContext> {
  const user = await requireAuth();
  if (user.role !== "recruiter") {
    throw new Error("Forbidden: Recruiter access required.");
  }
  return user;
}

/**
 * Enforces that the authenticated user is the designated administrator.
 */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("Unauthorized: Sign in required.");
  }

  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    throw new Error("Forbidden: Admin configuration is not set on the server.");
  }

  const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
  if (!isConfiguredAdmin(primaryEmail)) {
    throw new Error("Forbidden: Admin access required.");
  }

  return {
    userId: clerkUser.id,
    email: primaryEmail!,
  };
}


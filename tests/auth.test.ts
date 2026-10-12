import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isConfiguredAdmin, getAdminEmail, requireAdmin, getAuthenticatedUser, requireRecruiter } from "@/lib/auth";

// Mock Clerk server functions
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

// Mock DB connection
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(true),
}));

// Mock User model
vi.mock("@/models/User", () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import { auth, currentUser } from "@clerk/nextjs/server";
import User from "@/models/User";

describe("Admin Authorization & Fail-Closed Behavior", () => {
  const originalAdminEmail = process.env.ADMIN_EMAIL;
  const originalPublicAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAIL = "admin@insiderjobs.com";
    delete process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  });

  afterEach(() => {
    process.env.ADMIN_EMAIL = originalAdminEmail;
    process.env.NEXT_PUBLIC_ADMIN_EMAIL = originalPublicAdminEmail;
  });

  it("identifies the configured server admin email correctly", () => {
    expect(isConfiguredAdmin("admin@insiderjobs.com")).toBe(true);
    expect(isConfiguredAdmin("ADMIN@INSIDERJOBS.COM")).toBe(true);
    expect(isConfiguredAdmin("  admin@insiderjobs.com  ")).toBe(true);
  });

  it("rejects non-admin emails", () => {
    expect(isConfiguredAdmin("candidate@example.com")).toBe(false);
    expect(isConfiguredAdmin("hacker@malicious.org")).toBe(false);
    expect(isConfiguredAdmin("")).toBe(false);
    expect(isConfiguredAdmin(null)).toBe(false);
    expect(isConfiguredAdmin(undefined)).toBe(false);
  });

  it("NEVER falls back to NEXT_PUBLIC_ADMIN_EMAIL when ADMIN_EMAIL is not set", () => {
    delete process.env.ADMIN_EMAIL;
    process.env.NEXT_PUBLIC_ADMIN_EMAIL = "attacker-controlled@public.com";

    // Admin email must return undefined, ignoring public env var
    expect(getAdminEmail()).toBeUndefined();
    // Must fail closed for any email
    expect(isConfiguredAdmin("attacker-controlled@public.com")).toBe(false);
  });

  it("fails closed when ADMIN_EMAIL is unset or empty", () => {
    delete process.env.ADMIN_EMAIL;
    expect(isConfiguredAdmin("admin@insiderjobs.com")).toBe(false);

    process.env.ADMIN_EMAIL = "   ";
    expect(isConfiguredAdmin("admin@insiderjobs.com")).toBe(false);
  });

  it("requireAdmin throws when server admin configuration is missing", async () => {
    delete process.env.ADMIN_EMAIL;
    vi.mocked(currentUser).mockResolvedValue({
      id: "admin_123",
      emailAddresses: [{ emailAddress: "someone@example.com" }],
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    await expect(requireAdmin()).rejects.toThrow(
      "Forbidden: Admin configuration is not set on the server."
    );
  });

  it("requireAdmin rejects authenticated non-admin users", async () => {
    process.env.ADMIN_EMAIL = "admin@insiderjobs.com";
    vi.mocked(currentUser).mockResolvedValue({
      id: "candidate_123",
      emailAddresses: [{ emailAddress: "regular_user@example.com" }],
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    await expect(requireAdmin()).rejects.toThrow("Forbidden: Admin access required.");
  });

  it("requireAdmin permits verified administrator", async () => {
    process.env.ADMIN_EMAIL = "admin@insiderjobs.com";
    vi.mocked(currentUser).mockResolvedValue({
      id: "admin_user_id",
      emailAddresses: [{ emailAddress: "admin@insiderjobs.com" }],
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    const admin = await requireAdmin();
    expect(admin.userId).toBe("admin_user_id");
    expect(admin.email).toBe("admin@insiderjobs.com");
  });
});

describe("Role Assignment & unsafeMetadata Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_user_1" } as unknown as Awaited<ReturnType<typeof auth>>);
  });

  it("ignores client-controlled unsafeMetadata attempting to claim recruiter role", async () => {
    vi.mocked(User.findOne).mockResolvedValue(null);
    (User.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_filter: unknown, update: unknown) => {
      const u = update as { $setOnInsert: Record<string, unknown> };
      return u?.$setOnInsert;
    });

    vi.mocked(currentUser).mockResolvedValue({
      id: "clerk_user_1",
      emailAddresses: [{ emailAddress: "attacker@example.com" }],
      // Malicious or client-side unsafeMetadata claiming recruiter
      unsafeMetadata: { role: "recruiter" },
      publicMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    await getAuthenticatedUser();

    // Verify User.findOneAndUpdate was called with role: 'candidate', NOT 'recruiter'
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { clerkId: "clerk_user_1" },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          clerkId: "clerk_user_1",
          role: "candidate",
        }),
      }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });

  it("ignores client-controlled unsafeMetadata attempting to claim admin role", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_user_2" } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(User.findOne).mockResolvedValue(null);
    (User.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_filter: unknown, update: unknown) => {
      const u = update as { $setOnInsert: Record<string, unknown> };
      return u?.$setOnInsert;
    });

    vi.mocked(currentUser).mockResolvedValue({
      id: "clerk_user_2",
      emailAddresses: [{ emailAddress: "attacker@example.com" }],
      unsafeMetadata: { role: "admin" },
      publicMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    await getAuthenticatedUser();

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { clerkId: "clerk_user_2" },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          clerkId: "clerk_user_2",
          role: "candidate",
        }),
      }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });

  it("grants recruiter role only when set via server-controlled publicMetadata", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_recruiter_1" } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(User.findOne).mockResolvedValue(null);
    (User.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_filter: unknown, update: unknown) => {
      const u = update as { $setOnInsert: Record<string, unknown> };
      return u?.$setOnInsert;
    });

    vi.mocked(currentUser).mockResolvedValue({
      id: "clerk_recruiter_1",
      emailAddresses: [{ emailAddress: "recruiter@corp.com" }],
      unsafeMetadata: {},
      publicMetadata: { role: "recruiter" },
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    await getAuthenticatedUser();

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { clerkId: "clerk_recruiter_1" },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          clerkId: "clerk_recruiter_1",
          role: "recruiter",
          recruiterStatus: "approved",
        }),
      }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });

  it("handles concurrent calls and E11000 duplicate key error race condition gracefully", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_race_1" } as unknown as Awaited<ReturnType<typeof auth>>);
    
    // First call to findOne returns null (race begins)
    // Second call to findOne (in catch block) returns the document inserted concurrently
    const createdUserDoc = {
      clerkId: "clerk_race_1",
      email: "concurrent@test.com",
      role: "candidate",
      recruiterStatus: "none",
    };
    vi.mocked(User.findOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdUserDoc);

    // Simulate E11000 duplicate key error thrown by MongoDB on concurrent upsert
    const mongoDuplicateError = new Error("E11000 duplicate key error collection: test.users index: clerkId_1 dup key: { clerkId: \"clerk_race_1\" }");
    (mongoDuplicateError as unknown as { code: number }).code = 11000;
    vi.mocked(User.findOneAndUpdate).mockRejectedValueOnce(mongoDuplicateError);

    vi.mocked(currentUser).mockResolvedValue({
      id: "clerk_race_1",
      emailAddresses: [{ emailAddress: "concurrent@test.com" }],
      publicMetadata: {},
      unsafeMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    // Should NOT throw E11000; should catch and re-query User.findOne safely
    const user = await getAuthenticatedUser();

    expect(user).not.toBeNull();
    expect(user?.userId).toBe("clerk_race_1");
    expect(user?.role).toBe("candidate");
    expect(User.findOne).toHaveBeenCalledTimes(2);
  });

  it("normalizes incomplete pending application with missing company name to status none", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "incomplete_applicant" } as unknown as Awaited<ReturnType<typeof auth>>);
    const incompleteUser = {
      clerkId: "incomplete_applicant",
      email: "incomplete@test.com",
      role: "candidate",
      recruiterStatus: "pending", // Pending but no companyName!
      companyName: "",
    };
    vi.mocked(User.findOne).mockResolvedValue(incompleteUser);
    vi.mocked(User.updateOne).mockResolvedValue({} as never);

    vi.mocked(currentUser).mockResolvedValue({
      id: "incomplete_applicant",
      emailAddresses: [{ emailAddress: "incomplete@test.com" }],
      publicMetadata: {},
      unsafeMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    const user = await getAuthenticatedUser();

    expect(user).not.toBeNull();
    expect(user?.dbUser.recruiterStatus).toBe("none");
    expect(User.updateOne).toHaveBeenCalledWith(
      { clerkId: "incomplete_applicant" },
      { recruiterStatus: "none" }
    );
  });

  it("preserves existing MongoDB user role", async () => {
    const existingDbUser = {
      clerkId: "clerk_user_1",
      email: "recruiter@corp.com",
      role: "recruiter",
    };
    vi.mocked(User.findOne).mockResolvedValue(existingDbUser);

    vi.mocked(currentUser).mockResolvedValue({
      id: "clerk_user_1",
      emailAddresses: [{ emailAddress: "recruiter@corp.com" }],
      unsafeMetadata: { role: "candidate" }, // Client tries to downgrade or tamper
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    const user = await getAuthenticatedUser();

    expect(user?.role).toBe("recruiter");
    expect(User.create).not.toHaveBeenCalled();
  });

  it("returns null when user is unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as Awaited<ReturnType<typeof auth>>);

    const user = await getAuthenticatedUser();
    expect(user).toBeNull();
  });

  it("synchronizes MongoDB role to recruiter when Clerk publicMetadata role is recruiter", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_upgrade_1" } as unknown as Awaited<ReturnType<typeof auth>>);
    const candidateDbUser = {
      clerkId: "clerk_upgrade_1",
      email: "upgraded@company.com",
      role: "candidate",
    };
    vi.mocked(User.findOne).mockResolvedValue(candidateDbUser);
    vi.mocked(User.updateOne).mockResolvedValue({} as never);

    vi.mocked(currentUser).mockResolvedValue({
      id: "clerk_upgrade_1",
      emailAddresses: [{ emailAddress: "upgraded@company.com" }],
      publicMetadata: { role: "recruiter" },
      unsafeMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    const user = await getAuthenticatedUser();

    expect(user?.role).toBe("recruiter");
    expect(User.updateOne).toHaveBeenCalledWith(
      { clerkId: "clerk_upgrade_1" },
      { role: "recruiter", recruiterStatus: "approved" }
    );
  });

  it("never silently downgrades an existing recruiter if Clerk publicMetadata is temporarily empty", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_recruiter_2" } as unknown as Awaited<ReturnType<typeof auth>>);
    const existingRecruiter = {
      clerkId: "clerk_recruiter_2",
      email: "recruiter@acme.com",
      role: "recruiter",
    };
    vi.mocked(User.findOne).mockResolvedValue(existingRecruiter);

    vi.mocked(currentUser).mockResolvedValue({
      id: "clerk_recruiter_2",
      emailAddresses: [{ emailAddress: "recruiter@acme.com" }],
      publicMetadata: {}, // Temporarily missing or empty
      unsafeMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    const user = await getAuthenticatedUser();

    expect(user?.role).toBe("recruiter");
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it("ensures a pending recruiter application strictly prevents recruiter privileges and enforces candidate role", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "pending_applicant" } as unknown as Awaited<ReturnType<typeof auth>>);
    const pendingDbUser = {
      clerkId: "pending_applicant",
      email: "applicant@startup.io",
      role: "candidate",
      recruiterStatus: "pending",
      companyName: "Startup Inc",
    };
    vi.mocked(User.findOne).mockResolvedValue(pendingDbUser);

    vi.mocked(currentUser).mockResolvedValue({
      id: "pending_applicant",
      emailAddresses: [{ emailAddress: "applicant@startup.io" }],
      publicMetadata: {},
      unsafeMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    const user = await getAuthenticatedUser();
    expect(user?.role).toBe("candidate");

    // requireRecruiter must reject the pending applicant
    await expect(requireRecruiter()).rejects.toThrow("Forbidden: Recruiter access required.");
  });

  it("ensures a rejected recruiter application does not grant recruiter privileges", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "rejected_applicant" } as unknown as Awaited<ReturnType<typeof auth>>);
    const rejectedDbUser = {
      clerkId: "rejected_applicant",
      email: "denied@corp.com",
      role: "candidate",
      recruiterStatus: "rejected",
    };
    vi.mocked(User.findOne).mockResolvedValue(rejectedDbUser);

    vi.mocked(currentUser).mockResolvedValue({
      id: "rejected_applicant",
      emailAddresses: [{ emailAddress: "denied@corp.com" }],
      publicMetadata: {},
      unsafeMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    const user = await getAuthenticatedUser();
    expect(user?.role).toBe("candidate");
    await expect(requireRecruiter()).rejects.toThrow("Forbidden: Recruiter access required.");
  });

  it("requireRecruiter rejects candidates attempting privileged recruiter access", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "candidate_user" } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(User.findOne).mockResolvedValue({
      clerkId: "candidate_user",
      email: "candidate@gmail.com",
      role: "candidate",
    });

    vi.mocked(currentUser).mockResolvedValue({
      id: "candidate_user",
      emailAddresses: [{ emailAddress: "candidate@gmail.com" }],
      publicMetadata: {},
      unsafeMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    await expect(requireRecruiter()).rejects.toThrow("Forbidden: Recruiter access required.");
  });

  it("requireRecruiter grants access to authenticated recruiters", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "recruiter_user" } as unknown as Awaited<ReturnType<typeof auth>>);
    vi.mocked(User.findOne).mockResolvedValue({
      clerkId: "recruiter_user",
      email: "recruiter@gmail.com",
      role: "recruiter",
    });

    vi.mocked(currentUser).mockResolvedValue({
      id: "recruiter_user",
      emailAddresses: [{ emailAddress: "recruiter@gmail.com" }],
      publicMetadata: { role: "recruiter" },
      unsafeMetadata: {},
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    const user = await requireRecruiter();
    expect(user.role).toBe("recruiter");
    expect(user.userId).toBe("recruiter_user");
  });

  it("confirms admin authorization remains independent of recruiter role", async () => {
    process.env.ADMIN_EMAIL = "admin@platform.com";
    vi.mocked(currentUser).mockResolvedValue({
      id: "recruiter_non_admin",
      emailAddresses: [{ emailAddress: "recruiter@acme.com" }],
      publicMetadata: { role: "recruiter" },
    } as unknown as Awaited<ReturnType<typeof currentUser>>);

    // Recruiter email is NOT admin email
    expect(isConfiguredAdmin("recruiter@acme.com")).toBe(false);
    await expect(requireAdmin()).rejects.toThrow("Forbidden: Admin access required.");
  });
});

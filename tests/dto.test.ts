import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
import {
  serializeAdminJob,
  serializeAdminUser,
  serializeOnboardingUser,
  toIdString,
  toIsoStringOrNull,
} from "@/lib/dto";

describe("Server-Client Boundary DTO Serialization (lib/dto.ts)", () => {
  describe("toIdString helper", () => {
    it("converts BSON ObjectId to primitive string", () => {
      const oid = new Types.ObjectId("507f1f77bcf86cd799439011");
      expect(toIdString(oid)).toBe("507f1f77bcf86cd799439011");
    });

    it("handles objects with _id property", () => {
      const obj = { _id: new Types.ObjectId("507f1f77bcf86cd799439012") };
      expect(toIdString(obj)).toBe("507f1f77bcf86cd799439012");
    });

    it("returns empty string for nullish values", () => {
      expect(toIdString(null)).toBe("");
      expect(toIdString(undefined)).toBe("");
    });
  });

  describe("toIsoStringOrNull helper", () => {
    it("converts Date instance to ISO 8601 string", () => {
      const d = new Date("2026-10-12T10:00:00.000Z");
      expect(toIsoStringOrNull(d)).toBe("2026-10-12T10:00:00.000Z");
    });

    it("returns null for invalid or nullish dates", () => {
      expect(toIsoStringOrNull(null)).toBeNull();
      expect(toIsoStringOrNull(undefined)).toBeNull();
      expect(toIsoStringOrNull("invalid-date-string")).toBeNull();
    });

    it("parses valid date strings into ISO format", () => {
      expect(toIsoStringOrNull("2026-03-15")).toBe(new Date("2026-03-15").toISOString());
    });
  });

  describe("serializeAdminJob", () => {
    it("converts raw Mongoose job document with ObjectId and Date into serializable DTO", () => {
      const mockJobDoc = {
        _id: new Types.ObjectId("507f1f77bcf86cd799439013"),
        title: "Senior Full Stack Engineer",
        companyName: "Acme Innovations",
        createdAt: new Date("2026-09-01T12:00:00.000Z"),
        // Simulate Mongoose document internals
        $__: {},
        _doc: {},
        toJSON: () => mockJobDoc,
      };

      const dto = serializeAdminJob(mockJobDoc);

      // Verify explicit fields
      expect(dto).toEqual({
        id: "507f1f77bcf86cd799439013",
        title: "Senior Full Stack Engineer",
        companyName: "Acme Innovations",
        createdAt: "2026-09-01T12:00:00.000Z",
      });

      // Verify no Mongoose internals or methods are present
      expect(typeof dto.id).toBe("string");
      expect((dto as unknown as Record<string, unknown>)._id).toBeUndefined();
      expect((dto as unknown as Record<string, unknown>).toJSON).toBeUndefined();
      expect((dto as unknown as Record<string, unknown>).$__).toBeUndefined();

      // Verify 100% JSON-serializable across RSC boundary
      expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    });

    it("handles missing createdAt by defaulting to current ISO timestamp", () => {
      const mockJobDoc = {
        _id: "job_string_id",
        title: "Frontend Dev",
        companyName: "Tech Ltd",
      };

      const dto = serializeAdminJob(mockJobDoc);
      expect(dto.id).toBe("job_string_id");
      expect(typeof dto.createdAt).toBe("string");
      expect(new Date(dto.createdAt).getTime()).not.toBeNaN();
    });
  });

  describe("serializeAdminUser", () => {
    it("converts raw Mongoose user document into serializable AdminUserDTO", () => {
      const mockUserDoc = {
        _id: new Types.ObjectId("507f1f77bcf86cd799439014"),
        clerkId: "user_clerk_123",
        email: "recruiter@acme.com",
        role: "recruiter",
        companyName: "  Acme Corp  ",
        recruiterStatus: "pending",
        recruiterReason: "Hiring 10 engineers",
        recruiterRequestedAt: new Date("2026-10-01T08:30:00.000Z"),
        recruiterReviewedAt: new Date("2026-10-02T09:00:00.000Z"),
        recruiterReviewedBy: "admin@insiderjobs.com",
        recruiterApprovalEmailSentAt: new Date("2026-10-02T09:05:00.000Z"),
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        // Mongoose document internals
        $__: {},
        toJSON: () => mockUserDoc,
      };

      const dto = serializeAdminUser(mockUserDoc);

      expect(dto).toEqual({
        id: "507f1f77bcf86cd799439014",
        clerkId: "user_clerk_123",
        email: "recruiter@acme.com",
        role: "recruiter",
        companyName: "Acme Corp",
        recruiterStatus: "pending",
        recruiterReason: "Hiring 10 engineers",
        recruiterRequestedAt: "2026-10-01T08:30:00.000Z",
        recruiterReviewedAt: "2026-10-02T09:00:00.000Z",
        recruiterReviewedBy: "admin@insiderjobs.com",
        recruiterApprovalEmailSentAt: "2026-10-02T09:05:00.000Z",
        createdAt: "2026-09-20T10:00:00.000Z",
      });

      // Assert all Date objects became string primitives
      expect(typeof dto.recruiterRequestedAt).toBe("string");
      expect(typeof dto.recruiterReviewedAt).toBe("string");
      expect(typeof dto.recruiterApprovalEmailSentAt).toBe("string");
      expect(typeof dto.createdAt).toBe("string");

      // Verify no toJSON method
      expect((dto as unknown as Record<string, unknown>).toJSON).toBeUndefined();

      // Verify 100% JSON-serializable
      expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    });

    it("normalizes empty and missing user fields safely to null or defaults", () => {
      const minimalUser = {
        _id: "user_id_456",
        clerkId: "user_clerk_456",
        email: "candidate@gmail.com",
      };

      const dto = serializeAdminUser(minimalUser);

      expect(dto).toEqual({
        id: "user_id_456",
        clerkId: "user_clerk_456",
        email: "candidate@gmail.com",
        role: "candidate",
        companyName: null,
        recruiterStatus: "none",
        recruiterReason: null,
        recruiterRequestedAt: null,
        recruiterReviewedAt: null,
        recruiterReviewedBy: null,
        recruiterApprovalEmailSentAt: null,
        createdAt: null,
      });
    });
  });

  describe("serializeOnboardingUser", () => {
    it("converts onboarding user data into a clean serializable DTO", () => {
      const mockDbUser = {
        _id: new Types.ObjectId("507f1f77bcf86cd799439015"),
        clerkId: "user_onboarding_1",
        email: "applicant@startup.io",
        role: "candidate",
        companyName: "Startup Inc",
        recruiterStatus: "pending",
        recruiterReason: "Scaling engineering team",
        recruiterRequestedAt: new Date("2026-10-10T14:20:00.000Z"),
        toJSON: () => mockDbUser,
      };

      const dto = serializeOnboardingUser(mockDbUser, "fallback@startup.io");

      expect(dto).toEqual({
        userId: "user_onboarding_1",
        email: "applicant@startup.io",
        role: "candidate",
        companyName: "Startup Inc",
        recruiterStatus: "pending",
        recruiterReason: "Scaling engineering team",
        recruiterRequestedAt: "2026-10-10T14:20:00.000Z",
      });

      // No methods or BSON objects
      expect((dto as unknown as Record<string, unknown>)._id).toBeUndefined();
      expect((dto as unknown as Record<string, unknown>).toJSON).toBeUndefined();

      // JSON serializable
      expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    });

    it("handles nullish input user safely using fallback email", () => {
      const dto = serializeOnboardingUser(null, "fallback@gmail.com");

      expect(dto).toEqual({
        userId: "",
        email: "fallback@gmail.com",
        role: "candidate",
        companyName: null,
        recruiterStatus: "none",
        recruiterReason: null,
        recruiterRequestedAt: null,
      });
    });
  });
});

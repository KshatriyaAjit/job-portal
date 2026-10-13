import { describe, it, expect } from "vitest";
import {
  JOB_CATEGORIES,
  isValidJobCategory,
  inferLegacyJobCategory,
} from "@/lib/categories";

describe("Job Category System (lib/categories.ts)", () => {
  it("exports all 12 canonical job categories", () => {
    const expected = [
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

    expect(JOB_CATEGORIES).toEqual(expected);
    expect(JOB_CATEGORIES).toHaveLength(12);
  });

  describe("isValidJobCategory validator", () => {
    it("validates all canonical categories as true", () => {
      for (const cat of JOB_CATEGORIES) {
        expect(isValidJobCategory(cat)).toBe(true);
      }
    });

    it("rejects invalid category names", () => {
      expect(isValidJobCategory("Frontend")).toBe(false);
      expect(isValidJobCategory("Backend Developer")).toBe(false);
      expect(isValidJobCategory("engineering")).toBe(false); // Case sensitive enum
      expect(isValidJobCategory("")).toBe(false);
      expect(isValidJobCategory("Random string")).toBe(false);
    });

    it("rejects non-string inputs", () => {
      expect(isValidJobCategory(null)).toBe(false);
      expect(isValidJobCategory(undefined)).toBe(false);
      expect(isValidJobCategory(123)).toBe(false);
      expect(isValidJobCategory({})).toBe(false);
    });
  });

  describe("inferLegacyJobCategory helper", () => {
    it("infers Design category for design-related titles and tools", () => {
      expect(inferLegacyJobCategory("UI/UX Designer")).toBe("Design");
      expect(inferLegacyJobCategory("Product Designer", "Figma and design systems")).toBe("Design");
    });

    it("infers Data Science for ML and AI roles", () => {
      expect(inferLegacyJobCategory("Machine Learning Engineer")).toBe("Data Science");
      expect(inferLegacyJobCategory("Data Analyst", "SQL and analytics")).toBe("Data Science");
      expect(inferLegacyJobCategory("Deep Learning Specialist")).toBe("Data Science");
    });

    it("infers Mobile Development for iOS, Android, and cross-platform apps", () => {
      expect(inferLegacyJobCategory("Senior iOS Engineer")).toBe("Mobile Development");
      expect(inferLegacyJobCategory("Android Developer", "Kotlin expert")).toBe("Mobile Development");
      expect(inferLegacyJobCategory("React Native App Developer")).toBe("Mobile Development");
    });

    it("infers Management for managerial and leadership titles", () => {
      expect(inferLegacyJobCategory("Engineering Manager")).toBe("Management");
      expect(inferLegacyJobCategory("Technical Product Manager")).toBe("Management");
      expect(inferLegacyJobCategory("Director of Operations")).toBe("Management");
    });

    it("infers Marketing, Sales, Finance, HR, and Support correctly", () => {
      expect(inferLegacyJobCategory("Growth Marketing Lead")).toBe("Marketing");
      expect(inferLegacyJobCategory("Account Executive - Enterprise")).toBe("Sales");
      expect(inferLegacyJobCategory("Senior Accountant")).toBe("Finance");
      expect(inferLegacyJobCategory("Technical Recruiter")).toBe("Human Resources");
      expect(inferLegacyJobCategory("Customer Support Specialist")).toBe("Customer Support");
    });

    it("infers Startup for early-stage roles", () => {
      expect(inferLegacyJobCategory("Founding Fullstack Developer")).toBe("Startup");
      expect(inferLegacyJobCategory("Early Stage Co-Founder")).toBe("Startup");
    });

    it("infers Engineering for software engineering titles", () => {
      expect(inferLegacyJobCategory("Full Stack Software Engineer")).toBe("Engineering");
      expect(inferLegacyJobCategory("DevOps Engineer", "Kubernetes, Docker")).toBe("Engineering");
      expect(inferLegacyJobCategory("Backend Developer", "Node.js and Go")).toBe("Engineering");
    });

    it("does not arbitrarily assign every old job to Engineering and defaults to Other when ambiguous", () => {
      expect(inferLegacyJobCategory("General Office Worker")).toBe("Other");
      expect(inferLegacyJobCategory("Executive Assistant")).toBe("Other");
    });
  });
});

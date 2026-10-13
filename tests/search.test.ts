import { describe, it, expect } from "vitest";
import { normalizeJobSearchParams, buildSearchPath, buildQueryString } from "@/lib/search-params";

describe("Phase 1.1 — Search, Filter, Sort & Pagination Parameter Correctness", () => {
  it("normalizes search query, location, salary, type, sort, and page safely", () => {
    const raw = {
      query: "  Frontend Engineer  ",
      location: "  San Francisco, CA  ",
      type: "Full-time, Internship",
      minSalary: "120000",
      sort: "salary_high",
      page: "3",
    };

    const parsed = normalizeJobSearchParams(raw);

    expect(parsed.query).toBe("Frontend Engineer");
    expect(parsed.location).toBe("San Francisco, CA");
    expect(parsed.type).toEqual(["Full-time", "Internship"]);
    expect(parsed.minSalary).toBe(120000);
    expect(parsed.sort).toBe("salary_high");
    expect(parsed.page).toBe(3);
  });

  it("handles invalid or malicious page numbers safely", () => {
    expect(normalizeJobSearchParams({ page: "-5" }).page).toBe(1);
    expect(normalizeJobSearchParams({ page: "not-a-number" }).page).toBe(1);
    expect(normalizeJobSearchParams({ page: "0" }).page).toBe(1);
    expect(normalizeJobSearchParams({ page: "999999999" }).page).toBe(1); // bounds check
  });

  it("handles invalid salary and sort values safely", () => {
    const parsed = normalizeJobSearchParams({
      minSalary: "-500",
      sort: "invalid_injection",
    });

    expect(parsed.minSalary).toBeUndefined();
    expect(parsed.sort).toBe("newest"); // defaults safely
  });

  it("preserves search text, location, and filters when changing page (Pagination Correctness)", () => {
    const currentParams = {
      query: "React",
      location: "Remote",
      type: "Full-time",
      minSalary: "100000",
      sort: "newest",
      page: "1",
    };

    // Navigate to Page 2
    const nextPath = buildSearchPath("/", currentParams, { page: "2" });

    expect(nextPath).toContain("page=2");
    expect(nextPath).toContain("query=React");
    expect(nextPath).toContain("location=Remote");
    expect(nextPath).toContain("type=Full-time");
    expect(nextPath).toContain("minSalary=100000");
    expect(nextPath).toContain("sort=newest");
  });

  it("resets page to 1 when search text or filters change", () => {
    const currentParams = {
      query: "React",
      location: "Remote",
      page: "4",
    };

    // User changes query to TypeScript
    const nextPath = buildSearchPath("/", currentParams, {
      query: "TypeScript",
      page: null, // removes page param to reset to page 1
    });

    expect(nextPath).toContain("query=TypeScript");
    expect(nextPath).toContain("location=Remote");
    expect(nextPath).not.toContain("page=");
  });

  it("clearing one filter preserves all unrelated selections", () => {
    const currentParams = {
      query: "Design",
      location: "New York",
      type: "Full-time,Contract",
      minSalary: "80000",
      sort: "salary_high",
    };

    // Clearing only location
    const nextPath = buildSearchPath("/", currentParams, { location: null });

    expect(nextPath).not.toContain("location");
    expect(nextPath).toContain("query=Design");
    expect(nextPath).toContain("type=Full-time%2CContract");
    expect(nextPath).toContain("minSalary=80000");
    expect(nextPath).toContain("sort=salary_high");
  });

  it("combines multiple filters correctly into a valid URL search query", () => {
    const params = new URLSearchParams();
    params.set("query", "Engineer");
    params.set("location", "Remote");

    const qs = buildQueryString(params, {
      type: "Full-time",
      minSalary: "100000",
      category: "Engineering",
    });

    expect(qs).toBe("query=Engineer&location=Remote&type=Full-time&minSalary=100000&category=Engineering");
  });

  describe("Category search parameter normalization and preservation", () => {
    it("normalizes canonical category names safely and trims whitespace", () => {
      const parsed = normalizeJobSearchParams({
        category: "  Data Science  ",
      });
      expect(parsed.category).toBe("Data Science");
    });

    it("discards unlisted or malformed category names", () => {
      expect(normalizeJobSearchParams({ category: "UnknownCategory" }).category).toBeUndefined();
      expect(normalizeJobSearchParams({ category: "engineering" }).category).toBeUndefined(); // strict case
      expect(normalizeJobSearchParams({ category: "" }).category).toBeUndefined();
    });

    it("preserves category while navigating pages and resets page on category change", () => {
      const currentParams = {
        category: "Engineering",
        location: "Remote",
        page: "2",
      };

      // Page change preserves category
      const pagePath = buildSearchPath("/", currentParams, { page: "3" });
      expect(pagePath).toContain("category=Engineering");
      expect(pagePath).toContain("location=Remote");
      expect(pagePath).toContain("page=3");

      // Category toggle resets page to 1
      const categoryPath = buildSearchPath("/", currentParams, {
        category: "Design",
        page: null,
      });
      expect(categoryPath).toContain("category=Design");
      expect(categoryPath).toContain("location=Remote");
      expect(categoryPath).not.toContain("page=");
    });

    it("clearing category preserves query, location, salary, and job type", () => {
      const currentParams = {
        query: "Lead",
        location: "New York",
        category: "Management",
        type: "Full-time",
        minSalary: "150000",
      };

      const clearedPath = buildSearchPath("/", currentParams, { category: null });
      expect(clearedPath).not.toContain("category");
      expect(clearedPath).toContain("query=Lead");
      expect(clearedPath).toContain("location=New+York");
      expect(clearedPath).toContain("type=Full-time");
      expect(clearedPath).toContain("minSalary=150000");
    });
  });
});


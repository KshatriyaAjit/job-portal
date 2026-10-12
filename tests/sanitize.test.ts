import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "@/lib/sanitize";

describe("HTML Sanitization (XSS Prevention)", () => {
  it("strips script tags and executable code", () => {
    const dirty = '<p>Normal text</p><script>alert("XSS")</script>';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("alert");
    expect(clean).toContain("<p>Normal text</p>");
  });

  it("strips inline event handlers such as onerror and onload", () => {
    const dirty = '<img src="invalid-image" onerror="alert(document.cookie)" /><b onload="steal()">Title</b>';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("onload");
    expect(clean).not.toContain("<img");
    expect(clean).toContain("<b>Title</b>");
  });

  it("neutralizes javascript: URIs in anchors", () => {
    const dirty = '<a href="javascript:alert(1)">Click here to win</a>';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("javascript:");
  });

  it("enforces rel and target attributes on safe links", () => {
    const safe = '<a href="https://example.com/jobs">View Jobs</a>';
    const clean = sanitizeRichText(safe);
    expect(clean).toContain('href="https://example.com/jobs"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
  });

  it("strips iframes, objects, and embed tags", () => {
    const dirty = '<div><iframe src="https://evil.com"></iframe><embed src="malware.swf" /></div>';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("<embed");
  });

  it("preserves legitimate rich text elements", () => {
    const rich = "<h1>Senior Engineer</h1><p>We need <b>React</b> and <i>TypeScript</i> experts.</p><ul><li>Remote</li><li>Full-time</li></ul>";
    const clean = sanitizeRichText(rich);
    expect(clean).toBe(rich);
  });

  it("handles empty or non-string inputs safely", () => {
    expect(sanitizeRichText("")).toBe("");
    expect(sanitizeRichText(null as unknown as string)).toBe("");
    expect(sanitizeRichText(undefined as unknown as string)).toBe("");
  });
});


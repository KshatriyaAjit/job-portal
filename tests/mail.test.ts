import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  getAppUrl, 
  escapeHtml, 
  sendRecruiterApprovalEmail,
  sendApplicationEmail,
  sendStatusUpdateEmail,
  sendApplicationConfirmationEmail
} from "@/lib/mail";

// Mock Resend constructor
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe("Email Utility & Resend API Response Handling (lib/mail.ts)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = "re_test_dummy_key";
    delete process.env.DEV_EMAIL_OVERRIDE;
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Application Base URL Configuration (getAppUrl)", () => {
    it("uses APP_URL when configured and trims trailing slashes", () => {
      process.env.APP_URL = "https://custom-domain.com/path/";
      expect(getAppUrl()).toBe("https://custom-domain.com/path");
    });

    it("uses NEXT_PUBLIC_APP_URL if APP_URL is absent", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://public-domain.com/";
      expect(getAppUrl()).toBe("https://public-domain.com");
    });

    it("formats VERCEL_URL properly with https:// scheme", () => {
      process.env.VERCEL_URL = "insider-jobs-preview.vercel.app";
      expect(getAppUrl()).toBe("https://insider-jobs-preview.vercel.app");

      process.env.VERCEL_URL = "https://insider-jobs-preview.vercel.app/";
      expect(getAppUrl()).toBe("https://insider-jobs-preview.vercel.app");
    });

    it("defaults to https://insiderjobs.com in production environment", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      expect(getAppUrl()).toBe("https://insiderjobs.com");
    });

    it("defaults to http://localhost:3000 in development/test environment", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      expect(getAppUrl()).toBe("http://localhost:3000");
    });
  });

  describe("HTML Escaping for User-Supplied Values (escapeHtml)", () => {
    it("escapes sensitive HTML characters to prevent HTML/XSS injection", () => {
      const malicious = '<script>alert("XSS")</script> & "Acme" \'Corp\'';
      const safe = escapeHtml(malicious);
      expect(safe).not.toContain("<script>");
      expect(safe).toContain("&lt;script&gt;");
      expect(safe).toContain("&amp;");
      expect(safe).toContain("&quot;Acme&quot;");
      expect(safe).toContain("&#039;Corp&#039;");
    });
  });

  describe("sendRecruiterApprovalEmail", () => {
    it("sends recruiter approval email with correct subject, CTA, and escaped parameters on success", async () => {
      process.env.APP_URL = "https://insiderjobs.com";
      mockSend.mockResolvedValueOnce({ data: { id: "email_msg_123" }, error: null });

      const result = await sendRecruiterApprovalEmail(
        "recruiter@acmecorp.com",
        "Jane Doe",
        "<Acme> & Co"
      );

      expect(result).toEqual({ id: "email_msg_123" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const callArg = mockSend.mock.calls[0][0];

      expect(callArg.to).toBe("recruiter@acmecorp.com");
      expect(callArg.from).toBe("onboarding@resend.dev");
      expect(callArg.subject).toBe("Your Insider Jobs Recruiter Account Has Been Approved!");
      
      // HTML assertions
      expect(callArg.html).toContain("Hi Jane Doe,");
      expect(callArg.html).toContain("&lt;Acme&gt; &amp; Co");
      expect(callArg.html).toContain("Open Recruiter Dashboard");
      expect(callArg.html).toContain("https://insiderjobs.com/dashboard");
      expect(callArg.html).toContain("Post new job listings");
      expect(callArg.html).toContain("AI candidate evaluation");

      // Text assertions
      expect(callArg.text).toContain("Hi Jane Doe,");
      expect(callArg.text).toContain("https://insiderjobs.com/dashboard");
    });

    it("handles missing company name gracefully with clean fallback copy", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "email_msg_456" }, error: null });

      const result = await sendRecruiterApprovalEmail("solo.recruiter@example.com", "Alex");

      expect(result).toEqual({ id: "email_msg_456" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const callArg = mockSend.mock.calls[0][0];
      expect(callArg.html).toContain("Hi Alex,");
      expect(callArg.html).toContain("Your recruiter application has been reviewed and approved by our administrator.");
    });

    it("respects DEV_EMAIL_OVERRIDE for local testing", async () => {
      process.env.DEV_EMAIL_OVERRIDE = "developer@test.local";
      mockSend.mockResolvedValueOnce({ data: { id: "email_msg_dev" }, error: null });

      const result = await sendRecruiterApprovalEmail(
        "real.recruiter@company.com",
        "Developer Test",
        "Test Inc"
      );

      expect(result).toEqual({ id: "email_msg_dev" });
      const callArg = mockSend.mock.calls[0][0];
      expect(callArg.to).toBe("developer@test.local");
      expect(callArg.html).toContain("Dev Note: Intended recipient: real.recruiter@company.com");
    });

    it("skips sending safely and returns null if RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendRecruiterApprovalEmail("recruiter@acme.com", "No Key Recruiter");
      expect(result).toBeNull();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("throws a meaningful error when Resend returns an API error object without throwing", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "The domain is not verified", name: "validation_error" },
      });

      await expect(
        sendRecruiterApprovalEmail("recruiter@acme.com", "Fail Recruiter")
      ).rejects.toThrow("Resend API error: The domain is not verified");
    });

    it("throws when Resend API response contains no email ID", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await expect(
        sendRecruiterApprovalEmail("recruiter@acme.com", "No ID Recruiter")
      ).rejects.toThrow("Resend API response did not contain an email ID.");
    });

    it("propagates error when Resend SDK throws a network exception", async () => {
      mockSend.mockRejectedValueOnce(new Error("Resend API down (503)"));

      await expect(
        sendRecruiterApprovalEmail("recruiter@acme.com", "Fail Recruiter")
      ).rejects.toThrow("Resend API down (503)");
    });

    it("logs a safe diagnostic confirming Resend accepted the request without exposing recipient or secrets", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      mockSend.mockResolvedValueOnce({ data: { id: "safe_id_999" }, error: null });

      await sendRecruiterApprovalEmail("private.candidate@secretcorp.com", "Safe User");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Resend] Recruiter approval email request accepted with ID: safe_id_999"
      );

      // Verify no sensitive recipient address is logged in diagnostic
      const allLogs = consoleLogSpy.mock.calls.map((args) => args.join(" ")).join("\n");
      expect(allLogs).not.toContain("private.candidate@secretcorp.com");
      consoleLogSpy.mockRestore();
    });
  });

  describe("sendApplicationEmail", () => {
    it("sends email to recruiter when candidate applies, returning accepted email ID", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "msg_app_123" }, error: null });

      const result = await sendApplicationEmail(
        "recruiter@acme.com",
        "Bob Applicant",
        "Senior React Dev",
        "https://cloudinary.com/resume.pdf"
      );

      expect(result).toEqual({ id: "msg_app_123" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0].subject).toContain("New Applicant: Bob Applicant for Senior React Dev");
    });

    it("throws a descriptive error when Resend returns an API error", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Daily quota exceeded", name: "rate_limit_exceeded" },
      });

      await expect(
        sendApplicationEmail(
          "recruiter@acme.com",
          "Bob Applicant",
          "Senior React Dev",
          "https://cloudinary.com/resume.pdf"
        )
      ).rejects.toThrow("Resend API error: Daily quota exceeded");
    });

    it("propagates thrown network exceptions", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network timeout"));

      await expect(
        sendApplicationEmail(
          "recruiter@acme.com",
          "Bob Applicant",
          "Senior React Dev",
          "https://cloudinary.com/resume.pdf"
        )
      ).rejects.toThrow("Network timeout");
    });

    it("returns null safely when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendApplicationEmail(
        "recruiter@acme.com",
        "Bob Applicant",
        "Senior React Dev",
        "https://cloudinary.com/resume.pdf"
      );

      expect(result).toBeNull();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("sendStatusUpdateEmail", () => {
    it("sends email to candidate when status updates, returning accepted email ID", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "msg_status_456" }, error: null });

      const result = await sendStatusUpdateEmail(
        "candidate@applicant.com",
        "Alice",
        "Backend Engineer",
        "interviewing"
      );

      expect(result).toEqual({ id: "msg_status_456" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0].subject).toContain("Application Update: Interviewing for Backend Engineer");
    });

    it("throws a descriptive error when Resend returns an API error", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid email address format", name: "validation_error" },
      });

      await expect(
        sendStatusUpdateEmail(
          "candidate@applicant.com",
          "Alice",
          "Backend Engineer",
          "interviewing"
        )
      ).rejects.toThrow("Resend API error: Invalid email address format");
    });

    it("propagates thrown network exceptions", async () => {
      mockSend.mockRejectedValueOnce(new Error("Connection reset"));

      await expect(
        sendStatusUpdateEmail(
          "candidate@applicant.com",
          "Alice",
          "Backend Engineer",
          "interviewing"
        )
      ).rejects.toThrow("Connection reset");
    });

    it("returns null safely when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendStatusUpdateEmail(
        "candidate@applicant.com",
        "Alice",
        "Backend Engineer",
        "interviewing"
      );

      expect(result).toBeNull();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe("sendApplicationConfirmationEmail", () => {
    it("sends confirmation email to candidate, returning accepted email ID", async () => {
      mockSend.mockResolvedValueOnce({ data: { id: "msg_confirm_789" }, error: null });

      const result = await sendApplicationConfirmationEmail(
        "candidate@applicant.com",
        "Alice",
        "Backend Engineer",
        "Acme Corp"
      );

      expect(result).toEqual({ id: "msg_confirm_789" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend.mock.calls[0][0].subject).toContain("Application Received: Backend Engineer at Acme Corp");
    });

    it("throws a descriptive error when Resend returns an API error", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "Account suspended", name: "forbidden" },
      });

      await expect(
        sendApplicationConfirmationEmail(
          "candidate@applicant.com",
          "Alice",
          "Backend Engineer",
          "Acme Corp"
        )
      ).rejects.toThrow("Resend API error: Account suspended");
    });

    it("propagates thrown network exceptions", async () => {
      mockSend.mockRejectedValueOnce(new Error("DNS lookup failure"));

      await expect(
        sendApplicationConfirmationEmail(
          "candidate@applicant.com",
          "Alice",
          "Backend Engineer",
          "Acme Corp"
        )
      ).rejects.toThrow("DNS lookup failure");
    });

    it("returns null safely when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;

      const result = await sendApplicationConfirmationEmail(
        "candidate@applicant.com",
        "Alice",
        "Backend Engineer",
        "Acme Corp"
      );

      expect(result).toBeNull();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});

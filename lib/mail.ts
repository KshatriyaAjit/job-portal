import { Resend } from "resend";

export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

// Allow an optional development redirect email if explicitly configured
function getDevOverride(): string | undefined {
  return process.env.DEV_EMAIL_OVERRIDE?.trim() || undefined;
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
}

/**
 * Returns a validated server-side application base URL.
 * Never hardcodes localhost for production.
 */
export function getAppUrl(): string {
  const envUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl?.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL?.trim()) {
    const vercel = process.env.VERCEL_URL.trim().replace(/\/+$/, "");
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }
  if (process.env.NODE_ENV === "production") {
    return "https://insiderjobs.com";
  }
  return "http://localhost:3000";
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type EmailSendResult = { id: string } | null;

interface SendEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Dispatches an email through Resend and verifies the API response.
 * Throws a descriptive error when Resend returns an API error or lacks an ID.
 * Logs a safe diagnostic on acceptance without exposing secrets.
 */
async function dispatchEmail(
  resend: Resend,
  payload: SendEmailPayload,
  emailType: string
): Promise<{ id: string }> {
  const result = await resend.emails.send(payload);

  if (result.error) {
    const errorMsg =
      result.error.message ||
      (result.error as { name?: string }).name ||
      "Unknown Resend error";
    throw new Error(`Resend API error: ${errorMsg}`);
  }

  const emailId = result.data?.id || (result as { id?: string })?.id;
  if (!emailId) {
    throw new Error("Resend API response did not contain an email ID.");
  }

  console.log(`[Resend] ${emailType} request accepted with ID: ${emailId}`);
  return { id: emailId };
}

export async function sendApplicationEmail(
  toEmail: string,
  candidateName: string,
  jobTitle: string,
  resumeUrl: string
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend is not configured (RESEND_API_KEY missing). Application notification email skipped.");
    return null;
  }

  const devOverride = getDevOverride();
  const recipient = devOverride || toEmail;
  const safeName = escapeHtml(candidateName);
  const safeTitle = escapeHtml(jobTitle);

  try {
    return await dispatchEmail(
      resend,
      {
        from: getFromEmail(),
        to: recipient,
        subject: `[Insider Jobs] New Applicant: ${safeName} for ${safeTitle}`,
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Application Received! 🚀</h2>
          <p><strong>Job:</strong> ${safeTitle}</p>
          <p><strong>Candidate:</strong> ${safeName}</p>
          <p>A candidate has applied to your position. Review their resume below:</p>
          <p style="margin: 20px 0;">
            <a href="${resumeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View Resume
            </a>
          </p>
          ${devOverride ? `<p style="color: #888; font-size: 11px;">(Dev Note: Intended recipient: ${toEmail})</p>` : ""}
        </div>
      `,
      },
      "Application notification email"
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send application email:", errMsg);
    throw error;
  }
}

export async function sendStatusUpdateEmail(
  toEmail: string,
  candidateName: string,
  jobTitle: string,
  status: string
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend is not configured (RESEND_API_KEY missing). Status update email skipped.");
    return null;
  }

  const devOverride = getDevOverride();
  const recipient = devOverride || toEmail;
  const safeName = escapeHtml(candidateName);
  const safeTitle = escapeHtml(jobTitle);
  const color = status === "accepted" ? "#16a34a" : status === "rejected" ? "#dc2626" : "#2563eb";
  const statusText = escapeHtml(status.charAt(0).toUpperCase() + status.slice(1));

  try {
    return await dispatchEmail(
      resend,
      {
        from: getFromEmail(),
        to: recipient,
        subject: `[Insider Jobs] Application Update: ${statusText} for ${safeTitle}`,
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${color};">Application Status Update</h2>
          <p>Hi ${safeName},</p>
          <p>Your application status for <strong>${safeTitle}</strong> has been updated.</p>
          
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">New Status:</p>
            <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: ${color};">
              ${statusText}
            </p>
          </div>

          <p>Log in to your Insider Jobs dashboard for more details.</p>
          ${devOverride ? `<p style="color: #888; font-size: 11px;">(Dev Note: Intended recipient: ${toEmail})</p>` : ""}
        </div>
      `,
      },
      "Status update email"
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send status update email:", errMsg);
    throw error;
  }
}

export async function sendApplicationConfirmationEmail(
  toEmail: string,
  candidateName: string,
  jobTitle: string,
  companyName: string
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend is not configured (RESEND_API_KEY missing). Confirmation email skipped.");
    return null;
  }

  const devOverride = getDevOverride();
  const recipient = devOverride || toEmail;
  const safeName = escapeHtml(candidateName);
  const safeTitle = escapeHtml(jobTitle);
  const safeCompany = escapeHtml(companyName);
  const trackUrl = `${getAppUrl()}/my-applications`;

  try {
    return await dispatchEmail(
      resend,
      {
        from: getFromEmail(),
        to: recipient,
        subject: `[Insider Jobs] Application Received: ${safeTitle} at ${safeCompany}`,
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
          <h2 style="color: #2563eb;">Application Submitted Successfully! 🎉</h2>
          <p>Hi ${safeName},</p>
          <p>We've received your application for <strong>${safeTitle}</strong> at <strong>${safeCompany}</strong>.</p>
          <p>The hiring team has been notified and will review your profile. You can monitor the real-time status of your application anytime in your Insider Jobs dashboard.</p>
          <div style="margin: 25px 0;">
            <a href="${trackUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Track My Applications
            </a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">Best of luck with your job search!</p>
          ${devOverride ? `<p style="color: #888; font-size: 11px;">(Dev Note: Intended recipient: ${toEmail})</p>` : ""}
        </div>
      `,
      },
      "Application confirmation email"
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send candidate application confirmation email:", errMsg);
    throw error;
  }
}

/**
 * Sends an email notification to a recruiter when their account is approved by an administrator.
 */
export async function sendRecruiterApprovalEmail(
  toEmail: string,
  recruiterName?: string,
  companyName?: string
): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("Resend is not configured (RESEND_API_KEY missing). Recruiter approval email skipped.");
    return null;
  }

  const devOverride = getDevOverride();
  const recipient = devOverride || toEmail;
  const safeName = escapeHtml(recruiterName?.trim() || "Recruiter");
  const safeCompany = companyName?.trim() ? escapeHtml(companyName.trim()) : "";
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const fromEmail = getFromEmail();

  const companyParagraph = safeCompany
    ? `<p>Your recruiter application for <strong>${safeCompany}</strong> has been reviewed and approved by our administrator.</p>`
    : `<p>Your recruiter application has been reviewed and approved by our administrator.</p>`;

  const companyText = safeCompany ? ` for ${safeCompany}` : "";

  try {
    return await dispatchEmail(
      resend,
      {
        from: fromEmail,
        to: recipient,
        subject: "Your Insider Jobs Recruiter Account Has Been Approved!",
        html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6; padding: 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #2563eb; color: #ffffff; width: 48px; height: 48px; line-height: 48px; border-radius: 12px; font-size: 24px; font-weight: bold;">
              💼
            </div>
            <h1 style="color: #111827; font-size: 24px; font-weight: 800; margin: 16px 0 8px 0;">
              Welcome to Insider Jobs! 🎉
            </h1>
            <p style="color: #4b5563; font-size: 16px; margin: 0;">
              Your recruiter access is now active.
            </p>
          </div>

          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="margin-top: 0;">Hi ${safeName},</p>
            <p>Congratulations! ${companyParagraph}</p>
            
            <p style="font-weight: 600; color: #111827; margin-top: 20px; margin-bottom: 8px;">
              With recruiter access enabled, you can now:
            </p>
            <ul style="padding-left: 20px; margin: 0 0 20px 0; color: #374151;">
              <li style="margin-bottom: 8px;"><strong>Post new job listings</strong> to reach qualified candidates across the platform.</li>
              <li style="margin-bottom: 8px;"><strong>Manage applicants</strong> and track hiring statuses in real-time.</li>
              <li style="margin-bottom: 8px;"><strong>Review candidates</strong> with access to profiles, skills, and resumes.</li>
              <li style="margin-bottom: 8px;"><strong>Use AI candidate evaluation</strong> to match and score candidates instantly.</li>
            </ul>

            <div style="text-align: center; margin: 30px 0 15px 0;">
              <a href="${dashboardUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block;">
                Open Recruiter Dashboard
              </a>
            </div>
            <p style="text-align: center; color: #6b7280; font-size: 12px; margin: 0;">
              Direct link: <a href="${dashboardUrl}" style="color: #2563eb; text-decoration: underline;">${dashboardUrl}</a>
            </p>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">Insider Jobs — The premier platform for modern hiring.</p>
            ${devOverride ? `<p style="color: #f59e0b; font-size: 11px; margin-top: 8px;">(Dev Note: Intended recipient: ${toEmail})</p>` : ""}
          </div>
        </div>
      `,
        text: `Hi ${safeName},

Congratulations! Your Insider Jobs recruiter account${companyText} has been approved!

Your recruiter access is now fully active. You can now:
- Post new job listings
- Manage applicants and track hiring pipeline statuses
- Review candidates with access to profiles and resumes
- Use AI candidate evaluation to match and score applicants

Open your Recruiter Dashboard here:
${dashboardUrl}

Best regards,
The Insider Jobs Team
`,
      },
      "Recruiter approval email"
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send recruiter approval email:", errMsg);
    throw error;
  }
}
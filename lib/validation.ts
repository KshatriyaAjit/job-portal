/**
 * Validation utilities for Insider Jobs.
 */

/**
 * Validates whether a given string is a valid HTTP or HTTPS URL.
 */
export function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates that a resume URL is a secure Cloudinary PDF document.
 * Requires:
 * 1. HTTPS protocol
 * 2. Trusted Cloudinary host (res.cloudinary.com)
 * 3. File path ending with .pdf
 */
export function isValidResumeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return false;
    if (url.hostname !== "res.cloudinary.com") return false;
    const pathname = url.pathname.toLowerCase();
    return pathname.endsWith(".pdf");
  } catch {
    return false;
  }
}


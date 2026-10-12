import sanitize from "sanitize-html";

export const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "b",
  "i",
  "strong",
  "em",
  "strike",
  "u",
  "ol",
  "ul",
  "li",
  "br",
  "span",
  "a",
  "blockquote",
  "pre",
  "code",
];

export const SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    span: ["class", "style"],
    p: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: (tagName, attribs) => {
      const cleanHref = attribs.href || "#";
      return {
        tagName,
        attribs: {
          ...attribs,
          href: cleanHref,
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      };
    },
  },
};

/**
 * Sanitizes rich text HTML content to eliminate XSS vectors
 * (strips scripts, event handlers, javascript: URIs, etc.)
 */
export function sanitizeRichText(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") {
    return "";
  }
  return sanitize(dirtyHtml, SANITIZE_OPTIONS);
}

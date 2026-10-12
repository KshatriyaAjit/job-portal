/**
 * Utilities for URL search parameter manipulation and validation in Insider Jobs.
 */

export interface ParsedJobFilters {
  query?: string;
  location?: string;
  type?: string[];
  minSalary?: number;
  sort?: "newest" | "oldest" | "salary_high" | "salary_low";
  page: number;
}

const VALID_SORTS = ["newest", "oldest", "salary_high", "salary_low"] as const;

/**
 * Validates, sanitizes, and normalizes raw search parameters from Next.js server page props.
 */
export function normalizeJobSearchParams(rawParams: Record<string, string | undefined>): ParsedJobFilters {
  const query = rawParams.query?.trim().slice(0, 100) || undefined;
  const location = rawParams.location?.trim().slice(0, 100) || undefined;

  // Types: comma-separated list of valid types
  let types: string[] | undefined = undefined;
  if (rawParams.type) {
    const split = rawParams.type
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (split.length > 0) {
      types = split;
    }
  }

  // Min Salary: positive integer
  let minSalary: number | undefined = undefined;
  if (rawParams.minSalary) {
    const parsed = parseInt(rawParams.minSalary, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1_000_000) {
      minSalary = parsed;
    }
  }

  // Sort: valid sort keys only
  let sort: ParsedJobFilters["sort"] = "newest";
  if (rawParams.sort && (VALID_SORTS as readonly string[]).includes(rawParams.sort)) {
    sort = rawParams.sort as ParsedJobFilters["sort"];
  }

  // Page: minimum 1, safe positive integer
  let page = 1;
  if (rawParams.page) {
    const parsedPage = parseInt(rawParams.page, 10);
    if (!isNaN(parsedPage) && parsedPage >= 1 && parsedPage <= 10_000) {
      page = parsedPage;
    }
  }

  return {
    query,
    location,
    type: types,
    minSalary,
    sort,
    page,
  };
}

/**
 * Builds a query string by merging updates into existing parameters.
 * Setting a key to null, undefined, or empty string removes it.
 *
 * @param current - current searchParams (URLSearchParams or object)
 * @param updates - parameters to update, set, or remove (null/empty deletes)
 * @returns formatted query string without leading question mark
 */
export function buildQueryString(
  current: URLSearchParams | Record<string, string | undefined>,
  updates: Record<string, string | null | undefined>
): string {
  const params = current instanceof URLSearchParams
    ? new URLSearchParams(current.toString())
    : new URLSearchParams();

  if (!(current instanceof URLSearchParams)) {
    for (const [key, val] of Object.entries(current)) {
      if (val !== undefined && val !== null && val !== "") {
        params.set(key, val);
      }
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  return params.toString();
}

/**
 * Builds a full relative path for pagination or filter changes.
 */
export function buildSearchPath(
  pathname: string,
  current: URLSearchParams | Record<string, string | undefined>,
  updates: Record<string, string | null | undefined>
): string {
  const qs = buildQueryString(current, updates);
  return qs ? `${pathname}?${qs}` : pathname;
}


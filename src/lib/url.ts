/**
 * URL normalization and validation utilities for Séance.
 * 
 * Normalization rules:
 * - Lowercase scheme and host
 * - Drop default ports (80 for http, 443 for https)
 * - Strip tracking parameters (utm_*, fbclid, gclid, msclkid)
 * - Collapse duplicate slashes in path
 * - Remove empty fragment
 */

/**
 * Check if a string is a valid HTTP/HTTPS URL.
 * @param input - The string to validate
 * @returns true if the input is a valid http:// or https:// URL
 */
export function isHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);
    // Must be http or https, and must have a non-empty hostname
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    // URL constructor accepts "http:example.com" without //, which has no host
    // We require the // separator (authority component)
    if (!input.includes("://")) {
      return false;
    }
    // Require a non-empty hostname
    if (!url.hostname) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Strip tracking parameters from a URL.
 * Tracks parameters matching: utm_*, fbclid, gclid, msclkid
 * @param url - The URL to sanitize
 * @returns The URL with tracking parameters removed
 */
function stripTrackingParams(url: URL): URL {
  const trackingParams = new Set<string>([
    "fbclid",
    "gclid",
    "msclkid",
  ]);

  // Add all utm_* parameters
  for (const param of url.searchParams.keys()) {
    if (param.startsWith("utm_")) {
      trackingParams.add(param);
    }
  }

  for (const param of trackingParams) {
    url.searchParams.delete(param);
  }

  // Remove fragment (empty or not) - fragment is not part of the normalized URL
  url.hash = "";

  return url;
}

/**
 * Normalize a URL string per Séance requirements:
 * - Lowercase scheme and host
 * - Drop default ports (80 for http, 443 for https)
 * - Strip tracking parameters
 * - Collapse duplicate slashes in path
 * - Remove fragment
 * 
 * @param input - The URL string to normalize
 * @returns The normalized URL string
 * @throws {Error} If the input is not a valid http/https URL
 */
export function normalizeUrl(input: string): string {
  // Validate input is a valid http/https URL
  if (!isHttpUrl(input)) {
    throw new Error("invalid-url");
  }

  const url = new URL(input);

  // Track if the original path had a trailing slash (excluding query/fragment)
  // This is needed because URL constructor normalizes paths
  const originalHasTrailingSlash = input.endsWith("/") && !input.includes("?", input.indexOf("://") + 3);

  // Lowercase scheme (already lowercase from URL constructor, but be explicit)
  // Lowercase host
  url.hostname = url.hostname.toLowerCase();

  // Drop default ports
  if (url.protocol === "http:" && url.port === "80") {
    url.port = "";
  } else if (url.protocol === "https:" && url.port === "443") {
    url.port = "";
  }

  // Collapse duplicate slashes in path
  // Replace multiple consecutive slashes with a single slash
  let path = url.pathname;
  path = path.replace(/\/+/g, "/");
  // Ensure path starts with a single slash
  path = path.replace(/^([^/])/, "/$1");
  // If path is empty, make it a single slash
  if (path === "") {
    path = "/";
  }
  url.pathname = path;

  // Strip tracking parameters and fragment
  stripTrackingParams(url);

  // Reconstruct the URL
  let normalized = url.href;

  // Clean up: if original had no trailing slash (or was domain-only), remove trailing slash
  // but only if the path is just "/" (domain-only case)
  if (!originalHasTrailingSlash && normalized.endsWith("/") && url.searchParams.toString() === "" && url.hash === "") {
    // Check if this is a domain-only URL (path is "/")
    if (url.pathname === "/") {
      normalized = normalized.slice(0, -1);
    }
  }

  return normalized;
}

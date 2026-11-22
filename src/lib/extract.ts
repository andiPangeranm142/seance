/**
 * Article extraction utilities for Séance.
 * 
 * Extracts clean article content from archived HTML using Readability,
 * rewrites URLs to archived copies, and converts to a sanitized ContentBlock model.
 */

import { Readability } from "@mozilla/readability";
import { Snapshot, WaybackError } from "./wayback";

/**
 * Content blocks represent the sanitized article content.
 * Never contains raw HTML strings - always parsed into structured blocks.
 */
export type ContentBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; src: string; alt: string }
  | { type: "code"; text: string };

/**
 * Represents the extracted article.
 */
export type Article = {
  title: string;
  byline: string | null;
  publishedAt: string | null;
  blocks: ContentBlock[];
  snapshot: Snapshot;
};

/**
 * Extracts article content from archived HTML using Readability.
 * 
 * Process:
 * 1. Parse HTML with DOMParser
 * 2. Clone the document (Readability modifies its input)
 * 3. Remove scripts, styles, forms, iframes from the clone
 * 4. Run Readability to extract the main content
 * 5. Parse Readability's result.content into a new document
 * 6. Rewrite image and link URLs to archived copies
 * 7. Convert the result to ContentBlock[]
 * 
 * @param html - Raw HTML string from the archive
 * @param snapshot - The snapshot metadata
 * @returns Article with sanitized content blocks
 * @throws {WaybackError} If extraction fails (no content found, DOM parsing error)
 */
export function extractArticle(html: string, snapshot: Snapshot): Article {
  // Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  if (!doc.body) {
    throw new WaybackError("extraction-failed", "No body element found in HTML");
  }

  // Clone the document - Readability modifies its input
  const docClone = doc.cloneNode(true) as Document;

  // Remove unsafe elements from the clone
  const scripts = docClone.querySelectorAll("script, style, form, iframe");
  scripts.forEach((el) => el.remove());

  // Run Readability to extract the article
  const reader = new Readability(docClone, {
    maxElemsToParse: 15000,
    nbTopCandidates: 10,
  });

  const readabilityResult = reader.parse();

  if (!readabilityResult) {
    throw new WaybackError("extraction-failed", "Readability could not extract article content");
  }

  // Extract title and metadata from Readability result
  const title = readabilityResult.title.trim();
  const byline = readabilityResult.byline?.trim() || null;
  const publishedAt = readabilityResult.publishedTime?.trim() || null;

  // Parse Readability's content HTML into a new document for conversion
  // This contains only the extracted article content, wrapped in readability-page-1 div
  const contentParser = new DOMParser();
  const contentDoc = contentParser.parseFromString(readabilityResult.content, "text/html");

  if (!contentDoc.body) {
    throw new WaybackError("extraction-failed", "Readability content has no body");
  }

  // Rewrite URLs in the content document to archived copies
  rewriteUrls(contentDoc, snapshot);

  // Remove tracking pixels from the content document
  removeTrackingPixels(contentDoc);

  // Convert the DOM to ContentBlock[]
  const blocks = convertToContentBlocks(contentDoc);

  return {
    title,
    byline,
    publishedAt,
    blocks,
    snapshot,
  };
}

/**
 * Rewrites image and link URLs to archived copies.
 * - Images: rewrite to web.archive.org/web/<ts>im_/...
 * - Links: rewrite to web.archive.org/web/<ts>... (or keep external links as-is)
 */
function rewriteUrls(doc: Document, snapshot: Snapshot): void {
  const timestamp = snapshot.timestamp;

  // Rewrite images
  const images = doc.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (src) {
      const rewritten = rewriteUrlToArchive(src, timestamp, "im_");
      img.setAttribute("src", rewritten);
    }
  });

  // Rewrite links
  const links = doc.querySelectorAll("a[href]");
  links.forEach((a) => {
    const href = a.getAttribute("href");
    if (href) {
      const rewritten = rewriteUrlToArchive(href, timestamp, "");
      a.setAttribute("href", rewritten);
    }
  });
}

/**
 * Rewrites a URL to its archived copy.
 * - Relative URLs (starting with / or without scheme) become archived copies
 * - Absolute URLs with http/https become archived copies
 * - Special URLs (javascript:, data:, mailto:, tel:, #) are left unchanged
 */
function rewriteUrlToArchive(url: string, timestamp: string, prefix: string): string {
  // Skip special protocols
  if (url.match(/^(javascript:|data:|mailto:|tel:|#)/i)) {
    return url;
  }

  // Check if already an archive URL (from web.archive.org)
  if (url.startsWith("https://web.archive.org") || url.startsWith("http://web.archive.org")) {
    return url;
  }

  // Parse the URL
  let parsed: URL | null = null;
  try {
    // Try to parse as absolute URL first
    if (url.startsWith("http://") || url.startsWith("https://")) {
      parsed = new URL(url);
    } else {
      // Relative URL - construct archive URL directly
      return `https://web.archive.org/web/${timestamp}${prefix}/${url}`;
    }
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }

  // Reconstruct the archive URL
  // Format: https://web.archive.org/web/<timestamp><prefix>/<scheme>/<host><path><query><hash>
  const archiveUrl = `https://web.archive.org/web/${timestamp}${prefix}/${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;

  return archiveUrl;
}

/**
 * Removes tracking pixel images from the document.
 * Tracks pixels are very small images (1x1 to 4x4) or have tracker-related URLs.
 */
function removeTrackingPixels(doc: Document): void {
  const images = doc.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.getAttribute("src") || "";
    const width = parseInt(img.getAttribute("width") || "0", 10);
    const height = parseInt(img.getAttribute("height") || "0", 10);

    // Remove if it's a tracking pixel:
    // 1. Very small dimensions (1x1 to 4x4)
    // 2. Tracker patterns in URL (pixel, tracker, tracking, analytics, beacon, collect, utm_)
    const isSmall = width > 0 && height > 0 && width <= 4 && height <= 4;
    const trackerPatterns = [
      "pixel",
      "tracker",
      "tracking",
      "analytics",
      "beacon",
      "collect",
      "utm_",
      "gclid",
      "fbclid",
      "msclkid",
    ];
    const srcLower = src.toLowerCase();
    const hasTrackerPattern = trackerPatterns.some((pattern) => srcLower.includes(pattern));

    if (isSmall || hasTrackerPattern) {
      img.remove();
    }
  });
}

/**
 * Converts the sanitized document DOM to ContentBlock[].
 * Processes heading, paragraph, quote, list, image, and code elements.
 */
function convertToContentBlocks(doc: Document): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const articleContent = doc.querySelector("article, #content, .content, #article, .article");

  // If there's an article element, use that; otherwise use body
  const root = articleContent || doc.body || doc.documentElement;

  // Walk through direct children of the root (depth-first)
  processNode(root, blocks);

  // Filter out empty paragraph blocks
  return blocks.filter((block) => {
    if (block.type === "paragraph") {
      return block.text.trim().length > 0;
    }
    return true;
  });
}

/**
 * Processes a node and its children, adding ContentBlocks to the array.
 */
function processNode(node: Node, blocks: ContentBlock[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node as Text).textContent || "";
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      // Add as paragraph (might be combined with sibling paragraphs)
      blocks.push({ type: "paragraph", text: trimmed });
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const el = node as HTMLElement;
  const tagName = el.tagName.toLowerCase();

  // Skip elements that should not be processed
  if (tagName === "script" || tagName === "style" || tagName === "form" || tagName === "iframe") {
    return;
  }

  // Process heading elements (h1/h2/h3)
  // Push block from textContent and do NOT recurse into children
  if (tagName === "h1" || tagName === "h2" || tagName === "h3") {
    const text = (el as HTMLElement).textContent || "";
    const level = parseInt(tagName.charAt(1), 10) as 1 | 2 | 3;
    if (text.trim().length > 0) {
      blocks.push({ type: "heading", level, text: text.trim() });
    }
    return;
  }

  // Process paragraph elements
  // Push block from textContent and do NOT recurse into children
  if (tagName === "p") {
    const text = (el as HTMLElement).textContent || "";
    if (text.trim().length > 0) {
      blocks.push({ type: "paragraph", text: text.trim() });
    }
    return;
  }

  // Process blockquote elements
  // Push block from textContent and do NOT recurse into children
  if (tagName === "blockquote") {
    const text = (el as HTMLElement).textContent || "";
    if (text.trim().length > 0) {
      blocks.push({ type: "quote", text: text.trim() });
    }
    return;
  }

  // Process ul and ol elements
  if (tagName === "ul" || tagName === "ol") {
    const items: string[] = [];
    const ordered = tagName === "ol";

    // Find all direct li children
    for (const child of el.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child as HTMLElement;
        if (childEl.tagName.toLowerCase() === "li") {
          const liText = (childEl as HTMLElement).textContent || "";
          if (liText.trim().length > 0) {
            items.push(liText.trim());
          }
          // Do NOT recurse into li children - text is already captured in items
        } else {
          processNode(child, blocks);
        }
      }
    }

    if (items.length > 0) {
      blocks.push({ type: "list", ordered, items });
    }
    return;
  }

  // Process image elements
  if (tagName === "img") {
    const src = el.getAttribute("src") || "";
    const alt = el.getAttribute("alt") || "";
    if (src.length > 0) {
      blocks.push({ type: "image", src, alt });
    }
    return;
  }

  // Process pre/code elements
  if (tagName === "pre" || tagName === "code") {
    // Get text content, preserving whitespace
    const text = (el as HTMLElement).textContent || "";
    if (text.trim().length > 0) {
      blocks.push({ type: "code", text: text });
    }
    return;
  }

  // For other elements, process children
  for (const child of el.childNodes) {
    processNode(child, blocks);
  }
}

/**
 * Extracts article content with fallback to raw text when Readability finds nothing.
 * This is a wrapper that handles the case where Readability returns null.
 * 
 * @param html - Raw HTML string from the archive
 * @param snapshot - The snapshot metadata
 * @returns Article with content blocks (may be empty if nothing found)
 */
export function extractArticleWithFallback(html: string, snapshot: Snapshot): Article {
  try {
    return extractArticle(html, snapshot);
  } catch (error) {
    // If extraction failed, try to extract some content from the body
    if ((error as WaybackError).kind === "extraction-failed") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      if (!doc.body) {
        // Return empty article
        return {
          title: snapshot.originalUrl,
          byline: null,
          publishedAt: null,
          blocks: [],
          snapshot,
        };
      }

      // Remove scripts and other unsafe content
      const scripts = doc.querySelectorAll("script, style, form, iframe");
      scripts.forEach((el) => el.remove());

      // Get text content from body
      const bodyText = doc.body.textContent || "";
      const title = doc.title || snapshot.originalUrl;

      // Split into paragraphs
      const paragraphs = bodyText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const blocks: ContentBlock[] = paragraphs.map((p) => ({
        type: "paragraph",
        text: p,
      }));

      return {
        title,
        byline: null,
        publishedAt: null,
        blocks,
        snapshot,
      };
    }
    throw error;
  }
}

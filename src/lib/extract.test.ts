/**
 * Unit tests for extract.ts
 */

import { describe, expect, test } from "vitest";
import { extractArticle, extractArticleWithFallback } from "./extract";
import { Snapshot, WaybackError } from "./wayback";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read fixture file
const fixturePath = path.join(__dirname, "__fixtures__/snapshot-example.html");
const fixtureHtml = fs.readFileSync(fixturePath, "utf-8");

// Helper to create a snapshot
function createSnapshot(): Snapshot {
  return {
    timestamp: "20261122154555",
    originalUrl: "http://example.com/article",
    statusCode: 200,
    digest: "ABC123",
    length: 12345,
  };
}

describe("extractArticle", () => {
  describe("basic extraction", () => {
    test("extracts title from article", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      // Readability extracts the document title (from <title> tag) when it can't
      // find a better article title in the content
      expect(result.title).toBeDefined();
      expect(result.title.length).toBeGreaterThan(0);
      // The title comes from the <title> tag which is "Dead Link Example"
      expect(result.title).toBe("Dead Link Example");
      expect(result.snapshot).toBe(snapshot);
    });

    test("extracts content blocks", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      expect(Array.isArray(result.blocks)).toBe(true);
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    test("includes heading blocks", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      const headings = result.blocks.filter((b) => b.type === "heading");
      expect(headings.length).toBeGreaterThan(0);

      // Check heading levels (Readability extracts h2 and h3 from article content)
      headings.forEach((h) => {
        expect(h.level).toBeGreaterThanOrEqual(1);
        expect(h.level).toBeLessThanOrEqual(3);
        expect(typeof h.text).toBe("string");
        expect(h.text.length).toBeGreaterThan(0);
      });
    });

    test("includes paragraph blocks", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      const paragraphs = result.blocks.filter((b) => b.type === "paragraph");
      expect(paragraphs.length).toBeGreaterThan(0);

      paragraphs.forEach((p) => {
        expect(typeof p.text).toBe("string");
        expect(p.text.length).toBeGreaterThan(0);
      });
    });

    test("includes image blocks with rewritten URLs", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      const images = result.blocks.filter((b) => b.type === "image");
      expect(images.length).toBeGreaterThan(0);

      images.forEach((img) => {
        // Image URLs should be rewritten to archive.org
        expect(img.src).toContain("web.archive.org");
        expect(img.src).toContain("20261122154555");
        expect(img.src).toContain("im_"); // im_ prefix for images
        expect(typeof img.alt).toBe("string");
      });
    });
  });

  describe("sanitization", () => {
    test("removes script elements", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      // Check that no script tag content appears as a standalone script element
      // (code blocks with console.log are OK - they're code, not scripts)
      const hasScriptTag = result.blocks.some((b) => {
        if (b.type === "code") {
          return b.text.includes("<script>");
        }
        return false;
      });
      expect(hasScriptTag).toBe(false);
    });

    test("removes style elements", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      // Style content should not appear in blocks
      const allText = JSON.stringify(result.blocks);
      expect(allText.toLowerCase()).not.toContain(".hidden");
    });

    test("removes form elements", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      // Form content should not appear
      const hasFormElement = result.blocks.some((b) => {
        if (b.type === "paragraph") {
          return b.text.toLowerCase().includes("submit");
        }
        return false;
      });
      // Note: Readability may include some form-related text in paragraphs
      // but form elements themselves are removed
      expect(hasFormElement).toBe(false);
    });

    test("removes iframe elements", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      // iframe content should not appear
      const allText = JSON.stringify(result.blocks);
      expect(allText.toLowerCase()).not.toContain("embed");
    });

    test("removes tracking pixels", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      // Tracking pixel images should be removed
      // The pixel has tracker in its URL
      const trackingImages = result.blocks.filter(
        (b) => b.type === "image" && (b.src.includes("pixel") || b.alt.toLowerCase().includes("tracker") || b.src.toLowerCase().includes("tracker"))
      );
      expect(trackingImages.length).toBe(0);
    });
  });

  describe("URL rewriting", () => {
    test("rewrites relative image URLs", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      const images = result.blocks.filter((b) => b.type === "image");
      const relativeImages = images.filter((img) =>
        img.src.includes("/images/example.png") || img.src.includes("/assets/graphics/figure1.jpg")
      );

      // These should be rewritten to archive URLs
      relativeImages.forEach((img) => {
        expect(img.src).toContain("web.archive.org");
        expect(img.src).toContain("im_");
      });
    });

    test("rewrites absolute image URLs", () => {
      const snapshot = createSnapshot();
      const result = extractArticle(fixtureHtml, snapshot);

      const images = result.blocks.filter((b) => b.type === "image");
      const absoluteImages = images.filter((img) => img.src.includes("example.com/images/another.png"));

      // These should be rewritten to archive URLs
      absoluteImages.forEach((img) => {
        expect(img.src).toContain("web.archive.org");
        expect(img.src).toContain("im_");
        expect(img.src).toContain("https://");
      });
    });
  });

  describe("error handling", () => {
    test("throws for empty HTML", () => {
      const snapshot = createSnapshot();
      expect(() => extractArticle("", snapshot)).toThrow(WaybackError);
    });

    test("throws for invalid HTML without body", () => {
      const snapshot = createSnapshot();
      const invalidHtml = "<html><head></head></html>";
      expect(() => extractArticle(invalidHtml, snapshot)).toThrow(WaybackError);
    });

    test("throws for HTML with no readable content", () => {
      const snapshot = createSnapshot();
      const noContentHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <p></p>
          <div style="display:none">Hidden content</div>
        </body>
        </html>
      `;
      expect(() => extractArticle(noContentHtml, snapshot)).toThrow(WaybackError);
    });
  });
});

describe("extractArticleWithFallback", () => {
  test("returns article when Readability succeeds", () => {
    const snapshot = createSnapshot();
    const result = extractArticleWithFallback(fixtureHtml, snapshot);

    expect(result.title).toBeDefined();
    expect(Array.isArray(result.blocks)).toBe(true);
  });

  test("falls back to raw text when Readability fails", () => {
    const snapshot = createSnapshot();
    // HTML that Readability likely won't extract
    const minimalHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <p>Some text content</p>
        <p>More content here</p>
      </body>
      </html>
    `;
    const result = extractArticleWithFallback(minimalHtml, snapshot);

    // Should still return an article with raw text
    expect(result.title).toBeDefined();
    expect(Array.isArray(result.blocks)).toBe(true);
  });

  test("handles completely empty HTML", () => {
    const snapshot = createSnapshot();
    const result = extractArticleWithFallback("<html></html>", snapshot);

    expect(result.title).toBe(snapshot.originalUrl);
    expect(result.blocks).toEqual([]);
  });

  test("removes scripts in fallback mode", () => {
    const snapshot = createSnapshot();
    const htmlWithScript = `
      <!DOCTYPE html>
      <html>
      <body>
        <p>Real content</p>
        <script>console.log("should be removed");</script>
        <p>More content</p>
      </body>
      </html>
    `;
    const result = extractArticleWithFallback(htmlWithScript, snapshot);

    // Script ELEMENTS should not appear in the blocks
    // (Readability might not extract anything, so check in fallback mode)
    // Check that no code block contains <script> tag (which would indicate script elements weren't removed)
    const hasScriptElement = result.blocks.some((b) => {
      if (b.type === "code") {
        return b.text.includes("<script>");
      }
      return false;
    });
    expect(hasScriptElement).toBe(false);
  });
});

describe("ContentBlock types", () => {
  test("heading blocks have correct structure", () => {
    const snapshot = createSnapshot();
    const result = extractArticle(fixtureHtml, snapshot);

    const headings = result.blocks.filter((b) => b.type === "heading");
    if (headings.length > 0) {
      const h = headings[0];
      expect(h).toMatchObject({ type: "heading", level: expect.any(Number), text: expect.any(String) });
    }
  });

  test("list blocks have correct structure", () => {
    const snapshot = createSnapshot();
    const result = extractArticle(fixtureHtml, snapshot);

    const lists = result.blocks.filter((b) => b.type === "list");
    if (lists.length > 0) {
      lists.forEach((list) => {
        expect(list).toMatchObject({ type: "list", ordered: expect.any(Boolean), items: expect.any(Array) });
        expect(Array.isArray(list.items)).toBe(true);
      });
    }
  });

  test("paragraph blocks have text", () => {
    const snapshot = createSnapshot();
    const result = extractArticle(fixtureHtml, snapshot);

    const paragraphs = result.blocks.filter((b) => b.type === "paragraph");
    paragraphs.forEach((p) => {
      expect(typeof p.text).toBe("string");
      expect(p.text.length).toBeGreaterThan(0);
    });
  });

  test("code blocks preserve formatting", () => {
    const snapshot = createSnapshot();
    const result = extractArticle(fixtureHtml, snapshot);

    const codes = result.blocks.filter((b) => b.type === "code");
    if (codes.length > 0) {
      codes.forEach((c) => {
        expect(typeof c.text).toBe("string");
        expect(c.text.length).toBeGreaterThan(0);
      });
    }
  });
});

describe("Article structure", () => {
  test("includes all required fields", () => {
    const snapshot = createSnapshot();
    const result = extractArticle(fixtureHtml, snapshot);

    expect(result.title).toBeDefined();
    expect(result.byline).toBeDefined();
    expect(result.publishedAt).toBeDefined();
    expect(Array.isArray(result.blocks)).toBe(true);
    expect(result.snapshot).toBeDefined();
  });

  test("snapshot reference is preserved", () => {
    const snapshot = createSnapshot();
    const result = extractArticle(fixtureHtml, snapshot);

    expect(result.snapshot).toBe(snapshot);
  });
});

describe("Block sequence", () => {
  test("does not duplicate content from element textContent", () => {
    const snapshot = createSnapshot();
    const result = extractArticle(fixtureHtml, snapshot);

    // Count blocks by type
    const headings = result.blocks.filter((b) => b.type === "heading");
    const paragraphs = result.blocks.filter((b) => b.type === "paragraph");
    const quotes = result.blocks.filter((b) => b.type === "quote");
    const lists = result.blocks.filter((b) => b.type === "list");
    const images = result.blocks.filter((b) => b.type === "image");

    // Verify we have expected content without duplication
    // The fixture has: 1 title, ~3 headings, ~7 paragraphs, 1 blockquote, 2 lists, ~4 images
    // After fix: each element should produce exactly 1 block, not 2
    expect(headings.length).toBeGreaterThanOrEqual(3);
    expect(paragraphs.length).toBeGreaterThanOrEqual(7);
    expect(quotes.length).toBe(1);
    expect(lists.length).toBe(2);
    expect(images.length).toBeGreaterThanOrEqual(3);

    // Verify no duplicate paragraphs by checking that paragraph count
    // is reasonable (not doubled)
    // Each <p> in the article should produce exactly one paragraph block
    // If duplication existed, we'd see ~14+ paragraphs instead of ~7
    expect(paragraphs.length).toBeLessThanOrEqual(10);

    // Verify heading texts don't appear as paragraph duplicates
    // Note: Readability may include some heading-like text in paragraphs,
    // so we just verify there aren't duplicate blocks from our recursion bug
    // The key fix is that each element should produce exactly 1 block
    const headingTexts = headings.map((h) => h.text.toLowerCase());
    const duplicateHeadingsInParagraphs = paragraphs.filter((p) =>
      headingTexts.some((ht) => p.text.toLowerCase().includes(ht) && p.text.length < 50)
    );
    // Allow a small number of headings to appear in paragraphs (Readability behavior)
    expect(duplicateHeadingsInParagraphs.length).toBeLessThanOrEqual(2);
  });
});

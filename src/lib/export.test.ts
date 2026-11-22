/**
 * Unit tests for export.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, test, beforeEach, vi } from "vitest";
import { toMarkdown, toStandaloneHtml, download } from "./export";
import { extractArticle } from "./extract";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read fixture file
const fixturePath = path.join(__dirname, "__fixtures__/snapshot-example.html");
const fixtureHtml = fs.readFileSync(fixturePath, "utf-8");

// Helper to create an article from the fixture
function createArticle() {
  const snapshot = {
    timestamp: "20261122154555",
    originalUrl: "http://example.com/article",
    statusCode: 200,
  };
  return extractArticle(fixtureHtml, snapshot);
}

describe("toMarkdown", () => {
  test("includes title", () => {
    const article = createArticle();
    const markdown = toMarkdown(article);

    expect(markdown).toContain(`# ${article.title}`);
  });

  test("includes original URL", () => {
    const article = createArticle();
    const markdown = toMarkdown(article);

    expect(markdown).toContain(`Original URL: ${article.snapshot.originalUrl}`);
  });

  test("includes snapshot timestamp", () => {
    const article = createArticle();
    const markdown = toMarkdown(article);

    expect(markdown).toContain(`Snapshot: ${article.snapshot.timestamp}`);
  });

  test("includes display date", () => {
    const article = createArticle();
    const markdown = toMarkdown(article);

    // Display date format: "22 Nov 2026, 15:45 UTC"
    expect(markdown).toMatch(/\(\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC\)/);
  });

  test("includes content blocks", () => {
    const article = createArticle();
    const markdown = toMarkdown(article);

    // Check that content blocks are converted to markdown
    // At minimum, we should have some text from the article
    expect(markdown.length).toBeGreaterThan(100);

    // Should contain some headings
    const headingCount = (markdown.match(/^##+/gm) || []).length;
    expect(headingCount).toBeGreaterThan(0);
  });

  test("handles special characters in title", () => {
    const article = createArticle();
    const articleWithSpecialChars = {
      ...article,
      title: "Test & <Special> *Chars_ [Here] ~",
    };

    const markdown = toMarkdown(articleWithSpecialChars);

    // Should escape special Markdown characters in heading
    // The escapeMarkdownHeading function escapes * _ [ ] > ~ (and more)
    // The actual output shows these characters escaped
    expect(markdown).toContain("# Test & <Special\\> \\*Chars\\_ \\[Here\\] \\~");
  });

  test("produces valid markdown structure", () => {
    const article = createArticle();
    const markdown = toMarkdown(article);

    // First line should be the title
    const lines = markdown.split("\n");
    expect(lines[0]).toMatch(/^# .+/);
  });

  test("empty article produces minimal valid markdown", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const markdown = toMarkdown(article);

    expect(markdown).toContain("# Test");
    expect(markdown).toContain("Original URL: http://example.com");
    expect(markdown).toContain("Snapshot: 20261122154555");
  });
});

describe("toStandaloneHtml", () => {
  test("includes title in <title> tag", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    expect(html).toContain(`<title>${article.title}</title>`);
  });

  test("includes title in h1", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    expect(html).toContain(`<h1>${article.title}</h1>`);
  });

  test("includes original URL", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    expect(html).toContain(article.snapshot.originalUrl);
  });

  test("includes snapshot timestamp", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    expect(html).toContain(article.snapshot.timestamp);
  });

  test("includes display date", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    // Display date format: "22 Nov 2026, 15:45 UTC"
    expect(html).toMatch(/\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC/);
  });

  test("has inline CSS (no external stylesheets)", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    // Should not have any <link rel="stylesheet">
    expect(html).not.toMatch(/<link[^>]*rel=["']stylesheet["']/);

    // Should have <style> tag
    expect(html).toMatch(/<style[^>]*>/);
  });

  test("has no external scripts", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    // Should not have any <script> tags (except potentially inline)
    expect(html).not.toMatch(/<script[^>]*src=["']/);
  });

  test("includes archive.org link", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    expect(html).toContain("https://web.archive.org/web/");
    expect(html).toContain("id_/"); // id_ suffix for original HTML
  });

  test("contains content blocks", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    // Should contain the article content
    expect(html.length).toBeGreaterThan(500);
  });

  test("sanitizes HTML in article content", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    // Should escape HTML entities
    expect(html).not.toContain("<script>");
  });

  test("produces valid HTML structure", () => {
    const article = createArticle();
    const html = toStandaloneHtml(article);

    // Should start with DOCTYPE
    expect(html).toMatch(/^<!DOCTYPE html>/);

    // Should have html, head, body tags
    expect(html).toMatch(/<html[^>]*>/);
    expect(html).toMatch(/<head[^>]*>/);
    expect(html).toMatch(/<body[^>]*>/);
  });

  test("empty article produces valid HTML", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    expect(html).toContain("<title>Test</title>");
    expect(html).toContain("<h1>Test</h1>");
    expect(html).toContain("http://example.com");
  });
});

describe("download", () => {
  beforeEach(() => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockUrl = {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(() => {}),
    };
    vi.stubGlobal("URL", mockUrl);

    // Mock document.createElement and element methods
    const mockElement = {
      href: "",
      download: "",
      click: () => {},
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return mockElement;
      }
      return {} as any;
    });

    vi.spyOn(document.body, "appendChild").mockImplementation(() => undefined as any);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => undefined as any);
  });

  test("creates blob and downloads file", () => {
    const filename = "test.txt";
    const content = "test content";
    const mimeType = "text/plain";

    let capturedBlobType: string | undefined;

    // Capture the blob constructor
    const originalBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob implements Blob {
      constructor(_parts: any[], options: any) {
        if (options && options.type) {
          capturedBlobType = options.type;
        }
      }
      get type() { return capturedBlobType ?? ""; }
      get size() { return 0; }
      text() { return Promise.resolve(""); }
      arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
      slice() { return new Blob(); }
      stream() { return new ReadableStream(); }
      bytes() { return Promise.resolve(new Uint8Array(0)); }
    } as any;

    const downloadSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return {
          href: "",
          download: "",
          click: downloadSpy,
        } as any;
      }
      return {} as any;
    });

    download(filename, content, mimeType);

    expect(capturedBlobType).toBe("text/plain");
    expect(downloadSpy).toHaveBeenCalled();

    // Restore original Blob
    globalThis.Blob = originalBlob;
  });

  test("calls click on link", () => {
    const filename = "test.txt";
    const content = "test content";

    const downloadSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return {
          href: "",
          download: "",
          click: downloadSpy,
        } as any;
      }
      return {} as any;
    });

    download(filename, content);

    expect(downloadSpy).toHaveBeenCalled();
  });

  test("defaults to text/plain MIME type", () => {
    const filename = "test.txt";
    const content = "test content";

    let capturedBlobType: string | undefined;
    const originalBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob implements Blob {
      constructor(_parts: any[], options: any) {
        if (options && options.type) {
          capturedBlobType = options.type;
        }
      }
      get type() { return capturedBlobType ?? ""; }
      get size() { return 0; }
      text() { return Promise.resolve(""); }
      arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
      slice() { return new Blob(); }
      stream() { return new ReadableStream(); }
      bytes() { return Promise.resolve(new Uint8Array(0)); }
    } as any;

    const downloadSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return {
          href: "",
          download: "",
          click: downloadSpy,
        } as any;
      }
      return {} as any;
    });

    download(filename, content);

    expect(capturedBlobType).toBe("text/plain");

    globalThis.Blob = originalBlob;
  });

  test("revokes object URL after download", () => {
    const filename = "test.txt";
    const content = "test content";

    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return {
          href: "",
          download: "",
          click: () => {},
        } as any;
      }
      return {} as any;
    });

    download(filename, content);

    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  test("sets download filename", () => {
    const filename = "test.md";
    const content = "test content";

    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return {
          href: "",
          download: "",
          click: () => {},
        } as any;
      }
      return {} as any;
    });

    // We can't directly test the filename without mocking more,
    // but we can verify the function completes without error
    expect(() => download(filename, content)).not.toThrow();
  });
});

describe("markdown conversion of content blocks", () => {
  test("converts heading blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "heading" as const, level: 1 as const, text: "Main Title" },
        { type: "heading" as const, level: 2 as const, text: "Section" },
        { type: "heading" as const, level: 3 as const, text: "Subsection" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const markdown = toMarkdown(article);

    expect(markdown).toContain("# Main Title");
    expect(markdown).toContain("## Section");
    expect(markdown).toContain("### Subsection");
  });

  test("converts paragraph blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "paragraph" as const, text: "First paragraph" },
        { type: "paragraph" as const, text: "Second paragraph" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const markdown = toMarkdown(article);

    expect(markdown).toContain("First paragraph");
    expect(markdown).toContain("Second paragraph");
  });

  test("converts quote blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "quote" as const, text: "A quote" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const markdown = toMarkdown(article);

    expect(markdown).toContain("> A quote");
  });

  test("converts unordered list blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "list" as const, ordered: false, items: ["Item 1", "Item 2", "Item 3"] },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const markdown = toMarkdown(article);

    expect(markdown).toContain("- Item 1");
    expect(markdown).toContain("- Item 2");
    expect(markdown).toContain("- Item 3");
  });

  test("converts ordered list blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "list" as const, ordered: true, items: ["Step 1", "Step 2"] },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const markdown = toMarkdown(article);

    expect(markdown).toContain("1. Step 1");
    expect(markdown).toContain("1. Step 2");
  });

  test("converts image blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "image" as const, src: "http://example.com/img.png", alt: "Image alt" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const markdown = toMarkdown(article);

    expect(markdown).toContain("![Image alt](http://example.com/img.png)");
  });

  test("converts code blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "code" as const, text: "function test() {}" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const markdown = toMarkdown(article);

    expect(markdown).toContain("```");
    expect(markdown).toContain("function test() {}");
  });
});

describe("html conversion of content blocks", () => {
  test("converts heading blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "heading" as const, level: 1 as const, text: "Main Title" },
        { type: "heading" as const, level: 2 as const, text: "Section" },
        { type: "heading" as const, level: 3 as const, text: "Subsection" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    expect(html).toContain("<h1>Main Title</h1>");
    expect(html).toContain("<h2>Section</h2>");
    expect(html).toContain("<h3>Subsection</h3>");
  });

  test("converts paragraph blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "paragraph" as const, text: "First paragraph" },
        { type: "paragraph" as const, text: "Second paragraph" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    expect(html).toContain("<p>First paragraph</p>");
    expect(html).toContain("<p>Second paragraph</p>");
  });

  test("converts quote blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "quote" as const, text: "A quote" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    expect(html).toContain("<blockquote>A quote</blockquote>");
  });

  test("converts unordered list blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "list" as const, ordered: false, items: ["Item 1", "Item 2"] },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<li>Item 2</li>");
    expect(html).toContain("</ul>");
  });

  test("converts ordered list blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "list" as const, ordered: true, items: ["Step 1", "Step 2"] },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    expect(html).toContain("<ol>");
    expect(html).toContain("<li>Step 1</li>");
    expect(html).toContain("<li>Step 2</li>");
    expect(html).toContain("</ol>");
  });

  test("converts image blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "image" as const, src: "http://example.com/img.png", alt: "Image alt" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    expect(html).toContain('<img src="http://example.com/img.png" alt="Image alt">');
  });

  test("converts code blocks", () => {
    const article = {
      title: "Test",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "code" as const, text: "function test() {}" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    expect(html).toContain("<pre>");
    expect(html).toContain("<code>function test() {}</code>");
    expect(html).toContain("</pre>");
  });

  test("sanitizes HTML entities in content", () => {
    const article = {
      title: "Test & <Special>",
      byline: null,
      publishedAt: null,
      blocks: [
        { type: "paragraph" as const, text: "Text with & < > \" ' characters" },
      ],
      snapshot: {
        timestamp: "20261122154555",
        originalUrl: "http://example.com",
        statusCode: 200,
      },
    };

    const html = toStandaloneHtml(article);

    // Should escape HTML entities
    expect(html).not.toContain("<script>");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&quot;");
    expect(html).toContain("&#039;");
  });
});

/**
 * Export utilities for Séance.
 * 
 * Converts an Article to Markdown or standalone HTML formats,
 * and provides a download helper for file downloads.
 */

import type { Article } from "./extract";

/**
 * Export article as Markdown.
 * 
 * Format:
 * ```
 * # <title>
 * 
 * Original URL: <originalUrl>
 * Snapshot: <timestamp> (<displayDate>)
 * 
 * <content blocks converted to markdown>
 * ```
 * 
 * @param article - The article to export
 * @returns Markdown string
 */
export function toMarkdown(article: Article): string {
  const { title, snapshot } = article;
  const originalUrl = snapshot.originalUrl;
  const timestamp = snapshot.timestamp;
  const displayDate = formatDisplay(timestamp);

  const lines: string[] = [];

  // Title (as h1)
  lines.push(`# ${escapeMarkdownHeading(title)}`);
  lines.push("");

  // Metadata
  lines.push(`Original URL: ${originalUrl}`);
  lines.push(`Snapshot: ${timestamp} (${displayDate})`);
  lines.push("");

  // Content blocks
  for (const block of article.blocks) {
    lines.push(convertBlockToMarkdown(block));
  }

  return lines.join("\n");
}

/**
 * Export article as standalone HTML.
 * 
 * The HTML includes:
 * - Inline CSS (no external stylesheets)
 * - No external scripts (except potentially images from archive)
 * - Clean structure with title, metadata, and content
 * 
 * @param article - The article to export
 * @returns HTML string
 */
export function toStandaloneHtml(article: Article): string {
  const { title, snapshot } = article;
  const originalUrl = snapshot.originalUrl;
  const timestamp = snapshot.timestamp;
  const displayDate = formatDisplay(timestamp);

  // Build content blocks HTML
  const contentHtml = article.blocks
    .map((block) => convertBlockToHtml(block))
    .join("\n");

  // Inline CSS for standalone HTML
  const styles = `
    :root {
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif;
      --max-width: 720px;
      --line-height: 1.6;
      --color-text: #1a1a1a;
      --color-muted: #666;
      --color-link: #2563eb;
      --color-bg: #ffffff;
      --color-quote-border: #e5e7eb;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: var(--font-family);
      line-height: var(--line-height);
      color: var(--color-text);
      background: var(--color-bg);
      margin: 0;
      padding: 20px;
    }

    .article {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 12px 0;
      line-height: 1.2;
    }

    .metadata {
      font-size: 0.875rem;
      color: var(--color-muted);
    }

    .metadata a {
      color: var(--color-link);
      text-decoration: none;
    }

    .metadata a:hover {
      text-decoration: underline;
    }

    .content {
      margin-top: 24px;
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 24px 0 12px 0;
      line-height: 1.3;
    }

    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 20px 0 10px 0;
      line-height: 1.3;
    }

    p {
      margin: 12px 0;
    }

    blockquote {
      border-left: 4px solid var(--color-quote-border);
      padding-left: 16px;
      margin: 16px 0;
      color: var(--color-muted);
    }

    ul, ol {
      margin: 12px 0;
      padding-left: 24px;
    }

    li {
      margin: 4px 0;
    }

    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.875em;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
    }

    pre {
      background: #f3f4f6;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 16px 0;
    }

    pre code {
      background: transparent;
      padding: 0;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    a {
      color: var(--color-link);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .archive-link {
      font-size: 0.75rem;
      color: var(--color-muted);
    }

    .archive-link a {
      color: var(--color-link);
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="article">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <div class="metadata">
        <p>Original URL: <a href="${escapeHtml(originalUrl)}">${escapeHtml(originalUrl)}</a></p>
        <p>Snapshot: ${timestamp} (${displayDate})</p>
        <p class="archive-link"><a href="https://web.archive.org/web/${timestamp}id_/${encodeURIComponent(originalUrl)}">View original archive</a></p>
      </div>
    </div>
    <div class="content">
${contentHtml}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Download content as a file.
 * 
 * @param filename - The filename (with extension)
 * @param content - The file content
 * @param mimeType - The MIME type (default: "text/plain")
 */
export function download(filename: string, content: string, mimeType: string = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format a Wayback timestamp into a human-readable display string.
 * This is a local copy to avoid circular imports.
 */
function formatDisplay(timestamp: string): string {
  const date = new Date(
    parseInt(timestamp.slice(0, 4), 10),
    parseInt(timestamp.slice(4, 6), 10) - 1,
    parseInt(timestamp.slice(6, 8), 10),
    parseInt(timestamp.slice(8, 10), 10),
    parseInt(timestamp.slice(10, 12), 10),
    parseInt(timestamp.slice(12, 14), 10),
  );

  const day = date.getUTCDate();
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hour = date.getUTCHours().toString().padStart(2, "0");
  const minute = date.getUTCMinutes().toString().padStart(2, "0");

  return `${day} ${month} ${year}, ${hour}:${minute} UTC`;
}

/**
 * Convert a ContentBlock to Markdown.
 */
function convertBlockToMarkdown(block: Article["blocks"][number]): string {
  switch (block.type) {
    case "heading":
      return `${"#".repeat(block.level)} ${escapeMarkdownHeading(block.text)}\n`;
    case "paragraph":
      return `${block.text}\n`;
    case "quote":
      return `> ${escapeMarkdownBlockquote(block.text)}\n`;
    case "list":
      return block.items
        .map((item) => `${block.ordered ? "1." : "-"} ${escapeMarkdownList(item)}`)
        .join("\n") + "\n";
    case "image":
      return `![${escapeMarkdownText(block.alt)}](${escapeMarkdownText(block.src)})\n`;
    case "code":
      return `\`\`\`\n${block.text}\n\`\`\`\n`;
    default:
      return "";
  }
}

/**
 * Convert a ContentBlock to HTML.
 */
function convertBlockToHtml(block: Article["blocks"][number]): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
    case "paragraph":
      return `<p>${escapeHtml(block.text)}</p>`;
    case "quote":
      return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("\n");
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case "image":
      return `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}">`;
    case "code":
      return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
    default:
      return "";
  }
}

/**
 * Escape text for Markdown inline context.
 */
function escapeMarkdownText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/[*_[\]()~`>+#-]/g, "\\$&");
}

/**
 * Escape text for Markdown heading context.
 */
function escapeMarkdownHeading(text: string): string {
  // Same as inline, but also handle leading space
  const escaped = escapeMarkdownText(text);
  return escaped.replace(/^ /, "\\ ");
}

/**
 * Escape text for Markdown blockquote context.
 */
function escapeMarkdownBlockquote(text: string): string {
  // Escape > characters and other special chars
  return text
    .replace(/>/g, "\\>")
    .replace(/\n/g, "\n> ");
}

/**
 * Escape text for Markdown list item context.
 */
function escapeMarkdownList(text: string): string {
  // Escape list markers
  return text
    .replace(/^(\s)*(-|\*)/g, "\\$1$2")
    .replace(/^(\s)*(1\.)/g, "\\$1$2");
}

/**
 * Escape text for HTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

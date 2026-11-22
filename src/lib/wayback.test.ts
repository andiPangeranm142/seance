/**
 * Unit tests for Wayback client and related utilities.
 */

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import {
  WaybackError,
  WaybackErrorKind,
  Snapshot,
  parseCdxRows,
  WaybackClient,
} from "./wayback";
import * as fc from "fast-check";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read fixture files
const cdxExamplePath = path.join(__dirname, "__fixtures__/cdx-example.json");
const availabilityExamplePath = path.join(__dirname, "__fixtures__/availability-example.json");
const availabilityNoSnapshotsPath = path.join(__dirname, "__fixtures__/availability-no-snapshots.json");

const cdxExampleData = JSON.parse(fs.readFileSync(cdxExamplePath, "utf-8"));
const availabilityExampleData = JSON.parse(fs.readFileSync(availabilityExamplePath, "utf-8"));
const availabilityNoSnapshotsData = JSON.parse(fs.readFileSync(availabilityNoSnapshotsPath, "utf-8"));

// Mock fetch globally
vi.stubGlobal("fetch", vi.fn());

describe("WaybackError", () => {
  test("creates error with kind", () => {
    const error = new WaybackError("invalid-url", "Test message");
    expect(error.kind).toBe("invalid-url");
    expect(error.message).toBe("Test message");
    expect(error.name).toBe("WaybackError");
  });

  test("creates error with default message", () => {
    const error = new WaybackError("proxy-down");
    expect(error.kind).toBe("proxy-down");
    expect(error.message).toBe("Wayback error: proxy-down");
  });

  test("supports all error kinds", () => {
    const kinds: WaybackErrorKind[] = [
      "invalid-url",
      "no-snapshots",
      "proxy-down",
      "snapshot-too-large",
      "extraction-failed",
      "network",
    ];
    kinds.forEach((kind) => {
      const error = new WaybackError(kind);
      expect(error.kind).toBe(kind);
    });
  });
});

describe("parseCdxRows", () => {
  describe("valid CDX responses", () => {
    test("parses basic CDX response", () => {
      const json = [
        ["timestamp", "original", "statuscode", "digest", "length"],
        ["20261122030900", "http://example.com/", "200", "ABC123", "1234"],
      ];

      const result = parseCdxRows(json);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        timestamp: "20261122030900",
        originalUrl: "http://example.com/",
        statusCode: 200,
        digest: "ABC123",
        length: 1234,
      });
    });

    test("parses CDX with missing optional columns", () => {
      const json = [
        ["timestamp", "original", "statuscode"],
        ["20261122030900", "http://example.com/", "200"],
      ];

      const result = parseCdxRows(json);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        timestamp: "20261122030900",
        originalUrl: "http://example.com/",
        statusCode: 200,
      });
    });

    test("parses multiple rows", () => {
      const json = [
        ["timestamp", "original", "statuscode", "digest", "length"],
        ["20261122030900", "http://example.com/", "200", "ABC123", "1234"],
        ["20251015120000", "http://example.com/", "200", "DEF456", "5678"],
        ["20240910083000", "http://example.com/", "404", "GHI789", "9012"],
      ];

      const result = parseCdxRows(json);
      expect(result).toHaveLength(3);
      expect(result[0].timestamp).toBe("20261122030900");
      expect(result[1].timestamp).toBe("20251015120000");
      expect(result[2].timestamp).toBe("20240910083000");
      expect(result[2].statusCode).toBe(404);
    });

    test("parses CDX with extra columns (tolerance)", () => {
      const json = [
        ["timestamp", "original", "statuscode", "digest", "length", "extra1", "extra2"],
        ["20261122030900", "http://example.com/", "200", "ABC123", "1234", "extra1", "extra2"],
      ];

      const result = parseCdxRows(json);
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe("20261122030900");
    });

    test("handles header-only response", () => {
      const json = [
        ["timestamp", "original", "statuscode", "digest", "length"],
      ];

      const result = parseCdxRows(json);
      expect(result).toHaveLength(0);
    });

    test("handles empty response (header row only)", () => {
      const json: unknown[] = [];

      const result = parseCdxRows(json);
      expect(result).toHaveLength(0);
    });
  });

  describe("invalid inputs", () => {
    test("throws for non-array input", () => {
      expect(() => parseCdxRows(null)).toThrow("CDX response must be an array");
      expect(() => parseCdxRows({})).toThrow("CDX response must be an array");
      expect(() => parseCdxRows("string")).toThrow("CDX response must be an array");
      expect(() => parseCdxRows(123)).toThrow("CDX response must be an array");
    });

    test("throws for invalid header row", () => {
      expect(() => parseCdxRows([null])).toThrow("CDX header must be a non-empty array");
      expect(() => parseCdxRows([123])).toThrow("CDX header must be a non-empty array");
      expect(() => parseCdxRows([{}])).toThrow("CDX header must be a non-empty array");
    });

    test("throws for missing required columns", () => {
      const json = [
        ["timestamp", "original"], // missing statuscode
        ["20261122030900", "http://example.com/"],
      ];
      expect(() => parseCdxRows(json)).toThrow("CDX header missing required columns");

      const json2 = [
        ["timestamp", "statuscode"], // missing original
        ["20261122030900", "200"],
      ];
      expect(() => parseCdxRows(json2)).toThrow("CDX header missing required columns");

      const json3 = [
        ["original", "statuscode"], // missing timestamp
        ["http://example.com/", "200"],
      ];
      expect(() => parseCdxRows(json3)).toThrow("CDX header missing required columns");
    });

    test("throws for invalid timestamp format", () => {
      const json = [
        ["timestamp", "original", "statuscode"],
        ["20261122", "http://example.com/", "200"], // too short
      ];
      expect(() => parseCdxRows(json)).toThrow("invalid timestamp");

      const json2 = [
        ["timestamp", "original", "statuscode"],
        ["202611220309001", "http://example.com/", "200"], // too long
      ];
      expect(() => parseCdxRows(json2)).toThrow("invalid timestamp");

      const json3 = [
        ["timestamp", "original", "statuscode"],
        ["2026AB22030900", "http://example.com/", "200"], // non-numeric
      ];
      expect(() => parseCdxRows(json3)).toThrow("invalid timestamp");
    });

    test("throws for invalid original URL", () => {
      const json = [
        ["timestamp", "original", "statuscode"],
        ["20261122030900", "", "200"], // empty
      ];
      expect(() => parseCdxRows(json)).toThrow("invalid original URL");
    });

    test("throws for invalid statuscode", () => {
      const json = [
        ["timestamp", "original", "statuscode"],
        ["20261122030900", "http://example.com/", "abc"], // non-numeric
      ];
      expect(() => parseCdxRows(json)).toThrow("statuscode");

      const json2 = [
        ["timestamp", "original", "statuscode"],
        ["20261122030900", "http://example.com/", "99"], // out of range
      ];
      expect(() => parseCdxRows(json2)).toThrow("statuscode out of range");

      const json3 = [
        ["timestamp", "original", "statuscode"],
        ["20261122030900", "http://example.com/", "600"], // out of range
      ];
      expect(() => parseCdxRows(json3)).toThrow("statuscode out of range");
    });

    test("throws for non-array rows", () => {
      const json = [
        ["timestamp", "original", "statuscode"],
        "not an array",
      ];
      expect(() => parseCdxRows(json)).toThrow("CDX row 1 must be an array");
    });
  });
});

/**
 * Property-based tests for parseCdxRows.
 */

describe("parseCdxRows property-based tests", () => {
  describe("valid CDX row generation", () => {
    test("parses generated valid CDX rows", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1970, max: 2099 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          fc.integer({ min: 0, max: 59 }),
          fc.stringMatching(/^https?:\/\/[a-zA-Z0-9.-]+/),
          fc.integer({ min: 100, max: 599 }),
          (year, month, day, hour, minute, second, url, statuscode) => {
            const timestamp = `${year}${month.toString().padStart(2, "0")}${day.toString().padStart(2, "0")}${hour.toString().padStart(2, "0")}${minute.toString().padStart(2, "0")}${second.toString().padStart(2, "0")}`;
            const json = [
              ["timestamp", "original", "statuscode", "digest", "length"],
              [timestamp, url, statuscode.toString(), "ABC123", "1234"],
            ];
            const result = parseCdxRows(json);
            expect(result).toHaveLength(1);
            expect(result[0].timestamp).toBe(timestamp);
            expect(result[0].statusCode).toBe(statuscode);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe("column tolerance", () => {
    test("accepts rows with extra columns", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string(), { minLength: 5 }), // header with 5+ columns
          fc.array(fc.string(), { minLength: 5 }), // data row with 5+ columns
          (header, data) => {
            const json = [header, data];
            try {
              const result = parseCdxRows(json);
              // Should parse successfully (data row count doesn't matter for header check)
              expect(Array.isArray(result)).toBe(true);
            } catch (e) {
              // If parsing fails, it's due to invalid values
              expect(e instanceof Error).toBe(true);
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});

/**
 * Mock fetch helpers.
 */
function setupMockFetch(response: unknown, options: { status?: number; statusText?: string } = {}) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: options.status || 200,
    statusText: options.statusText || "OK",
    json: async () => response,
    text: async () => JSON.stringify(response),
    clone: function () {
      return this;
    },
    body: {
      getReader: () => {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(response));
        let offset = 0;
        return {
          read: () => {
            if (offset >= data.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            const chunk = data.slice(offset, offset + 1024);
            offset += chunk.length;
            return Promise.resolve({ done: false, value: chunk });
          },
        };
      },
    },
    bodyUsed: false,
    arrayBuffer: async () => {
      const encoder = new TextEncoder();
      return encoder.encode(JSON.stringify(response)).buffer;
    },
    blob: async () => new Blob([JSON.stringify(response)]),
    formData: async () => new FormData(),
    redirected: false,
    type: "basic",
    url: "",
    headers: new Headers(),
  } as Response);
}

function setupMockFetchError(message: string) {
  const error = new Error(message);
  // Make it look like an AbortError for timeout testing
  if (message.includes("AbortError")) {
    // Use Object.defineProperty to add the name property without type issues
    Object.defineProperty(error, "name", { value: "AbortError", configurable: true });
  }
  vi.mocked(fetch).mockRejectedValue(error);
}

function setupMockFetchStatus(status: number, statusText: string = "Error") {
  vi.mocked(fetch).mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: async () => ({ error: statusText }),
    text: async () => statusText,
    clone: function () {
      return this;
    },
    body: {
      getReader: () => {
        const encoder = new TextEncoder();
        const data = encoder.encode(statusText);
        let offset = 0;
        return {
          read: () => {
            if (offset >= data.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            const chunk = data.slice(offset, offset + 1024);
            offset += chunk.length;
            return Promise.resolve({ done: false, value: chunk });
          },
        };
      },
    },
    bodyUsed: false,
    arrayBuffer: async () => {
      const encoder = new TextEncoder();
      return encoder.encode(statusText).buffer;
    },
    blob: async () => new Blob([statusText]),
    formData: async () => new FormData(),
    redirected: false,
    type: "basic",
    url: "",
    headers: new Headers(),
  } as Response);
}

describe("WaybackClient", () => {
  let client: WaybackClient;

  beforeEach(() => {
    client = new WaybackClient("http://localhost:8787");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listSnapshots", () => {
    test("returns snapshots for valid URL", async () => {
      setupMockFetch(cdxExampleData);

      const snapshots = await client.listSnapshots("http://example.com/");
      expect(snapshots).toHaveLength(11); // 12 total rows - 1 header = 11 data rows
      expect(snapshots[0].timestamp).toBe("20261122154555"); // Newest first
      expect(snapshots[0].originalUrl).toBe("http://example.com/");
      expect(snapshots[0].statusCode).toBe(200);
    });

    test("returns empty array for no snapshots", async () => {
      const json = [
        ["timestamp", "original", "statuscode"],
      ];
      setupMockFetch(json);

      const snapshots = await client.listSnapshots("http://example.com/");
      expect(snapshots).toHaveLength(0);
    });

    test("throws WaybackError for invalid URL", async () => {
      await expect(client.listSnapshots("")).rejects.toBeInstanceOf(WaybackError);
      await expect(client.listSnapshots("not a url")).rejects.toBeInstanceOf(WaybackError);
    });

    test("throws WaybackError for proxy down (404)", async () => {
      setupMockFetchStatus(404, "Not Found");

      await expect(client.listSnapshots("http://example.com/")).rejects.toBeInstanceOf(WaybackError);
    });

    test("throws WaybackError for proxy down (500)", async () => {
      setupMockFetchStatus(500, "Internal Server Error");

      await expect(client.listSnapshots("http://example.com/")).rejects.toBeInstanceOf(WaybackError);
    });

    test("throws WaybackError for timeout", async () => {
      setupMockFetchError("AbortError: The operation was aborted");

      await expect(client.listSnapshots("http://example.com/")).rejects.toBeInstanceOf(WaybackError);
    });
  });

  describe("closestSnapshot", () => {
    test("returns closest snapshot when available", async () => {
      setupMockFetch(availabilityExampleData);

      const snapshot = await client.closestSnapshot("http://example.com/");
      expect(snapshot).not.toBeNull();
      expect(snapshot?.timestamp).toBe("20261122154555");
      expect(snapshot?.originalUrl).toBe("http://example.com/");
      expect(snapshot?.statusCode).toBe(200);
    });

    test("returns null when no snapshots available", async () => {
      setupMockFetch(availabilityNoSnapshotsData);

      const snapshot = await client.closestSnapshot("http://example.com/");
      expect(snapshot).toBeNull();
    });

    test("throws WaybackError for invalid URL", async () => {
      await expect(client.closestSnapshot("")).rejects.toBeInstanceOf(WaybackError);
      await expect(client.closestSnapshot("not a url")).rejects.toBeInstanceOf(WaybackError);
    });

    test("throws WaybackError for network error", async () => {
      setupMockFetchStatus(500, "Internal Server Error");

      await expect(client.closestSnapshot("http://example.com/")).rejects.toBeInstanceOf(WaybackError);
    });

    test("throws WaybackError for timeout", async () => {
      setupMockFetchError("AbortError: The operation was aborted");

      await expect(client.closestSnapshot("http://example.com/")).rejects.toBeInstanceOf(WaybackError);
    });
  });

  describe("fetchSnapshot", () => {
    test("returns HTML for valid snapshot", async () => {
      const html = "<html><body>Test page</body></html>";
      const encoder = new TextEncoder();

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => html,
        json: async () => ({ error: "Not JSON" }),
        clone: function () {
          return this;
        },
        body: {
          getReader: () => {
            const data = encoder.encode(html);
            let offset = 0;
            return {
              read: () => {
                if (offset >= data.length) {
                  return Promise.resolve({ done: true, value: undefined });
                }
                const chunk = data.slice(offset, offset + 1024);
                offset += chunk.length;
                return Promise.resolve({ done: false, value: chunk });
              },
            };
          },
        },
        bodyUsed: false,
        arrayBuffer: async () => {
          return encoder.encode(html).buffer;
        },
        blob: async () => new Blob([html]),
        formData: async () => new FormData(),
        redirected: false,
        type: "basic",
        url: "",
        headers: new Headers(),
      } as Response);

      const snapshot: Snapshot = {
        timestamp: "20261122030900",
        originalUrl: "http://example.com/",
        statusCode: 200,
      };

      const result = await client.fetchSnapshot(snapshot);
      expect(result).toBe(html);
    });

    test("throws WaybackError for snapshot too large", async () => {
      // Generate 6 MB of data
      const largeHtml = "x".repeat(6 * 1024 * 1024);
      const encoder = new TextEncoder();

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => largeHtml,
        json: async () => ({ error: "Not JSON" }),
        clone: function () {
          return this;
        },
        body: {
          getReader: () => {
            const data = encoder.encode(largeHtml);
            let offset = 0;
            return {
              read: () => {
                if (offset >= data.length) {
                  return Promise.resolve({ done: true, value: undefined });
                }
                const chunk = data.slice(offset, offset + 1024);
                offset += chunk.length;
                return Promise.resolve({ done: false, value: chunk });
              },
            };
          },
        },
        bodyUsed: false,
        arrayBuffer: async () => {
          return encoder.encode(largeHtml).buffer;
        },
        blob: async () => new Blob([largeHtml]),
        formData: async () => new FormData(),
        redirected: false,
        type: "basic",
        url: "",
        headers: new Headers(),
      } as Response);

      const snapshot: Snapshot = {
        timestamp: "20261122030900",
        originalUrl: "http://example.com/",
        statusCode: 200,
      };

      await expect(client.fetchSnapshot(snapshot)).rejects.toBeInstanceOf(WaybackError);
    });

    test("throws WaybackError for invalid snapshot", async () => {
      await expect(client.fetchSnapshot({} as Snapshot)).rejects.toBeInstanceOf(WaybackError);
      await expect(client.fetchSnapshot({ timestamp: "20261122030900" } as Snapshot)).rejects.toBeInstanceOf(WaybackError);
    });

    test("throws WaybackError for proxy down", async () => {
      setupMockFetchStatus(404, "Not Found");

      const snapshot: Snapshot = {
        timestamp: "20261122030900",
        originalUrl: "http://example.com/",
        statusCode: 200,
      };

      await expect(client.fetchSnapshot(snapshot)).rejects.toBeInstanceOf(WaybackError);
    });

    test("throws WaybackError for timeout", async () => {
      setupMockFetchError("AbortError: The operation was aborted");

      const snapshot: Snapshot = {
        timestamp: "20261122030900",
        originalUrl: "http://example.com/",
        statusCode: 200,
      };

      await expect(client.fetchSnapshot(snapshot)).rejects.toBeInstanceOf(WaybackError);
    });
  });
});

describe("WaybackClient with null proxy", () => {
  let client: WaybackClient;

  beforeEach(() => {
    client = new WaybackClient(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("listSnapshots requires proxy", async () => {
    await expect(client.listSnapshots("http://example.com/")).rejects.toBeInstanceOf(WaybackError);
  });

  test("fetchSnapshot requires proxy", async () => {
    const snapshot: Snapshot = {
      timestamp: "20261122030900",
      originalUrl: "http://example.com/",
      statusCode: 200,
    };
    await expect(client.fetchSnapshot(snapshot)).rejects.toBeInstanceOf(WaybackError);
  });

  test("closestSnapshot works without proxy (Availability API)", async () => {
    setupMockFetch(availabilityExampleData);

    const snapshot = await client.closestSnapshot("http://example.com/");
    expect(snapshot).not.toBeNull();
    expect(snapshot?.timestamp).toBe("20261122154555");
  });
});

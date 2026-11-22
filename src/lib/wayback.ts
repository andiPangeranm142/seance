/**
 * Wayback Machine client for Séance.
 * 
 * Provides methods to interact with the Wayback Machine:
 * - listSnapshots: Query CDX API via proxy (monthly collapsed, up to 200 rows)
 * - closestSnapshot: Query Availability API directly
 * - fetchSnapshot: Fetch raw snapshot HTML via proxy (5 MB guard)
 */

/**
 * Error kinds for Wayback Machine operations.
 */
export type WaybackErrorKind =
  | "invalid-url"
  | "no-snapshots"
  | "proxy-down"
  | "snapshot-too-large"
  | "extraction-failed"
  | "network";

/**
 * Custom error class for Wayback Machine operations.
 */
export class WaybackError extends Error {
  kind: WaybackErrorKind;

  constructor(kind: WaybackErrorKind, message?: string) {
    super(message || `Wayback error: ${kind}`);
    this.kind = kind;
    this.name = "WaybackError";
  }
}

/**
 * Represents a snapshot from the Wayback Machine.
 */
export type Snapshot = {
  timestamp: string; // 14-digit UTC "YYYYMMDDHHMMSS"
  originalUrl: string;
  statusCode: number;
  digest?: string;
  length?: number;
};

/**
 * Parses CDX JSON response into an array of Snapshot objects.
 * 
 * The CDX API returns JSON as an array where:
 * - First row is the header row (column names)
 * - Subsequent rows are data rows
 * 
 * This function:
 * - Skips the header row
 * - Maps each data row to a Snapshot
 * - Tolerates extra columns
 * - Validates required fields
 * 
 * @param json - The parsed CDX JSON response (array of arrays)
 * @returns Array of Snapshot objects
 * @throws {Error} If parsing fails due to invalid data
 */
export function parseCdxRows(json: unknown): Snapshot[] {
  if (!Array.isArray(json)) {
    throw new Error("CDX response must be an array");
  }

  if (json.length === 0) {
    return [];
  }

  // First row is the header
  const header = json[0];
  if (!Array.isArray(header) || header.length === 0) {
    throw new Error("CDX header must be a non-empty array");
  }

  // Column indices
  const timestampIdx = header.indexOf("timestamp");
  const originalIdx = header.indexOf("original");
  const statuscodeIdx = header.indexOf("statuscode");
  const digestIdx = header.indexOf("digest");
  const lengthIdx = header.indexOf("length");

  if (timestampIdx === -1 || originalIdx === -1 || statuscodeIdx === -1) {
    throw new Error("CDX header missing required columns: timestamp, original, statuscode");
  }

  // Parse data rows (skip header)
  const snapshots: Snapshot[] = [];
  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    if (!Array.isArray(row)) {
      throw new Error(`CDX row ${i} must be an array`);
    }

    const timestamp = row[timestampIdx];
    const original = row[originalIdx];
    const statuscodeStr = row[statuscodeIdx];
    const digest = digestIdx >= 0 ? row[digestIdx] : undefined;
    const lengthStr = lengthIdx >= 0 ? row[lengthIdx] : undefined;

    // Validate required fields
    if (typeof timestamp !== "string" || timestamp.length !== 14 || !/^\d{14}$/.test(timestamp)) {
      throw new Error(`CDX row ${i}: invalid timestamp "${timestamp}"`);
    }
    if (typeof original !== "string" || original.length === 0) {
      throw new Error(`CDX row ${i}: invalid original URL "${original}"`);
    }
    if (typeof statuscodeStr !== "string") {
      throw new Error(`CDX row ${i}: invalid statuscode "${statuscodeStr}"`);
    }

    const statusCode = parseInt(statuscodeStr, 10);
    if (isNaN(statusCode) || statusCode < 100 || statusCode > 599) {
      throw new Error(`CDX row ${i}: statuscode out of range "${statuscodeStr}"`);
    }

    const snapshot: Snapshot = {
      timestamp,
      originalUrl: original,
      statusCode,
    };

    if (digest !== undefined && typeof digest === "string") {
      snapshot.digest = digest;
    }

    if (lengthStr !== undefined && typeof lengthStr === "string") {
      const length = parseInt(lengthStr, 10);
      if (!isNaN(length)) {
        snapshot.length = length;
      }
    }

    snapshots.push(snapshot);
  }

  return snapshots;
}

/**
 * WaybackClient class for interacting with the Wayback Machine.
 */
export class WaybackClient {
  private proxyUrl: string | null;

  /**
   * Create a new WaybackClient.
   * @param proxyUrl - The proxy URL, or null to use direct (fallback) mode
   */
  constructor(proxyUrl: string | null) {
    this.proxyUrl = proxyUrl;
  }

  /**
   * List snapshots for a URL using the CDX API via proxy.
   * Uses monthly collapse and limits to 200 rows.
   * 
   * @param url - The URL to query
   * @returns Array of Snapshot objects, newest first
   * @throws {WaybackError} If the URL is invalid or the proxy is down
   */
  async listSnapshots(url: string): Promise<Snapshot[]> {
    // Validate URL first
    if (!url || typeof url !== "string") {
      throw new WaybackError("invalid-url", "Invalid URL");
    }

    // Construct CDX API URL via proxy
    // CDX format: url, timestamp, original, statuscode, digest, length
    // Collapse on timestamp:6 (monthly) to reduce rows
    // Filter for statuscode:200 (successful captures)
    // Output format: json
    const encodedUrl = encodeURIComponent(url);
    const cdxUrl = this.proxyUrl
      ? `${this.proxyUrl}/cdx/search/cdx?url=${encodedUrl}&collapse=timestamp:6&filter=statuscode:200&fl=timestamp,original,statuscode,digest,length&limit=200&output=json`
      : `https://web.archive.org/cdx/search/cdx?url=${encodedUrl}&collapse=timestamp:6&filter=statuscode:200&fl=timestamp,original,statuscode,digest,length&limit=200&output=json`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);

      let response: Response;

      if (this.proxyUrl) {
        response = await fetch(cdxUrl, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Accept": "application/json",
          },
        });
      } else {
        // Direct fetch (no proxy) - for Availability API fallback mode
        // This should not be used for CDX as it lacks CORS
        throw new WaybackError("proxy-down", "CDX queries require proxy");
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new WaybackError("proxy-down", `Proxy returned status ${response.status}`);
      }

      const data = await response.json();

      // CDX JSON format: array of arrays, first row is header
      if (!Array.isArray(data)) {
        throw new WaybackError("proxy-down", "CDX response is not an array");
      }

      const snapshots = parseCdxRows(data);

      // Sort by timestamp descending (newest first)
      snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      return snapshots;
    } catch (error: unknown) {
      if (error instanceof WaybackError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new WaybackError("proxy-down", "CDX request timed out");
        }
      }
      throw new WaybackError("network", `Network error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the closest snapshot for a URL using the Availability API directly.
   * 
   * @param url - The URL to query
   * @returns Snapshot object if found, null otherwise
   * @throws {WaybackError} If the URL is invalid
   */
  async closestSnapshot(url: string): Promise<Snapshot | null> {
    // Validate URL first
    if (!url || typeof url !== "string") {
      throw new WaybackError("invalid-url", "Invalid URL");
    }

    // Availability API endpoint (CORS-enabled, no proxy needed)
    const encodedUrl = encodeURIComponent(url);
    const availabilityUrl = `https://archive.org/wayback/available?url=${encodedUrl}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);

      const response = await fetch(availabilityUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new WaybackError("network", `Availability API returned status ${response.status}`);
      }

      const data: AvailabilityResponse = await response.json();

      // Check if there's a closest snapshot
      if (!data.archived_snapshots || !data.archived_snapshots.closest) {
        return null;
      }

      const closest = data.archived_snapshots.closest;

      // Validate and parse the snapshot data
      if (!closest.timestamp || !closest.url) {
        return null;
      }

      // Parse status code
      const statusCode = typeof closest.statuscode === "string"
        ? parseInt(closest.statuscode, 10)
        : closest.statuscode;

      if (isNaN(statusCode)) {
        return null;
      }

      return {
        timestamp: closest.timestamp,
        originalUrl: closest.url,
        statusCode,
        digest: closest.checksum,
        length: closest.length ? parseInt(closest.length, 10) : undefined,
      };
    } catch (error: unknown) {
      if (error instanceof WaybackError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new WaybackError("network", "Availability API request timed out");
        }
      }
      throw new WaybackError("network", `Network error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch raw snapshot HTML via proxy.
   * Includes a 5 MB response size guard.
   * 
   * @param snapshot - The snapshot to fetch
   * @returns Raw HTML string
   * @throws {WaybackError} If the proxy is down or snapshot is too large
   */
  async fetchSnapshot(snapshot: Snapshot): Promise<string> {
    if (!snapshot.timestamp || !snapshot.originalUrl) {
      throw new WaybackError("invalid-url", "Invalid snapshot: missing timestamp or URL");
    }

    // Construct snapshot URL via proxy
    // The id_ suffix returns original HTML without Wayback toolbar
    const encodedUrl = encodeURIComponent(snapshot.originalUrl);
    const snapshotUrl = this.proxyUrl
      ? `${this.proxyUrl}/web/${snapshot.timestamp}id_/${encodedUrl}`
      : `https://web.archive.org/web/${snapshot.timestamp}id_/${encodedUrl}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);

      let response: Response;

      if (this.proxyUrl) {
        response = await fetch(snapshotUrl, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Accept": "text/html",
          },
        });
      } else {
        // Direct fetch (no proxy) - for fallback mode
        throw new WaybackError("proxy-down", "Snapshot fetch requires proxy");
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new WaybackError("proxy-down", `Proxy returned status ${response.status}`);
      }

      // Read response body and check size
      const reader = response.body?.getReader();
      if (!reader) {
        throw new WaybackError("extraction-failed", "Response body is empty");
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      const maxSize = 5 * 1024 * 1024; // 5 MB

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          totalSize += value.length;
          if (totalSize > maxSize) {
            throw new WaybackError("snapshot-too-large", "Snapshot exceeds 5 MB limit");
          }
          chunks.push(value);
        }
      }

      // Decode the response
      const buffer = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder("utf-8");
      const html = decoder.decode(buffer);

      return html;
    } catch (error: unknown) {
      if (error instanceof WaybackError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new WaybackError("proxy-down", "Snapshot fetch timed out");
        }
      }
      throw new WaybackError("network", `Network error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Availability API response interface.
 */
interface AvailabilityResponse {
  archived_snapshots: {
    closest?: {
      url: string;
      timestamp: string;
      statuscode: string | number;
      checksum?: string;
      length?: string;
    };
  };
}

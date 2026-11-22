/**
 * Unit tests for URL normalization utilities.
 */

import { describe, expect, test } from "vitest";
import { isHttpUrl, normalizeUrl } from "./url";
import * as fc from "fast-check";

describe("isHttpUrl", () => {
  test("validates http URLs", () => {
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com/path")).toBe(true);
    expect(isHttpUrl("http://example.com:80/path")).toBe(true);
  });

  test("validates https URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("https://example.com/path")).toBe(true);
    expect(isHttpUrl("https://example.com:443/path")).toBe(true);
  });

  test("rejects non-http protocols", () => {
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("mailto:test@example.com")).toBe(false);
    expect(isHttpUrl("file:///path/to/file")).toBe(false);
    expect(isHttpUrl("ws://example.com")).toBe(false);
    expect(isHttpUrl("wss://example.com")).toBe(false);
  });

  test("rejects invalid URLs", () => {
    expect(isHttpUrl("")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
    expect(isHttpUrl("http://")).toBe(false);
    expect(isHttpUrl("https://")).toBe(false);
    expect(isHttpUrl("http:example.com")).toBe(false);
    expect(isHttpUrl("://example.com")).toBe(false);
  });
});

describe("normalizeUrl", () => {
  describe("scheme and host casing", () => {
    test("lowercases scheme", () => {
      expect(normalizeUrl("HTTP://example.com")).toBe("http://example.com");
      expect(normalizeUrl("HTTPS://example.com")).toBe("https://example.com");
    });

    test("lowercases host", () => {
      expect(normalizeUrl("http://EXAMPLE.COM")).toBe("http://example.com");
      expect(normalizeUrl("https://Example.COM")).toBe("https://example.com");
      expect(normalizeUrl("http://EXAMPLE.COM:8080")).toBe("http://example.com:8080");
    });

    test("preserves case in path", () => {
      expect(normalizeUrl("http://example.com/Path/To/Page")).toBe("http://example.com/Path/To/Page");
    });
  });

  describe("default ports", () => {
    test("drops http default port 80", () => {
      expect(normalizeUrl("http://example.com:80")).toBe("http://example.com");
      expect(normalizeUrl("http://example.com:80/")).toBe("http://example.com/");
      expect(normalizeUrl("http://example.com:80/path")).toBe("http://example.com/path");
    });

    test("drops https default port 443", () => {
      expect(normalizeUrl("https://example.com:443")).toBe("https://example.com");
      expect(normalizeUrl("https://example.com:443/")).toBe("https://example.com/");
      expect(normalizeUrl("https://example.com:443/path")).toBe("https://example.com/path");
    });

    test("preserves non-default ports", () => {
      expect(normalizeUrl("http://example.com:8080")).toBe("http://example.com:8080");
      expect(normalizeUrl("http://example.com:3000")).toBe("http://example.com:3000");
      expect(normalizeUrl("https://example.com:8443")).toBe("https://example.com:8443");
    });
  });

  describe("duplicate slashes", () => {
    test("collapses duplicate slashes in path", () => {
      expect(normalizeUrl("http://example.com//path")).toBe("http://example.com/path");
      expect(normalizeUrl("http://example.com///path")).toBe("http://example.com/path");
      expect(normalizeUrl("http://example.com/path//to//page")).toBe("http://example.com/path/to/page");
    });

    test("handles path-only slashes", () => {
      expect(normalizeUrl("http://example.com/")).toBe("http://example.com/");
      expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    });
  });

  describe("tracking parameters", () => {
    test("strips utm_* parameters", () => {
      expect(normalizeUrl("http://example.com?utm_source=google")).toBe("http://example.com");
      expect(normalizeUrl("http://example.com?utm_medium=social")).toBe("http://example.com");
      expect(normalizeUrl("http://example.com?utm_campaign=sale")).toBe("http://example.com");
      expect(normalizeUrl("http://example.com?utm_term=keyword")).toBe("http://example.com");
      expect(normalizeUrl("http://example.com?utm_content=banner")).toBe("http://example.com");
    });

    test("strips fbclid parameter", () => {
      expect(normalizeUrl("http://example.com?fbclid=12345")).toBe("http://example.com");
    });

    test("strips gclid parameter", () => {
      expect(normalizeUrl("http://example.com?gclid=abcdef")).toBe("http://example.com");
    });

    test("strips msclkid parameter", () => {
      expect(normalizeUrl("http://example.com?msclkid=xyz789")).toBe("http://example.com");
    });

    test("strips multiple tracking parameters", () => {
      const input = "http://example.com?utm_source=google&utm_medium=social&fbclid=123&gclid=abc";
      expect(normalizeUrl(input)).toBe("http://example.com");
    });

    test("preserves non-tracking parameters", () => {
      // Note: URL constructor normalizes http://example.com?id=123 to have pathname "/"
      expect(normalizeUrl("http://example.com?id=123")).toBe("http://example.com/?id=123");
      expect(normalizeUrl("http://example.com?search=test")).toBe("http://example.com/?search=test");
      expect(normalizeUrl("http://example.com?page=2&sort=asc")).toBe("http://example.com/?page=2&sort=asc");
    });
  });

  describe("combined transformations", () => {
    test("applies multiple normalizations", () => {
      const input = "HTTP://EXAMPLE.COM:80/path//to//page?utm_source=google&utm_medium=social";
      expect(normalizeUrl(input)).toBe("http://example.com/path/to/page");
    });

    test("handles domain-only URLs", () => {
      expect(normalizeUrl("http://EXAMPLE.COM:80")).toBe("http://example.com");
      expect(normalizeUrl("HTTPS://EXAMPLE.COM:443")).toBe("https://example.com");
    });
  });

  describe("edge cases", () => {
    test("handles empty query string", () => {
      expect(normalizeUrl("http://example.com?")).toBe("http://example.com");
    });

    test("handles URL with empty fragment", () => {
      expect(normalizeUrl("http://example.com#")).toBe("http://example.com");
    });

    test("removes non-empty fragments", () => {
      expect(normalizeUrl("http://example.com#section")).toBe("http://example.com");
    });
  });

  describe("error handling", () => {
    test("throws for invalid URLs", () => {
      expect(() => normalizeUrl("")).toThrow("invalid-url");
      expect(() => normalizeUrl("not a url")).toThrow("invalid-url");
      expect(() => normalizeUrl("http://")).toThrow("invalid-url");
      expect(() => normalizeUrl("ftp://example.com")).toThrow("invalid-url");
    });
  });
});

/**
 * Property-based tests for URL normalization utilities.
 */

describe("normalizeUrl property-based tests", () => {
  describe("idempotence", () => {
    test("applying normalizeUrl twice yields the same result", () => {
      fc.assert(
        fc.property(
          validUrlArb(),
          (input) => {
            const first = normalizeUrl(input);
            const second = normalizeUrl(first);
            expect(second).toBe(first);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe("round-trip validity", () => {
    test("normalized URL is always valid", () => {
      fc.assert(
        fc.property(
          validUrlArb(),
          (input) => {
            const normalized = normalizeUrl(input);
            expect(isHttpUrl(normalized)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe("param preservation", () => {
    test("non-tracking parameters are preserved", () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z]+$/),
          fc.stringMatching(/^[a-z]+$/),
          validUrlArb(),
          (key, value, input) => {
            // Add the param to a valid URL
            const url = new URL(input);
            url.searchParams.set(key, value);
            const normalized = normalizeUrl(url.href);
            const result = new URL(normalized);
            expect(result.searchParams.get(key)).toBe(value);
          },
        ),
        { numRuns: 200 },
      );
    });

    test("tracking parameters are always stripped", () => {
      const trackingKeys = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "msclkid",
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...trackingKeys),
          fc.stringMatching(/^[a-z0-9]+$/),
          validUrlArb(),
          (key, value, input) => {
            const url = new URL(input);
            url.searchParams.set(key, value);
            const normalized = normalizeUrl(url.href);
            const result = new URL(normalized);
            expect(result.searchParams.has(key)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe("scheme and host normalization", () => {
    test("scheme is always lowercase", () => {
      fc.assert(
        fc.property(
          validUrlArb(),
          (input) => {
            const normalized = normalizeUrl(input);
            expect(normalized.startsWith("http://") || normalized.startsWith("https://")).toBe(true);
            expect(normalized.startsWith("HTTP://")).toBe(false);
            expect(normalized.startsWith("HTTPS://")).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    test("host is always lowercase", () => {
      fc.assert(
        fc.property(
          hostnameArb().map((h) => h.toUpperCase()),
          (hostname) => {
            const input = "http://" + hostname;
            const normalized = normalizeUrl(input);
            const result = new URL(normalized);
            expect(result.hostname).toBe(result.hostname.toLowerCase());
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe("port normalization", () => {
    test("default ports are removed", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("http", "https"),
          hostnameArb(),
          (protocol, hostname) => {
            const input = `${protocol}://${hostname}:${protocol === "http" ? 80 : 443}`;
            const normalized = normalizeUrl(input);
            const url = new URL(normalized);
            expect(url.port).toBe("");
          },
        ),
        { numRuns: 200 },
      );
    });

    test("non-default ports are preserved", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 65535 }).filter((p) => p !== 80 && p !== 443),
          hostnameArb(),
          (port, hostname) => {
            const input = `http://${hostname}:${port}`;
            const normalized = normalizeUrl(input);
            const url = new URL(normalized);
            expect(url.port).toBe(port.toString());
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});

describe("isHttpUrl property-based tests", () => {
  describe("correct classification", () => {
    test("http URLs return true", () => {
      fc.assert(
        fc.property(
          hostnameArb(),
          (hostname) => {
            expect(isHttpUrl("http://" + hostname)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });

    test("https URLs return true", () => {
      fc.assert(
        fc.property(
          hostnameArb(),
          (hostname) => {
            expect(isHttpUrl("https://" + hostname)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });

    test("non-http protocols return false", () => {
      const protocols = ["ftp://", "mailto:", "file://", "ws://", "wss://"];
      fc.assert(
        fc.property(
          fc.constantFrom(...protocols),
          hostnameArb(),
          (protocol, hostname) => {
            expect(isHttpUrl(`${protocol}${hostname}`)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});

/**
 * Helper functions for generating valid URLs.
 */

/**
 * Generate a valid hostname string using fast-check.
 * Hostname rules (Node.js URL parser):
 * - Composed of labels separated by dots
 * - For multi-label hostnames, all labels must start with a letter
 * - Labels can contain letters, digits, and hyphens (not at start/end)
 * - No 'xn--' punycode-looking labels (they look like punycode but are invalid)
 * - No labels starting with 0 followed by a digit (these look like octal IPs but are invalid)
 */
function hostnameArb(): fc.Arbitrary<string> {
  // Helper to filter out labels that start with 0 followed by a digit
  const validLabel = (s: string): boolean => !s.startsWith("0") || s.length === 1 || !/[0-9]/.test(s[1]);
  
  // Single-label hostname: can start with letter or digit
  const singleLabelArb = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/)
    .filter((s) => s.length > 0)
    .filter((s) => !s.endsWith("-"))
    .filter((s) => !s.toLowerCase().startsWith("xn--"))
    .filter((s) => validLabel(s));

  // Multi-label hostname: all labels must start with a letter
  const twoLabelArb = fc.tuple(
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]*$/)
      .filter((s) => s.length > 0)
      .filter((s) => !s.endsWith("-"))
      .filter((s) => !s.toLowerCase().startsWith("xn--"))
      .filter((s) => validLabel(s)),
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]*$/)
      .filter((s) => s.length > 0)
      .filter((s) => !s.endsWith("-"))
      .filter((s) => !s.toLowerCase().startsWith("xn--"))
      .filter((s) => validLabel(s)),
  ).map(([l1, l2]) => `${l1}.${l2}`);

  // Three labels
  const threeLabelArb = fc.tuple(
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]*$/)
      .filter((s) => s.length > 0)
      .filter((s) => !s.endsWith("-"))
      .filter((s) => !s.toLowerCase().startsWith("xn--"))
      .filter((s) => validLabel(s)),
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]*$/)
      .filter((s) => s.length > 0)
      .filter((s) => !s.endsWith("-"))
      .filter((s) => !s.toLowerCase().startsWith("xn--"))
      .filter((s) => validLabel(s)),
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]*$/)
      .filter((s) => s.length > 0)
      .filter((s) => !s.endsWith("-"))
      .filter((s) => !s.toLowerCase().startsWith("xn--"))
      .filter((s) => validLabel(s)),
  ).map(([l1, l2, l3]) => `${l1}.${l2}.${l3}`);

  return fc.oneof(singleLabelArb, twoLabelArb, threeLabelArb);
}

/**
 * Generate a valid URL for property-based testing.
 */
function validUrlArb(): fc.Arbitrary<string> {
  return fc.tuple(
    fc.constantFrom("http://", "https://"),
    hostnameArb(),
    fc.stringMatching(/^\/[a-zA-Z0-9/_-]*$/).filter((s) => s.length >= 0),
    fc.option(fc.stringMatching(/^[a-z0-9_&=-]+$/).filter((s) => s.length > 0)),
    fc.option(fc.stringMatching(/^[a-zA-Z0-9_&=-]*$/)),
  ).map(([scheme, hostname, path, query, fragment]) => {
    let url = scheme + hostname + path;
    if (query !== null) {
      url += "?" + query;
    }
    if (fragment !== null) {
      url += "#" + fragment;
    }
    return url;
  }).filter((url) => isHttpUrl(url));
}

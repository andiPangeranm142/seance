/**
 * Unit tests for timestamp utilities.
 */

import { describe, expect, test } from "vitest";
import { formatDisplay, formatTimestamp, parseTimestamp } from "./time";
import * as fc from "fast-check";

describe("parseTimestamp", () => {
  describe("valid timestamps", () => {
    test("parses a simple timestamp", () => {
      const date = parseTimestamp("20261122030900");
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(10); // November is 10
      expect(date.getUTCDate()).toBe(22);
      expect(date.getUTCHours()).toBe(3);
      expect(date.getUTCMinutes()).toBe(9);
      expect(date.getUTCSeconds()).toBe(0);
    });

    test("parses timestamp with all components", () => {
      const date = parseTimestamp("19700101000000");
      expect(date.getUTCFullYear()).toBe(1970);
      expect(date.getUTCMonth()).toBe(0); // January is 0
      expect(date.getUTCDate()).toBe(1);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });

    test("handles leap year Feb 29", () => {
      const date = parseTimestamp("20000229000000"); // 2000 was a leap year
      expect(date.getUTCFullYear()).toBe(2000);
      expect(date.getUTCMonth()).toBe(1); // February
      expect(date.getUTCDate()).toBe(29);
    });

    test("handles end-of-month timestamps", () => {
      const date31 = parseTimestamp("20260131235959"); // January has 31 days
      expect(date31.getUTCDate()).toBe(31);
      
      const date30 = parseTimestamp("20260430235959"); // April has 30 days
      expect(date30.getUTCDate()).toBe(30);
    });

    test("handles maximum time values", () => {
      const date = parseTimestamp("20261231235959");
      expect(date.getUTCMonth()).toBe(11); // December
      expect(date.getUTCDate()).toBe(31);
      expect(date.getUTCHours()).toBe(23);
      expect(date.getUTCMinutes()).toBe(59);
      expect(date.getUTCSeconds()).toBe(59);
    });
  });

  describe("invalid inputs - wrong length", () => {
    test("rejects empty string", () => {
      expect(() => parseTimestamp("")).toThrow("invalid-timestamp");
    });

    test("rejects too short", () => {
      expect(() => parseTimestamp("2026")).toThrow("invalid-timestamp");
      expect(() => parseTimestamp("202611")).toThrow("invalid-timestamp");
      expect(() => parseTimestamp("20261122")).toThrow("invalid-timestamp");
      expect(() => parseTimestamp("2026112203")).toThrow("invalid-timestamp");
      expect(() => parseTimestamp("202611220309")).toThrow("invalid-timestamp");
    });

    test("rejects too long", () => {
      expect(() => parseTimestamp("202611220309000")).toThrow("invalid-timestamp");
      expect(() => parseTimestamp("20261122030900123")).toThrow("invalid-timestamp");
    });
  });

  describe("invalid inputs - non-numeric", () => {
    test("rejects letters", () => {
      expect(() => parseTimestamp("2026AB22030900")).toThrow("invalid-timestamp");
      expect(() => parseTimestamp("ABCDEF22030900")).toThrow("invalid-timestamp");
    });

    test("rejects mixed alphanumeric", () => {
      expect(() => parseTimestamp("20a61122030900")).toThrow("invalid-timestamp");
      expect(() => parseTimestamp("2026112203a900")).toThrow("invalid-timestamp");
    });
  });

  describe("invalid inputs - impossible dates", () => {
    test("rejects invalid month (0)", () => {
      expect(() => parseTimestamp("20260022030900")).toThrow("invalid-timestamp");
    });

    test("rejects invalid month (13)", () => {
      expect(() => parseTimestamp("20261322030900")).toThrow("invalid-timestamp");
    });

    test("rejects Feb 30 (not leap year)", () => {
      expect(() => parseTimestamp("20230230030900")).toThrow("invalid-timestamp");
    });

    test("rejects Feb 30 (leap year - but Feb 30 never exists)", () => {
      expect(() => parseTimestamp("20000230030900")).toThrow("invalid-timestamp");
    });

    test("rejects Feb 29 in non-leap year", () => {
      expect(() => parseTimestamp("19000229030900")).toThrow("invalid-timestamp");
    });

    test("rejects Apr 31 (only 30 days)", () => {
      expect(() => parseTimestamp("20260431030900")).toThrow("invalid-timestamp");
    });

    test("rejects Jun 31 (only 30 days)", () => {
      expect(() => parseTimestamp("20260631030900")).toThrow("invalid-timestamp");
    });

    test("rejects Sep 31 (only 30 days)", () => {
      expect(() => parseTimestamp("20260931030900")).toThrow("invalid-timestamp");
    });

    test("rejects Nov 31 (only 30 days)", () => {
      expect(() => parseTimestamp("20261131030900")).toThrow("invalid-timestamp");
    });

    test("rejects invalid hour (24)", () => {
      expect(() => parseTimestamp("20261122240900")).toThrow("invalid-timestamp");
    });

    test("rejects invalid minute (60)", () => {
      expect(() => parseTimestamp("20261122036000")).toThrow("invalid-timestamp");
    });

    test("rejects invalid second (60)", () => {
      expect(() => parseTimestamp("20261122030960")).toThrow("invalid-timestamp");
    });
  });

  describe("invalid inputs - type errors", () => {
    test("rejects non-string inputs", () => {
      // @ts-expect-error: testing runtime behavior with wrong types
      expect(() => parseTimestamp(20261122030900)).toThrow("invalid-timestamp");
      // @ts-expect-error: testing runtime behavior with wrong types
      expect(() => parseTimestamp(null)).toThrow("invalid-timestamp");
      // @ts-expect-error: testing runtime behavior with wrong types
      expect(() => parseTimestamp(undefined)).toThrow("invalid-timestamp");
      // @ts-expect-error: testing runtime behavior with wrong types
      expect(() => parseTimestamp({})).toThrow("invalid-timestamp");
    });
  });
});

describe("formatTimestamp", () => {
  test("formats a timestamp", () => {
    const date = new Date(Date.UTC(2026, 10, 22, 3, 9, 0)); // Nov 22, 2026 03:09:00 UTC
    expect(formatTimestamp(date)).toBe("20261122030900");
  });

  test("formats zero timestamp", () => {
    const date = new Date(Date.UTC(1970, 0, 1, 0, 0, 0)); // Jan 1, 1970 00:00:00 UTC
    expect(formatTimestamp(date)).toBe("19700101000000");
  });

  test("formats with leading zeros", () => {
    const date = new Date(Date.UTC(2026, 0, 5, 3, 9, 7)); // Jan 5, 2026 03:09:07 UTC
    expect(formatTimestamp(date)).toBe("20260105030907");
  });

  test("formats end-of-month", () => {
    const date = new Date(Date.UTC(2026, 0, 31, 23, 59, 59)); // Jan 31, 2026 23:59:59 UTC
    expect(formatTimestamp(date)).toBe("20260131235959");
  });

  test("formats December", () => {
    const date = new Date(Date.UTC(2026, 11, 22, 3, 9, 0)); // Dec 22, 2026 03:09:00 UTC
    expect(formatTimestamp(date)).toBe("20261222030900");
  });

  test("round-trips with parseTimestamp", () => {
    const original = "20261122030900";
    const date = parseTimestamp(original);
    const formatted = formatTimestamp(date);
    expect(formatted).toBe(original);
  });
});

describe("formatDisplay", () => {
  test("formats a timestamp for display", () => {
    expect(formatDisplay("20261122030900")).toBe("22 Nov 2026, 03:09 UTC");
  });

  test("formats without day suffix", () => {
    expect(formatDisplay("20261101030900")).toBe("1 Nov 2026, 03:09 UTC");
    expect(formatDisplay("20261102030900")).toBe("2 Nov 2026, 03:09 UTC");
    expect(formatDisplay("20261103030900")).toBe("3 Nov 2026, 03:09 UTC");
    expect(formatDisplay("20261111030900")).toBe("11 Nov 2026, 03:09 UTC");
    expect(formatDisplay("20261121030900")).toBe("21 Nov 2026, 03:09 UTC");
    // Nov has 30 days, so use Dec 31 for 31
    expect(formatDisplay("20261231030900")).toBe("31 Dec 2026, 03:09 UTC");
  });

  test("formats with single-digit month and day", () => {
    expect(formatDisplay("20260101000000")).toBe("1 Jan 2026, 00:00 UTC");
  });

  test("formats with single-digit hour and minute", () => {
    expect(formatDisplay("20261122030900")).toBe("22 Nov 2026, 03:09 UTC");
  });

  test("throws for invalid timestamp", () => {
    expect(() => formatDisplay("invalid")).toThrow("invalid-timestamp");
    expect(() => formatDisplay("20261322030900")).toThrow("invalid-timestamp");
  });
});

/**
 * Property-based tests for timestamp utilities.
 */

describe("parseTimestamp property-based tests", () => {
  describe("round-trip validity", () => {
    test("parseTimestamp(formatTimestamp(d)) === d for valid dates", () => {
      // Generate valid timestamps by constraining to valid date ranges
      const validTimestampArb = fc.tuple(
        fc.integer({ min: 1970, max: 2099 }), // year
        fc.integer({ min: 1, max: 12 }),      // month
        fc.integer({ min: 1, max: 28 }),      // day (safe for all months)
        fc.integer({ min: 0, max: 23 }),      // hour
        fc.integer({ min: 0, max: 59 }),      // minute
        fc.integer({ min: 0, max: 59 }),      // second
      ).map(([year, month, day, hour, minute, second]) => {
        // Handle day validation for specific months
        const daysInMonth = getDaysInMonth(year, month);
        const safeDay = Math.min(day, daysInMonth);
        return formatTimestamp(new Date(Date.UTC(year, month - 1, safeDay, hour, minute, second)));
      });

      fc.assert(
        fc.property(validTimestampArb, (timestamp) => {
          const date = parseTimestamp(timestamp);
          expect(formatTimestamp(date)).toBe(timestamp);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe("rejection of invalid strings", () => {
    test("rejects non-14-digit strings", () => {
      const invalidLengthArb = fc.oneof(
        fc.stringMatching(/^\d{1,13}$/),
        fc.stringMatching(/^\d{15,}$/),
      );

      fc.assert(
        fc.property(invalidLengthArb, (timestamp) => {
          expect(() => parseTimestamp(timestamp)).toThrow("invalid-timestamp");
        }),
        { numRuns: 200 },
      );
    });

    test("rejects strings with non-digits", () => {
      const invalidCharsArb = fc.oneof(
        fc.stringMatching(/^[\dA-Za-z]+$/).filter((s) => /[A-Za-z]/.test(s)),
        fc.stringMatching(/^[^\d]{14}$/),
      );

      fc.assert(
        fc.property(invalidCharsArb, (timestamp) => {
          expect(() => parseTimestamp(timestamp)).toThrow("invalid-timestamp");
        }),
        { numRuns: 200 },
      );
    });

    test("rejects impossible dates", () => {
      const invalidMonthArb = fc.oneof(
        fc.constantFrom("00", "13", "14", "99"),
      ).map((month) => `2026${month}15030900`);

      const invalidDayArb = fc.oneof(
        fc.constantFrom("00", "32", "33", "99"),
      ).map((day) => `202611${day}030900`);

      const invalidHourArb = fc.oneof(
        fc.constantFrom("24", "25", "99"),
      ).map((hour) => `20261122${hour}0900`);

      fc.assert(
        fc.property(fc.oneof(invalidMonthArb, invalidDayArb, invalidHourArb), (timestamp) => {
          expect(() => parseTimestamp(timestamp)).toThrow("invalid-timestamp");
        }),
        { numRuns: 200 },
      );
    });
  });

  describe("chronological ordering", () => {
    test("lexicographically smaller timestamps parse to earlier dates", () => {
      const timestampPairArb = fc.tuple(
        fc.integer({ min: 2000, max: 2025 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 1, max: 100 }),
      ).map(([year1, month1, day1, hour1, min1, sec1, diff]) => {
        const ts1 = formatTimestamp(new Date(Date.UTC(year1, month1 - 1, day1, hour1, min1, sec1)));
        // Add diff seconds to create a later timestamp
        const ts2 = incrementTimestamp(ts1, diff);
        return [ts1, ts2] as [string, string];
      });

      fc.assert(
        fc.property(timestampPairArb, ([ts1, ts2]) => {
          if (ts1 !== ts2) {
            const d1 = parseTimestamp(ts1);
            const d2 = parseTimestamp(ts2);
            expect(d1.getTime()).toBeLessThan(d2.getTime());
            expect(d1 < d2).toBe(true);
          }
        }),
        { numRuns: 200 },
      );
    });
  });
});

/**
 * Helper functions for generating valid timestamps.
 */

/**
 * Get the number of days in a given month.
 */
function getDaysInMonth(year: number, month: number): number {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2) {
    if ((year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)) {
      return 29;
    }
  }
  return daysInMonth[month - 1];
}

/**
 * Increment a timestamp by a number of seconds.
 */
function incrementTimestamp(timestamp: string, seconds: number): string {
  const year = parseInt(timestamp.slice(0, 4), 10);
  const month = parseInt(timestamp.slice(4, 6), 10) - 1;
  const day = parseInt(timestamp.slice(6, 8), 10);
  const hour = parseInt(timestamp.slice(8, 10), 10);
  const minute = parseInt(timestamp.slice(10, 12), 10);
  const second = parseInt(timestamp.slice(12, 14), 10);

  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  date.setUTCSeconds(date.getUTCSeconds() + seconds);

  return formatTimestamp(date);
}

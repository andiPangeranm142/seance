---
inclusion: fileMatch
fileMatchPattern:
  - "**/*.test.*"
  - "src/lib/**"
---

# Testing standards

## Stack

Vitest + jsdom, with fast-check for property-based tests (PBT). Run with
`npm test` (`vitest run`). Test files live next to the module under test.

## Unit tests

- One `describe` block per exported function, one `it` per behavior.
- Name tests by behavior: `it("drops default ports when normalizing")`.
- Mock `fetch` with `vi.stubGlobal("fetch", ...)`; never hit the live
  Wayback Machine in tests. Fixtures for CDX JSON and snapshot HTML live in
  `src/lib/__fixtures__/` (small, hand-written, committed).
- Components: test with user-visible queries (role, label, text) — no
  implementation-detail assertions. `SummonForm` and `ReaderView` get
  component tests; pure display components get snapshot-free assertions on
  rendered text.

## Property-based tests (fast-check)

PBT is mandatory for the three parsers. Each property gets a clear,
falsifiable statement and a targeted arbitrary (not just "any string"):

- **URL normalization** (`url.test.ts`):
  - Idempotence: `normalize(normalize(u)) === normalize(u)`.
  - Round-trip: `normalize(u)` always parses as a valid URL.
  - Scheme/host lowercasing: `normalize("HTTP://EXAMPLE.COM/x")` equals
    `normalize("http://example.com/x")`.
  - Tracking parameters (`utm_*`, `fbclid`, `gclid`) are removed; all other
    query parameters survive in order.
- **Timestamps** (`time.test.ts`):
  - Round-trip: `formatTimestamp(parseTimestamp(t)) === t` for every valid
    14-digit timestamp.
  - `parseTimestamp` rejects any string that is not exactly 14 digits or
    has an impossible month/day/hour.
  - Ordering: if `t1 < t2` lexicographically, `parseTimestamp(t1)` is
    earlier than `parseTimestamp(t2)`.
- **CDX rows** (`wayback.test.ts`):
  - The parser skips the header row and tolerates missing/extra columns.
  - Every parsed snapshot has a valid 14-digit timestamp and a status code
    of 200 (after the `statuscode:200` filter).

Use `fc.assert(fc.property(...), { numRuns: 200 })` for parser properties.
Keep arbitraries in the test file, close to the property they serve.

## Notes

- Kiro's built-in Correctness (PBT) feature is IDE-only, so PBT here is
  implemented directly with fast-check — the properties above are the spec,
  not a generated artifact.
- Aim for full branch coverage of `src/lib/`; components are covered by
  behavior tests, not by a coverage target.
- The Worker (`worker/proxy.ts`) is tested by hand against the deployed
  URL (spec task T13), not by unit tests — wrangler's runtime is not jsdom.

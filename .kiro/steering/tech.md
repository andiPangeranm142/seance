---
inclusion: always
---

# Tech stack

- **Runtime:** Vite 7 + React 19 + TypeScript (strict mode, `noUnusedLocals`,
  `noUnusedParameters`). Node 22. Package manager: npm.
- **Styling:** Plain CSS with custom properties (`src/index.css`). No CSS
  framework, no CSS-in-JS. Design tokens live in `:root`; components consume
  tokens, never hard-coded hex values.
- **Content extraction:** `@mozilla/readability` in the browser (DOMParser).
- **Tests:** Vitest + jsdom. Property-based tests with fast-check.
- **Lint/format:** ESLint flat config (`eslint.config.js`), TypeScript
  recommended rules. Type-check with `tsc --noEmit`.
- **Hosting:** GitHub Pages (static build, relative `base: "./"`).
- **Proxy:** Cloudflare Worker (`worker/proxy.ts`, wrangler). Free tier.

## Commands

```bash
npm run dev        # Vite dev server on :5173
npm run build      # tsc -b && vite build
npm run test       # vitest run (unit + property-based)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run worker:dev     # local proxy on :8787
npm run worker:deploy  # deploy the proxy
```

## Wayback Machine — verified facts (22 Nov 2026, via curl)

- **CDX search API** `https://web.archive.org/cdx/search/cdx` — works from
  servers, but sends **no** `Access-Control-Allow-Origin` and answers
  `OPTIONS` with 405. A browser app **cannot** call it directly.
- **Raw snapshot fetch** `https://web.archive.org/web/<timestamp>id_/<url>`
  (the `id_` suffix returns the original HTML without the Wayback toolbar) —
  also **no** CORS headers. Browser fetch is blocked.
- **Timemap** `https://web.archive.org/web/timemap/link/<url>` — also no CORS.
- **Availability API** `https://archive.org/wayback/available?url=<url>` —
  **does** send `Access-Control-Allow-Origin: *`. The browser can call it
  directly; it returns only the single closest snapshot.
- CDX supports `collapse=timestamp:6` (one snapshot per month) for timelines,
  `filter=statuscode:200`, `fl=timestamp,original,statuscode,digest`, and
  `output=json` (first row is the header).
- Common Crawl's index API sends CORS `*` but timed out twice (504) during
  verification — it is **not** a dependency of this app.

## Architecture rules (consequences of the above)

1. All CDX and snapshot-HTML traffic goes through the Cloudflare Worker
   proxy (`VITE_WAYBACK_PROXY_URL`). The proxy allow-lists
   `web.archive.org` and `archive.org`, GET only, 5 MB cap.
2. If the proxy is missing or down, the app degrades to **fallback mode**:
   Availability API (direct, CORS-open) for the closest snapshot + an
   embedded frame of the archived page. No reconstruction in fallback mode,
   and the UI says so plainly.
3. The core flow (summon → timeline → read → export) must work with **no API
   key of any kind**. The optional AI summary takes a user-provided OpenRouter
   key from localStorage and is never on the critical path.
4. Never execute scripts from archived pages. Reconstruction parses HTML with
   DOMParser and renders sanitized content only (Readability output through a
   text/allow-list renderer — no `dangerouslySetInnerHTML` of raw archive
   HTML; see design.md).
5. Snapshot timestamps are 14-digit UTC strings (`YYYYMMDDHHMMSS`). Parse and
   format them only through `src/lib/time.ts` (property-tested).
6. URLs are normalized only through `src/lib/url.ts` (property-tested):
   lowercase scheme/host, drop default ports, strip tracking parameters,
   collapse duplicate slashes. Normalization must be idempotent.

## Kiro tooling prerequisites (implementation phase)

- Kiro CLI v3 (3.5.0+) with the free Builder ID license.
- The `fetch` MCP server in `.kiro/settings/mcp.json` runs via `uvx`
  (`mcp-server-fetch`); install `uv` in the environment first, or the server
  will fail to start (harmless — the built-in web tools still work).
- The `wayback` MCP server is built in spec task T12 and enabled afterwards.

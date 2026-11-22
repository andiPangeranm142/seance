# Tasks: Séance

Implementation plan for the Séance feature spec. Execute with Kiro CLI v3,
one task at a time (or one wave at a time — tasks inside a wave are
independent and may run concurrently). Mark each task `[x]` only when its
acceptance criteria pass: `npm test`, `npm run typecheck`, and
`npm run lint` must stay green after every task.

Requirement references (R) point to `requirements.md`; NFR to its
non-functional section.

## Wave 1 — Foundations (no dependencies)

- [x] **T1. Verify scaffold and install dependencies**
  - Run `npm install`, then `npm run build`, `npm test`, `npm run
    typecheck`, `npm run lint`. Fix any version or config issue the scaffold
    has (peer conflicts, missing types) without changing the stack.
  - Files: `package.json`, configs (only if a fix is needed).
  - Acceptance: all four commands pass on a clean checkout. (NFR5)

- [ ] **T2. URL normalization (`src/lib/url.ts`) + property tests**
  - Implement `normalizeUrl`, `isHttpUrl`, and tracking-parameter stripping
    per design.md. Tracking parameters: any `utm_*`, `fbclid`, `gclid`,
    `msclkid`.
  - Files: `src/lib/url.ts`, `src/lib/url.test.ts`.
  - Acceptance: unit tests cover scheme/host casing, default ports,
    duplicate slashes, tracking params; PBT covers idempotence, round-trip
    validity, and param preservation (200 runs). (R1.1, R1.2)

- [ ] **T3. Timestamp utilities (`src/lib/time.ts`) + property tests**
  - Implement `parseTimestamp` (strict 14-digit validation, rejects
    impossible dates), `formatTimestamp`, `formatDisplay`.
  - Files: `src/lib/time.ts`, `src/lib/time.test.ts`.
  - Acceptance: PBT covers parse/format round-trip, rejection of invalid
    strings, and chronological ordering (200 runs). (R2.1, R3.5)

- [ ] **T4. Local storage (`src/lib/storage.ts`) + unit tests**
  - Implement Graveyard CRUD and API-key get/set, all guarded for
    unavailable localStorage. Cap the Graveyard at 50 entries (drop oldest).
  - Files: `src/lib/storage.ts`, `src/lib/storage.test.ts`.
  - Acceptance: add/list/remove round-trip works; all functions return safe
    defaults when localStorage throws. (R5.1–R5.4, R7.1)

## Wave 2 — Data layer (depends on Wave 1)

- [ ] **T5. Wayback client (`src/lib/wayback.ts`) + tests**
  - Implement `WaybackClient` (`listSnapshots` via CDX through the proxy
    with monthly collapse over 200 rows, `closestSnapshot` via the
    Availability API direct, `fetchSnapshot` via the proxy with a 5 MB
    guard), the pure `parseCdxRows` parser, and the typed `WaybackError`.
    20 s timeout on every fetch.
  - Files: `src/lib/wayback.ts`, `src/lib/wayback.test.ts`,
    `src/lib/__fixtures__/` (CDX JSON, availability JSON).
  - Acceptance: mocked-fetch unit tests cover all three methods and every
    error kind; PBT covers CDX parsing (header-row skip, column tolerance,
    200 runs). (R1.3–R1.6, R2.3, R6.1)

- [ ] **T6. Article extraction (`src/lib/extract.ts`) + tests**
  - Implement `extractArticle`: DOMParser → Readability → rewrite image/link
    URLs to archived copies → sanitized `ContentBlock[]`. Drop scripts,
    styles, forms, iframes. Fall back to raw text when Readability finds
    nothing.
  - Files: `src/lib/extract.ts`, `src/lib/extract.test.ts`,
    `src/lib/__fixtures__/` (snapshot HTML sample).
  - Acceptance: extraction of the fixture yields the expected title and
    blocks; no `<script>` survives; relative image URLs are rewritten to
    `web.archive.org/web/<ts>im_/…`. (R3.1–R3.4)

- [ ] **T7. Export builders (`src/lib/export.ts`) + tests**
  - Implement `toMarkdown`, `toStandaloneHtml`, and `download`. Markdown
    includes title, original URL, snapshot timestamp, and content. HTML is
    standalone (inline CSS, no scripts).
  - Files: `src/lib/export.ts`, `src/lib/export.test.ts`.
  - Acceptance: exported Markdown contains title + URL + timestamp +
    content; exported HTML renders without network (except images).
    (R4.1–R4.2)

## Wave 3 — UI components (depends on Wave 2)

- [ ] **T8. SummonForm component + tests**
  - URL input with label, submit button, inline validation errors, disabled
    state while summoning, staged progress text via props.
  - Files: `src/components/SummonForm.tsx`,
    `src/components/SummonForm.test.tsx`.
  - Acceptance: invalid input shows an error and calls no handler; valid
    submit calls `onSummon` with the raw input; button disables while
    `busy`. (R1.1, R1.2, R8.2, R8.3)

- [ ] **T9. Timeline component**
  - Year/month-grouped snapshot list with counts, current-selection marking,
    per-entry error display, keyboard-navigable.
  - Files: `src/components/Timeline.tsx`.
  - Acceptance: groups render in reverse chronological order; selecting an
    entry calls `onSelect` with that snapshot; failed entries stay visible
    with an error note. (R2.1, R2.2, R2.4)

- [ ] **T10. ReaderView component + tests**
  - Renders `Article` blocks (headings, paragraphs, quotes, lists, images,
    code), snapshot date + original URL + archive.org link, export buttons,
    and the summary action slot.
  - Files: `src/components/ReaderView.tsx`,
    `src/components/ReaderView.test.tsx`.
  - Acceptance: all block types render; no `dangerouslySetInnerHTML` is
    used anywhere; export buttons are disabled without an article.
    (R3.1–R3.5, R4.3)

- [ ] **T11. Graveyard + StatusBanner components**
  - Graveyard: newest-first list, one-click re-summon, remove button,
    empty state. StatusBanner: loading stages, errors, fallback notice
    (aria-live polite).
  - Files: `src/components/Graveyard.tsx`,
    `src/components/StatusBanner.tsx`.
  - Acceptance: Graveyard renders entries newest-first and re-summons on
    click; StatusBanner announces state changes to assistive tech.
    (R5.2, R5.3, R6.2, R8.3)

- [ ] **T12. Wayback MCP server (tools/mcp-wayback/) + enable it**
  - Build a small stdio MCP server with `@modelcontextprotocol/sdk`
    exposing two tools: `wayback_closest` (Availability API lookup for a
    URL) and `wayback_timeline` (CDX query via the public CDX endpoint,
    monthly-collapsed). No API key needed. Add a README in
    `tools/mcp-wayback/` and flip the `wayback` entry in
    `.kiro/settings/mcp.json` from `"disabled": true` to enabled.
  - Files: `tools/mcp-wayback/server.mjs`,
    `tools/mcp-wayback/package.json`, `tools/mcp-wayback/README.md`,
    `.kiro/settings/mcp.json`.
  - Acceptance: `node tools/mcp-wayback/server.mjs` starts and answers an
    MCP `tools/list` request; both tools return real Wayback data for
    `example.com`; `kiro-cli mcp list` shows the server as configured.

## Wave 4 — Wiring and polish (depends on Wave 3)

- [ ] **T13. App wiring: hooks + state machine**
  - Implement `useWayback` (summon lifecycle, snapshot list, current
    article, fallback detection) and `useGraveyard`, then wire `App.tsx`:
    idle → summoning (staged progress) → reading / error / empty states.
    Record successful resurrections in the Graveyard.
  - Files: `src/hooks/useWayback.ts`, `src/hooks/useGraveyard.ts`,
    `src/App.tsx`.
  - Acceptance: full summon → read flow works in `npm run dev` against the
    local worker (`npm run worker:dev` + `.env.local`); fallback mode
    triggers when the proxy URL is unset. (R1.3–R1.6, R5.1, R6.1–R6.3)

- [ ] **T14. Optional AI summary (user key only)**
  - Add a "Summarize" action in `ReaderView`, visible only when an
    OpenRouter key is stored in localStorage. Call the OpenRouter chat API
    with a free model and a short prompt; render the summary inline; inline
    error on failure. Add a small settings control to save/clear the key.
  - Files: `src/lib/summary.ts`, `src/components/SummaryPanel.tsx`,
    `src/components/ReaderView.tsx` (slot wiring).
  - Acceptance: without a key, no summary UI appears and no AI request is
    made; with a key, a summary renders for a loaded article; failures show
    an inline error and keep the page readable. (R7.1–R7.3)

- [ ] **T15. Deploy the proxy and verify end-to-end (manual)**
  - Deploy the Worker (`npm run worker:deploy`), set `VITE_WAYBACK_PROXY_URL`
    in `.env.local`, then verify the production build (`npm run build` +
    `npm run preview`) end-to-end with three known-dead URLs: `vine.co`,
    `geocities.com`, and one dead blog URL of your choice. Check summon →
    timeline → read → export for each.
  - Files: none (verification only; record the results in a short note in
    `README.md` if anything differs from the design).
  - Acceptance: all three URLs resurrect; timeline selection works; both
    exports download. (R1–R4)

- [ ] **T16. Accessibility + responsive polish**
  - Audit at 360 px width (no horizontal scroll), keyboard-only navigation
    (visible focus everywhere), `prefers-reduced-motion` (disable decorative
    animation), and screen-reader announcements for summon results/errors.
  - Files: `src/index.css`, components (as needed).
  - Acceptance: criteria R8.1–R8.4 verified by hand in the browser.
    (R8.1–R8.4)

- [ ] **T17. Final verification**
  - Run `npm run build`, `npm test`, `npm run typecheck`,
    `npm run lint` on a clean checkout. Confirm the production JS bundle is
    under 500 KB gzipped and that no `console.error` appears during a
    normal summon.
  - Files: none (verification only).
  - Acceptance: all four commands pass; bundle size recorded in the task
    result. (NFR4, NFR5)

- [ ] **T18. Repo hygiene for submission**
  - Re-read `README.md` against the built app and fix any drift; confirm
    `LICENSE` (MIT) is present, `.gitignore` does not ignore `.kiro`, and
    `.kiro/` contains specs, steering, hooks, MCP settings, and the
    reviewer agent. Remove the scaffold placeholder copy from `App.tsx` if
    any remains.
  - Files: `README.md`, `src/App.tsx` (only if placeholder copy remains).
  - Acceptance: `git status` shows a clean, committable tree; a stranger
    can clone, `npm install`, `npm run dev`, and summon a dead link.

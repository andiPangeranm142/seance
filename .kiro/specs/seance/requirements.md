# Requirements: Séance

## Overview

Séance is a client-side web app that resurrects dead web pages. A user pastes
a URL that no longer resolves (404, dead domain, shut-down site). Séance finds
the page's archived snapshots in the Wayback Machine, reconstructs a clean
readable version of a chosen snapshot, and lets the user read it, browse its
snapshot timeline, and export it. The core flow works with no API key and no
account.

## Glossary

- **Dead URL** — a URL whose live fetch fails or returns an error status.
- **Snapshot** — one archived capture of a URL, identified by a 14-digit UTC
  timestamp (`YYYYMMDDHHMMSS`) plus the original URL.
- **Summon** — the act of pasting a URL and asking Séance to resurrect it.
- **Resurrection** — a successful summon: a snapshot rendered as a readable
  page.
- **Proxy** — the Cloudflare Worker (`worker/proxy.ts`) that forwards Wayback
  CDX and snapshot requests with CORS headers.
- **Fallback mode** — operation without the proxy, using only the browser-
  callable Availability API plus an embedded frame.
- **Graveyard** — the local history of past resurrections (localStorage).

## User Stories

### Story 1: Summon a dead link

As a researcher following a dead citation, I paste the dead URL so I can read
the page again.

**Acceptance Criteria (EARS):**

- R1.1 — WHEN the user submits a URL, THE SYSTEM SHALL normalize it
  (lowercase scheme/host, drop default ports, strip tracking parameters,
  collapse duplicate slashes) before any network call.
- R1.2 — WHEN the user submits an empty, malformed, or non-http(s) URL, THE
  SYSTEM SHALL show an inline validation error and SHALL NOT make a network
  call.
- R1.3 — WHEN the proxy is reachable, THE SYSTEM SHALL query the CDX API for
  snapshots of the normalized URL and SHALL show staged progress while doing
  so ("Consulting the archives…").
- R1.4 — WHEN snapshots exist, THE SYSTEM SHALL automatically load the most
  recent snapshot and render it as a readable page.
- R1.5 — WHEN no snapshots exist, THE SYSTEM SHALL show an empty state naming
  the URL and suggesting a retry with the bare domain.
- R1.6 — WHEN the CDX request fails, THE SYSTEM SHALL fall back to the
  Availability API as described in Story 6 instead of showing a dead end.

### Story 2: Browse the snapshot timeline

As a reader, I browse a page's snapshot history so I can see how it changed
over time.

**Acceptance Criteria (EARS):**

- R2.1 — WHEN snapshots are loaded, THE SYSTEM SHALL display a timeline
  grouped by year, then month, with a count per group.
- R2.2 — WHEN the user selects a snapshot, THE SYSTEM SHALL load and render
  that snapshot, and SHALL mark it as the current selection.
- R2.3 — WHEN a URL has more than 200 snapshots, THE SYSTEM SHALL collapse
  the CDX query to one snapshot per month (`collapse=timestamp:6`).
- R2.4 — WHEN a snapshot fails to load, THE SYSTEM SHALL keep the previous
  page visible and show an inline error on the timeline entry.

### Story 3: Read the resurrected page

As a reader, I read the reconstructed page so I can use the content.

**Acceptance Criteria (EARS):**

- R3.1 — WHEN a snapshot loads, THE SYSTEM SHALL render a clean reader view
  showing the page title, publication date when available, and article text.
- R3.2 — WHEN the snapshot contains images, THE SYSTEM SHALL rewrite their
  sources to the archived copies so they load from the Wayback Machine.
- R3.3 — WHEN the snapshot contains scripts, THE SYSTEM SHALL NOT execute
  them; the reader view SHALL contain no scripts from the archived page.
- R3.4 — WHEN extraction finds no readable article, THE SYSTEM SHALL show the
  raw text of the snapshot (when available) or a clear "could not reconstruct
  this snapshot" state with a link to view it on web.archive.org.
- R3.5 — WHEN the user opens the reader view, THE SYSTEM SHALL show the
  snapshot date, the original URL, and a link to the snapshot on
  web.archive.org.

### Story 4: Export the resurrected page

As a researcher, I export the page so I can cite and keep it.

**Acceptance Criteria (EARS):**

- R4.1 — WHEN the user chooses Markdown export, THE SYSTEM SHALL download a
  `.md` file containing the title, original URL, snapshot timestamp, and the
  article content as Markdown.
- R4.2 — WHEN the user chooses HTML export, THE SYSTEM SHALL download a
  standalone `.html` file that renders the article without network access
  (except archived images).
- R4.3 — WHEN no page is loaded, THE SYSTEM SHALL disable the export controls.

### Story 5: Revisit past resurrections (Graveyard)

As a returning user, I revisit pages I resurrected before.

**Acceptance Criteria (EARS):**

- R5.1 — WHEN a resurrection succeeds, THE SYSTEM SHALL record the URL,
  snapshot timestamp, and title in the local Graveyard (localStorage).
- R5.2 — WHEN the user opens the Graveyard, THE SYSTEM SHALL list past
  resurrections newest-first, each re-summonable with one click.
- R5.3 — WHEN the user removes an entry, THE SYSTEM SHALL delete it from the
  Graveyard immediately.
- R5.4 — WHEN localStorage is unavailable, THE SYSTEM SHALL still work and
  SHALL silently skip Graveyard persistence.

### Story 6: Degrade gracefully without the proxy

As a user on a network where the proxy is unreachable, I still want the
closest snapshot.

**Acceptance Criteria (EARS):**

- R6.1 — WHEN the proxy is unconfigured or unreachable, THE SYSTEM SHALL use
  the Availability API directly from the browser to find the closest
  snapshot.
- R6.2 — WHEN fallback mode is active, THE SYSTEM SHALL show the closest
  snapshot in an embedded frame and SHALL display a banner explaining that
  the reader view and timeline need the proxy.
- R6.3 — WHEN the Availability API reports no snapshot, THE SYSTEM SHALL show
  the same empty state as R1.5.

### Story 7: Optional AI summary

As a reader in a hurry, I get a short summary of a long resurrected page.

**Acceptance Criteria (EARS):**

- R7.1 — WHEN the user provides an OpenRouter key (stored only in
  localStorage), THE SYSTEM SHALL offer a "Summarize" action on a loaded
  page.
- R7.2 — WHEN no key is provided, THE SYSTEM SHALL NOT show the summary
  action and SHALL NOT call any AI service.
- R7.3 — WHEN the summary request fails, THE SYSTEM SHALL show an inline
  error and SHALL keep the page readable.

### Story 8: Accessible and responsive

As any user, I can use Séance from a phone or with a keyboard and screen
reader.

**Acceptance Criteria (EARS):**

- R8.1 — WHEN the viewport is 360 px wide, THE SYSTEM SHALL lay out all
  content without horizontal scrolling.
- R8.2 — WHEN navigating by keyboard, THE SYSTEM SHALL expose a visible focus
  indicator on every interactive element.
- R8.3 — WHEN a screen reader is used, THE SYSTEM SHALL announce summon
  results and errors via a live region.
- R8.4 — WHEN the user prefers reduced motion, THE SYSTEM SHALL disable
  decorative animations.

## Non-functional Requirements

- NFR1 — The app SHALL be a static single-page app deployable to GitHub
  Pages with no server-side code except the Cloudflare Worker proxy.
- NFR2 — The core flow (summon → read → export) SHALL work with no API key.
- NFR3 — No user data SHALL leave the browser except Wayback Machine
  requests for the URL the user asked to resurrect (and, only with an
  explicit user key, the OpenRouter summary request).
- NFR4 — The production bundle SHALL stay under 500 KB gzipped JavaScript.
- NFR5 — `npm run build`, `npm test`, `npm run typecheck`, and
  `npm run lint` SHALL all pass on a clean checkout.

## Out of scope

- Full-text search across the archive; saving pages to the archive.
- User accounts, sharing links, or server-side history.
- Reconstructing pages that require login, or pages blocked by robots
  exclusion in the Wayback Machine.
- Common Crawl as a source (its index API timed out twice during
  verification on 22 Nov 2026; revisit only if Wayback is unavailable).

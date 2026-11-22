---
inclusion: always
---

# Project structure

```
seance/
├── .github/workflows/deploy.yml   # Build + test + deploy to GitHub Pages
├── .kiro/
│   ├── agents/reviewer.md         # Read-only reviewer agent
│   ├── hooks/                     # lint-on-save, test-after-task
│   ├── settings/mcp.json          # fetch + wayback MCP servers
│   ├── specs/seance/              # requirements.md, design.md, tasks.md
│   └── steering/                  # this directory
├── worker/
│   └── proxy.ts                   # Cloudflare Worker (CORS proxy)
├── src/
│   ├── main.tsx                   # Vite entry (StrictMode + App)
│   ├── App.tsx                    # App shell + state wiring
│   ├── index.css                  # Design tokens + base styles
│   ├── vite-env.d.ts
│   ├── components/                # React components (one file per component)
│   │   ├── SummonForm.tsx         # URL input + summon button
│   │   ├── Timeline.tsx           # Snapshot timeline (year/month groups)
│   │   ├── ReaderView.tsx         # Reconstructed article view
│   │   ├── Graveyard.tsx          # Local history list
│   │   └── StatusBanner.tsx       # Loading / error / fallback states
│   ├── lib/                       # Pure logic — no React imports
│   │   ├── url.ts                 # URL normalization + validation
│   │   ├── time.ts                # Wayback timestamp parse/format
│   │   ├── wayback.ts             # WaybackClient (proxy + fallback)
│   │   ├── extract.ts             # Readability extraction + sanitizing
│   │   ├── export.ts              # Markdown / HTML export builders
│   │   └── storage.ts             # localStorage graveyard + settings
│   └── hooks/                     # React hooks (useWayback, useGraveyard)
├── tools/
│   └── mcp-wayback/server.mjs     # Custom Wayback MCP server (spec task T12)
├── index.html
├── package.json
├── vite.config.ts                 # base "./", React plugin
├── vitest.config.ts               # jsdom, src/**/*.test.*
├── tsconfig.json / tsconfig.node.json
├── eslint.config.js
└── wrangler.toml
```

## Conventions

- **Files:** `PascalCase.tsx` for components, `camelCase.ts` for lib modules
  and hooks (`useX.ts`). Test files sit next to the module they test:
  `url.test.ts`, `SummonForm.test.tsx`.
- **Imports:** relative imports only (no `@/` alias). Import order: React,
  third-party, local lib, local components. No circular imports between
  `lib/` modules.
- **`lib/` is pure.** No React, no DOM access except where the module's job
  requires it (`extract.ts` uses DOMParser — inject the parser or guard for
  jsdom in tests). Every `lib/` module has unit tests; `url.ts`, `time.ts`,
  and the CDX parser in `wayback.ts` additionally have property-based tests.
- **Components are presentational + thin.** Data fetching and state live in
  hooks (`src/hooks/`); components receive props and render. No `fetch`
  calls inside components.
- **Types:** export shared types from the module that owns them
  (`Snapshot` from `wayback.ts`, `Article` from `extract.ts`). Prefer
  `type` over `interface` for data shapes; `interface` only for props.
- **Errors:** lib functions throw typed errors (`WaybackError` with a
  `kind` field: `"invalid-url" | "no-snapshots" | "proxy-down" |
  "snapshot-too-large" | "extraction-failed" | "network"`). Components map
  `kind` to user-facing copy — never show raw error objects.
- **No `dangerouslySetInnerHTML`** with archive content. Reader output is
  rendered from a sanitized node model (see design.md).
- **Environment:** only `VITE_WAYBACK_PROXY_URL` is read from the
  environment (via `import.meta.env`). No other env vars. No secrets in the
  repo — the optional OpenRouter key lives in the user's localStorage only.

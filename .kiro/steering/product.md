---
inclusion: always
---

# Product: Séance

Séance resurrects dead web pages. A user pastes a URL that is dead (404,
domain gone, site shut down) and Séance brings the page back: it finds
archived snapshots in the Wayback Machine, reconstructs a clean readable
version, and lets the user read it, browse its history, and export it.

## Who it is for

- **Researchers, journalists, students** — link rot kills citations; Séance
  recovers the source they need to verify.
- **The curious** — anyone who followed an old link into the void.
- **Hackathon judges** — the demo must work end-to-end in under a minute with
  zero setup: paste a dead link, see it come back.

## Core flows (in priority order)

1. **Summon** — paste a URL → normalize it → find snapshots → show the
   closest snapshot as a readable page. This is the whole product; it must
   work with no API key and no account.
2. **Timeline** — browse all snapshots of the URL, grouped by year/month, and
   jump to any of them.
3. **Read** — a clean reader view: title, text, images rewritten to archived
   copies. No Wayback toolbar chrome, no scripts from the dead page.
4. **Export** — download the resurrected page as Markdown or standalone HTML.
5. **Graveyard** — local history of past resurrections (localStorage only),
   so a user can revisit a séance.

## What Séance is NOT

- Not a general web archive browser or search engine. One URL in, one page out.
- Not an account product. No sign-in, no backend database, no tracking.
- Not dependent on AI. An optional AI summary (user-provided OpenRouter key)
  is an enhancement; the core flow never needs a key.

## Product principles

- **One screen, one job.** The summon form is the hero. Everything else
  appears only after a resurrection succeeds.
- **Honest states.** Every failure names the cause and the next step
  ("No snapshots found for this URL — try the domain without a path").
  Never a blank screen, never a silent spinner.
- **The theme serves the function.** Séance / Ouija / candlelight styling
  makes the product memorable, but readability and speed always win over
  decoration. If a spooky effect hurts legibility, cut the effect.
- **Fast enough to demo.** First resurrection should render in a few seconds
  on a normal connection; show staged progress ("Consulting the archives…",
  "Reconstructing the page…") so waiting feels alive.

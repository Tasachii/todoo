# TodoDesu — Roadmap & Developer Handoff

Where the project should go next, in priority order, with concrete starting points in
the code. Read [`PROJECT_GUIDE.md`](PROJECT_GUIDE.md) first — it explains how
everything works; this file explains **what to build next and how to not break it**.

## Ground rules (the three laws of this codebase)

1. **Server and engine change together.** Every business rule exists twice — in
   `packages/server/src/routes/` and in `packages/web/src/api/local.js` — and
   `packages/web/test/local.test.js` mirrors the server suite case by case. If you
   change a rule in one place, the same commit changes the other and both test files.
2. **Migrations are append-only.** Never edit an applied entry in the `MIGRATIONS`
   array (`packages/server/src/db/index.js`); append a new one. Real users have real
   databases — test upgrades against a v1-shaped file, not just `:memory:`.
3. **A bug fix lands with the regression test that would have caught it.** No
   exceptions; this is how the suite got trustworthy. Gates before any commit:
   `npm test`, `npm run build`, and `npm run test:e2e -w @todoo/web` when the UI
   changed (see [`QA_PLAN.md`](QA_PLAN.md)).

## Priority 1 — Cross-device sync

**Why:** the single biggest user-facing gap. The Mac (SQLite) and the hosted web /
phone (localStorage) are separate islands; the backup file is the only bridge.

**Suggested shape (keeps the local-first promise):**
- A tiny sync service on a free tier (Cloudflare Workers + D1 fits the SQLite
  mental model) storing one account's snapshot or an append-only change log.
- Start dumb and safe: **last-writer-wins per task id**, using a `updated_at`
  column (new migration) — the data is single-user, so true CRDT/merge complexity
  isn't justified yet. The export/import payload (`/api/export`) is already a
  versioned full-snapshot format and makes a fine v1 sync unit.
- Client side, both data layers already funnel through one interface
  (`packages/web/src/api/client.js`); sync can sit behind it without touching views.
- Auth can be a single passphrase-derived key (no accounts infrastructure) at first.

**Where to start:** `docs/API.md` (extend the contract first — that's how this repo
works), then `packages/server/src/routes/backup.js` as the template for
snapshot-shaped endpoints.

## Priority 2 — Thai natural-language dates

**Why:** the user base around this project is Thai; "พรุ่งนี้ 6 โมงเย็น" should work
exactly like "tomorrow 6pm". No mainstream todo app does this well — it's a real
differentiator and matches the brand.

**How:** chrono-node has no Thai locale. Write a small normalizer that maps Thai
date/time vocabulary to English before parsing (พรุ่งนี้→tomorrow, มะรืน→in 2 days,
วันศุกร์→friday, บ่ายสาม→3pm, 6 โมงเย็น→6pm, สิ้นเดือน→end of month …) — a lookup
table plus a few regexes goes a long way before you need a real parser.

**Where:** one shared rule set consumed by both `packages/web/src/lib/quickdate.js`
and `packages/cli/src/dates.js` (they deliberately share behavior — see their tests).
Add Thai cases to `quickdate.test.js` and `dates.test.js` first, TDD-style.

## Priority 3 — Weekly statistics & streaks

**Why:** retention. The data is already recorded (`focus_sessions`, `completed_at`) —
this is pure presentation work, no schema change.

**How:** a Stats section in the Focus view (or a fifth view if it earns it): bar
chart of focus minutes per day for the trailing week, completion counts, and a streak
counter (consecutive days with ≥1 completed task or ≥1 focus session). Compute
client-side from `GET /api/stats` called per-day, or add a
`GET /api/stats/daily?from&to` that buckets by the client's day boundaries —
remember the rule: **the server never computes "today"** (PROJECT_GUIDE §7.1).
Keep the chart dependency-free (SVG bars by hand) to match the codebase's taste.

## Priority 4 — IndexedDB storage adapter

**Why:** localStorage is synchronous, ~5 MB, and string-only. Fine today;
`navigator.storage.persist()` already guards eviction. Worth upgrading when sync
lands or data grows.

**How:** `createLocalApi(storage)` already takes an injected storage object —
implement the same `getItem`/`setItem` surface over IndexedDB (load once at startup,
write-behind on persist) and swap it in `client.js`. Migrate by reading the old
localStorage key once and writing it through. The engine tests already run against
injected memory storage, so the adapter needs only its own small test.

## Smaller, anytime

- **Drag & drop E2E** — the board's dnd math is the most complex untested-in-browser
  path; dnd-kit keyboard drag (lift with space, arrows, drop) is scriptable in
  Playwright without flaky mouse coordinates.
- **ESLint flat config** — the repo relies on Vite/tests to catch mistakes; a minimal
  eslint setup in CI would catch unused imports and hook-deps issues earlier.
- **`node:sqlite` watch** — pinned to Node ≥ 23.4 while the module is experimental;
  when it stabilizes, pin CI to the LTS that ships it and drop the
  `--disable-warning` flag in `packages/cli/src/api.js`.
- **Web push reminders** — iOS PWA push has matured (16.4+); revisit the v1 decision
  to skip notifications once there's a server always running (i.e., after sync).
- **iOS App Store build** — fully prepared and shelved (`APP_STORE.md`); revive when
  the $99/year makes sense. `npm run app:sync && npm run app:open` still works.

## Explicitly rejected (don't re-litigate without new evidence)

- **Accounts/multi-user, collaboration** — against the product's core promise.
- **An ORM or external DB driver** — `node:sqlite` keeps installs dependency-free.
- **Heavy recurrence rules (full RRULE)** — daily/weekly/monthly covers the real use
  cases; complexity lives in `nextDueAt()` if it's ever truly needed.
- **Anchor-recovery for monthly-on-the-31st** — current behavior (clamp to Feb 28,
  then anchored to the 28th) is documented and predictable; "remember the original
  day" needs a schema field and wasn't worth it. See the tests pinning this.

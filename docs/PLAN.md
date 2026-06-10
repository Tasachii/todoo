# Todoo — Technical Plan (v1, revised)

> Revision note: this plan was self-reviewed before implementation. Changes from draft:
> `better-sqlite3` → built-in `node:sqlite` (no native build), server binds localhost by default
> (LAN is opt-in), clients pass explicit UTC ranges (no server-side "today"), port 4321 → 4521,
> Undo covers both complete & delete, active focus session lives server-side, 30-day purge of
> soft-deleted rows.

## Goals
1. Fastest possible capture: terminal `todo add` in ~2s, web quick-add in one screen.
2. Full loop: add → focus → done (swipe/drag) → review (calendar/stats).
3. Things-3-level minimal UI; light & dark.

**Non-goals (v1):** auth/multi-user, cloud sync, collaboration, App Store distribution.

## Architecture
```
CLI (`todo`) ──┐
               ├──→ Fastify API (127.0.0.1:4521) ──→ SQLite (~/.todoo/data.db, WAL)
Browser ───────┘         └── serves packages/web/dist when built
```
- **API is the single source of truth.** The CLI never touches SQLite directly; it auto-starts
  the server (detached spawn + health poll) when needed.
- iPhone/iPad reach the app over Wi-Fi via `TODOO_HOST=0.0.0.0` (trusted networks only).

## Stack
| Layer | Choice | Why |
|---|---|---|
| DB | `node:sqlite` (Node ≥ 23.4) | zero deps, no native build, one-file backup |
| API | Fastify 5 | light, schema validation built in |
| Web | React 18 + Vite | many views need real state management |
| CSS | Tailwind v4 (`@tailwindcss/vite`) | `dark:` variant, CSS-first config |
| Data fetching | TanStack Query | cache + optimistic updates |
| DnD | dnd-kit | touch support (iPad) |
| Gestures/motion | framer-motion | iOS-like swipe with direction lock |
| Dates | date-fns (web) / chrono-node (CLI NL parsing) | |
| CLI | commander + picocolors | |
| Repo | npm workspaces: `server` / `web` / `cli` | |

## Data model
See `docs/API.md` for the wire format. Key decisions:
- `sort_order REAL` — fractional indexing; dragging between A(1.0) and B(2.0) writes 1.5.
- `deleted_at` — soft delete with Undo; purged after 30 days at server startup.
- `completed_at` separate from `due_at` — powers stats and calendar history.
- `focus_sessions.planned_sec` vs `duration_sec` — planned vs actually elapsed.

## Milestones
| # | Scope | Definition of Done |
|---|---|---|
| M0 | Monorepo scaffold, docs | `npm install` clean; structure in place |
| M1 | Server API + tests, CLI core | full add→list→done loop from terminal; `npm test` green |
| M2 | Web Today view | quick-add, sections, swipe both ways, undo, dark mode |
| M3 | Board view | 3 columns, drag across + reorder, persists after refresh |
| M4 | Detail + Calendar | edit notes/due/priority; month grid + Upcoming |
| M5 | Focus mode | timestamp-based timer, sessions recorded, daily stats, `todo focus` |
| M6 | PWA + polish | installable on iPhone; LAN access; empty/error states |

## Risks → mitigations
- iOS suspends JS in background → timer always derives remaining time from `started_at`.
- Swipe vs vertical scroll conflict → `drag="x"` + `dragDirectionLock`, 10px threshold.
- iOS PWA notifications unreliable → not promised; overdue surfaced in red instead.
- Server not running when phone connects → `launchd` agent doc (M6) + CLI auto-start.
- Scope creep → backlog only after M6: recurring tasks, NL quick-add on web, streaks,
  cloud deploy + auth, Capacitor/Tauri wrappers.

## Testing
- Server: vitest integration tests over `fastify.inject()` for every endpoint (no real port).
- CLI: unit tests for natural-language date parsing (the most fragile part).
- Web: manual checklist per milestone — Safari first, iPhone SE width, iPad landscape,
  both themes; timer correctness after backgrounding.

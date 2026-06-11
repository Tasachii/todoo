# Todoo — Project Guide

This is the one document to read to understand the whole project: what Todoo is, how the
repository is laid out, how every piece of code works, how data flows end to end, and how
to develop, test, and extend it. It complements the other docs rather than replacing them:

| Document | What it covers |
|---|---|
| [`README.md`](../README.md) | User-facing overview, installation, usage |
| [`docs/REQUIREMENTS.md`](REQUIREMENTS.md) | Functional / non-functional requirements (FR/NFR) |
| [`docs/API.md`](API.md) | The REST API contract (wire format) |
| [`docs/PLAN.md`](PLAN.md) | Original technical plan, milestones, risk register |
| [`SKILLS.md`](../SKILLS.md) | Log of skills/techniques used while building (Thai) |
| **This file** | How the code actually works, file by file |

---

## 1. What Todoo is

Todoo is a **local-first todo app** with two equal clients sharing one source of truth:

- A **progressive web app** (Today list, kanban board, calendar, Pomodoro-style focus mode)
  usable on Mac, iPhone, and iPad.
- A **terminal CLI** (`todo`) for capturing and completing tasks in seconds.

Both talk to a small **Fastify REST API** on `127.0.0.1:4521`, which owns a single
**SQLite file** at `~/.todoo/data.db`. There are no accounts, no cloud services, and no
network access beyond your machine (or your own Wi-Fi if you opt in).

The core principle: **the API is the only authority over the data.** The CLI never opens
the database file; the browser never bypasses the API. Business rules (what "completing a
task" means, how ordering works, what gets purged) live in exactly one place —
`packages/server`.

```
CLI (todo) ----+
               +----> Fastify REST API (127.0.0.1:4521) ----> SQLite (~/.todoo/data.db)
Browser -------+              |
                              +--- serves the built web app (packages/web/dist)
```

## 2. Repository map

An npm-workspaces monorepo with three packages:

```
todoo/
├── package.json                  # workspace root: dev/build/start/test scripts
├── docs/                         # PLAN, REQUIREMENTS, API, this guide
├── scripts/gen-icons.mjs         # generates PWA icons (favicon, apple-touch, maskable)
│
├── packages/server/              # @todoo/server — Fastify 5 + node:sqlite
│   ├── src/index.js              # entry: open DB, build app, listen on host/port
│   ├── src/app.js                # app factory: error handler, routes, static web build
│   ├── src/db/index.js           # openDb(): migrations, WAL, 30-day purge
│   ├── src/db/queries.js         # shared helpers: taskById, nextSortOrder, notFound
│   ├── src/routes/tasks.js       # CRUD + soft delete + restore
│   ├── src/routes/focus.js       # focus session start/stop/active
│   ├── src/routes/stats.js       # focus + completion counts for a time range
│   ├── src/routes/settings.js    # key-value settings with defaults
│   └── test/api.test.js          # vitest integration tests via fastify.inject()
│
├── packages/web/                 # @todoo/web — React 18 + Vite + Tailwind v4
│   ├── index.html                # Vite entry HTML
│   ├── vite.config.js            # react + tailwind plugins, /api proxy to :4521
│   ├── public/manifest.webmanifest  # PWA manifest
│   ├── public/sw.js              # service worker: network-first, never caches /api
│   └── src/
│       ├── main.jsx              # React root: QueryClient, Router, SW registration
│       ├── App.jsx               # routes + UIContext (detail sheet, undo toast)
│       ├── api/client.js         # thin fetch wrapper, one function per endpoint
│       ├── hooks/useTasks.js     # TanStack Query: tasks cache + optimistic mutations
│       ├── hooks/useTheme.js     # auto/light/dark, localStorage + media query
│       ├── lib/dates.js          # date-fns helpers (overdue, day ranges, formatting)
│       ├── views/TodayView.jsx   # Overdue / Today / Tomorrow / Inbox sections
│       ├── views/BoardView.jsx   # 3-column kanban, dnd-kit drag & drop
│       ├── views/CalendarView.jsx# month grid + Upcoming (next 7 days)
│       ├── views/FocusView.jsx   # countdown ring, chime, break timer, daily stats
│       └── components/
│           ├── AppShell.jsx      # desktop sidebar / mobile header + bottom tabs
│           ├── QuickAdd.jsx      # add-task bar (Enter to submit, optional due time)
│           ├── TaskRow.jsx       # swipeable row (right=done, left=delete) + undo
│           ├── TaskDetail.jsx    # bottom-sheet editor (title/notes/due/priority)
│           ├── UndoToast.jsx     # 5-second undo toast
│           └── icons.jsx         # inline SVG icon set
│
└── packages/cli/                 # @todoo/cli — commander + chrono-node + picocolors
    ├── bin/todo.js               # shebang entry (`todo` command)
    └── src/
        ├── index.js              # all commands: add/list/done/start/rm/undo/focus/open/server
        ├── api.js                # fetch wrapper + auto-start server (spawn + health poll)
        ├── dates.js              # parseDue(): natural language → ISO UTC (chrono-node)
        ├── format.js             # colorized list rendering + index→id mapping
        └── state.js              # ~/.todoo/{last-list,last-action,server.pid} files
```

## 3. Data model

The schema lives in `packages/server/src/db/index.js` as a migration array. `openDb()`
applies unapplied migrations inside transactions (tracked in a `_migrations` table),
enables WAL mode and foreign keys, and purges old soft-deleted rows on startup.

### `tasks`

| Column | Type | Meaning |
|---|---|---|
| `id` | INTEGER PK | Auto-increment id |
| `title` | TEXT | Required, trimmed by the API |
| `notes` | TEXT | Free text, defaults to `''` |
| `status` | TEXT | `todo` \| `in_progress` \| `done` (CHECK-constrained) |
| `due_at` | TEXT | ISO 8601 UTC string, or NULL (no date = "Inbox") |
| `priority` | INTEGER | 0 none, 1 low, 2 medium, 3 high (CHECK 0–3) |
| `sort_order` | REAL | Position within its status column — see §7.2 |
| `created_at` | TEXT | ISO UTC, set on insert |
| `completed_at` | TEXT | Set when status becomes `done`, cleared when it leaves `done` |
| `deleted_at` | TEXT | Soft-delete marker; NULL = live — see §7.3 |

Partial indexes on `status` and `due_at` (both `WHERE deleted_at IS NULL`) cover the two
hot queries: board columns and date-range filters.

### `focus_sessions`

| Column | Meaning |
|---|---|
| `task_id` | The task being focused on, or NULL for "free focus" (`ON DELETE SET NULL`) |
| `planned_sec` | What the user asked for (e.g. 1500 for 25 min) |
| `started_at` | ISO UTC — clients derive remaining time from this, see §7.4 |
| `ended_at` | NULL while running; **`ended_at IS NULL` *is* the "active session" state** |
| `duration_sec` | Actual elapsed seconds, computed server-side on stop, capped at `planned_sec` |
| `completed` | 1 if the full planned duration elapsed, 0 if stopped early |

### `settings`

A plain key-value table (`key` PK, `value` TEXT). Defaults are applied at read time in
`routes/settings.js` (`theme=auto`, `focus_duration_sec=1500`, `break_duration_sec=300`),
so the table only stores what the user changed.

All timestamps everywhere are **ISO 8601 UTC strings** — SQLite stores them as TEXT, and
lexicographic comparison on ISO strings is also chronological, which is why plain `>=` /
`<` work in SQL.

## 4. The server (`packages/server`)

### Entry and app factory

`src/index.js` reads `TODOO_HOST` (default `127.0.0.1`) and `TODOO_PORT` (default `4521`),
opens the DB, and listens. It prints a warning when bound to anything other than localhost,
because there is **no authentication** — LAN mode trusts the network.

`src/app.js` exports `buildApp({ db })` — a factory rather than a singleton, so tests can
build an app around an in-memory DB. It:

- decorates the Fastify instance with `db` (routes access it as `app.db`);
- installs a global error handler that gives every non-2xx response the same
  `{error: {code, message}}` shape: schema-validation failures and other 4xx client
  errors (malformed/empty JSON bodies) become `VALIDATION`, 5xx become `INTERNAL`;
- registers the four route modules plus `GET /api/health`;
- serves `packages/web/dist` at `/` when a build exists, with an SPA fallback: any non-`/api`
  404 returns `index.html` so client-side routes like `/board` survive a page refresh.

### Routes

**`routes/tasks.js`** — request bodies are validated by Fastify JSON schema
(`additionalProperties: false`, title 1–500 chars, priority 0–3, status enum).

- `GET /api/tasks` builds a WHERE clause from optional query params (`status` comma list,
  `due_after`/`due_before`, `q` substring on title/notes, `deleted=true` to list only
  soft-deleted rows). Always ordered by `sort_order ASC`. Live queries always include
  `deleted_at IS NULL`.
- `POST /api/tasks` inserts at the **bottom** of the target status column
  (`nextSortOrder`), trims the title, and sets `completed_at` if created directly as done.
- `PATCH /api/tasks/:id` is the workhorse. It builds a dynamic UPDATE from the provided
  subset of fields, with two business rules:
  1. when `status` changes, `completed_at` is set to now (entering `done`) or cleared
     (leaving `done`);
  2. when `status` changes **without** an explicit `sort_order`, the task is appended to
     the bottom of the new column. Drag & drop sends both `status` and `sort_order`, so it
     bypasses the append.
- `DELETE` sets `deleted_at` (soft); `POST /:id/restore` clears it. Both 404 when the task
  is in the wrong state, so they are safe to retry.

**`routes/focus.js`** —

- `POST /api/focus/start` enforces **one active session globally**: if any row has
  `ended_at IS NULL`, it returns `409 CONFLICT`. If a `task_id` is given and that task is
  still `todo`, it is promoted to `in_progress` (appended to that column).
  `duration_sec` is validated to 60–14400 (1 min–4 h).
- `POST /api/focus/:id/stop` is **idempotent** — stopping an already-ended session returns
  it unchanged. The server computes `duration_sec = now - started_at`, capped at
  `planned_sec`, so a client that reports late (e.g. a phone that slept) can't inflate stats.
- `GET /api/focus/active` returns the running session (joined with the task title) or null.
  This is how a second device discovers a session started elsewhere.

**`routes/stats.js`** — `GET /api/stats?from&to` returns `focus_sec`, `focus_sessions`
(finished sessions whose `started_at` is in `[from, to)`) and `tasks_completed`
(`completed_at` in range). The server never decides what "today" means — see §7.1.

**`routes/settings.js`** — `GET` merges defaults with stored rows; `PUT` upserts each
key (values coerced to strings) and returns the merged result.

### Shared helpers (`db/queries.js`)

`nextSortOrder(db, status)` returns `MAX(sort_order) + 1` for the column. Because drag &
drop writes fractional values *between* integers, MAX+1 always lands strictly below
everything visible.

## 5. The web app (`packages/web`)

### Bootstrapping

`main.jsx` creates one `QueryClient` (staleTime 5 s, refetch on window focus, 1 retry),
wraps `<App/>` in `QueryClientProvider` + `BrowserRouter`, and registers the service
worker in production builds only. `vite.config.js` proxies `/api` to `127.0.0.1:4521`
during development, so the web code can always use relative URLs.

`App.jsx` defines the four routes (`/`, `/board`, `/calendar`, `/focus`) inside
`AppShell`, and provides a small **UIContext** with two functions used everywhere:

- `openDetail(taskId)` — opens the `TaskDetail` bottom sheet (rendered once, at app level);
- `showUndo(label, onUndo)` — shows the 5-second `UndoToast`.

`AppShell.jsx` renders a fixed sidebar on `md:` and up, and a sticky header + bottom tab
bar (with `env(safe-area-inset-*)` padding for iPhone notches) on mobile. The theme button
cycles auto → light → dark via `useTheme`, which persists to `localStorage` and toggles
the `dark` class on `<html>` (Tailwind's class-based dark mode), listening to the system
media query while in auto.

### Data layer — one cache, optimistic writes

`api/client.js` is a ~35-line fetch wrapper: one named function per endpoint, JSON in/out,
and non-2xx responses become `Error` objects carrying the server's `error.code`.

`hooks/useTasks.js` is the heart of the UI's responsiveness. The **entire task list lives
under one query key `['tasks']`** — every view derives what it needs by filtering in
memory (a few hundred tasks at most, so this is simpler and faster than per-view queries).
`useTaskMutations()` returns four mutations sharing one pattern:

1. `onMutate` — snapshot the cache, apply the change locally (patch fields, predict
   `completed_at`, or filter out the deleted task). The UI updates **instantly**.
2. `onError` — roll the cache back to the snapshot.
3. `onSettled` — invalidate `['tasks']` so the server's answer (real `sort_order`,
   timestamps) wins.

This is what makes swipe-to-complete and drag-and-drop feel native (NFR-1: <100 ms
perceived) while the server stays authoritative.

### Views

**TodayView** filters open tasks into Overdue (`due_at` in the past), Today, Tomorrow, and
Inbox (no date), each rendered as a `Section` of `TaskRow`s under the `QuickAdd` bar. An
API failure shows a hint to run `todo server start`.

**BoardView** implements the kanban board with dnd-kit:

- Tasks are grouped by status and sorted by `sort_order`; the Done column hides anything
  completed more than 7 days ago.
- `PointerSensor` (6 px distance) and `TouchSensor` (200 ms delay) distinguish dragging
  from tapping/scrolling on iPad.
- On drop, the client computes the new `sort_order` as the **midpoint** of its new
  neighbors (or neighbor ± 1 at column edges, 1 in an empty column) and sends a single
  `PATCH {status, sort_order}`. A `DragOverlay` renders the lifted card; on phones the
  columns become horizontally snap-scrollable.

**CalendarView** shows a month grid with dots on days that have tasks, a day-tap task
list, and a toggleable Upcoming list for the next 7 days.

**FocusView** is the most stateful view; it has four mutually exclusive UI states:
*idle* (pick duration 15/25/45/custom + task; defaults come from `/api/settings`, the
default task is the top of In Progress), *running* (countdown ring, "give up early"),
*finished* (card with "Mark task done" / "Take a break" / dismiss), and *break*
(a second, client-side-only ring). Key mechanics:

- The active session is **server state** (`['focus-active']` query, refetched every
  minute), so closing the tab or opening another device shows the same running timer.
- `useNow(running)` ticks a `Date.now()` state every 250 ms **and re-syncs on
  `visibilitychange`** — remaining time is always `planned_sec - (now - started_at)`,
  never a decremented counter (see §7.4).
- When remaining hits 0, a `useRef` guard makes the finish fire **exactly once per session
  id**: play the chime (two sine notes via the Web Audio API — no audio assets), show the
  finished card, and `POST .../stop {completed: true}`.
- Daily stats in the header come from `/api/stats` with the **client's** local-day range.

### Components

**TaskRow** is the swipeable list row used by Today/Calendar. A framer-motion div with
`drag="x"`, `dragDirectionLock` (so vertical scrolling still works), and elastic
constraints sits on top of a colored underlay (green check left, red trash right).
Crossing the 80 px threshold on release triggers complete (right) or delete (left); both
fire the optimistic mutation **and** `showUndo` with the inverse action (set status back /
restore). The leading circle button toggles done with `stopPropagation` so it doesn't open
the detail sheet; tapping the row body does.

**QuickAdd** is a controlled form: Enter submits `create.mutate({title, due_at})`; a clock
button reveals a native `datetime-local` input, converted to ISO UTC by
`fromLocalInput()`.

**TaskDetail** is a bottom sheet for editing title, notes, due, and priority, and can
start a focus session on the task. **UndoToast** renders the current toast from App state;
the timer lives in `App.jsx`.

### PWA

`public/manifest.webmanifest` + icons (generated by `scripts/gen-icons.mjs`) make the app
installable. `public/sw.js` is intentionally tiny: **network-first for GET requests,
never touching `/api`** (task data must never be stale), caching successful responses,
and falling back to the cache — or `index.html` for navigations — when offline. The cache
name `todoo-v1` is versioned; activation deletes old caches.

## 6. The CLI (`packages/cli`)

`bin/todo.js` is the `#!` entry; `src/index.js` wires commander:

| Command | What it does internally |
|---|---|
| `todo` | `GET /api/tasks?status=todo,in_progress`, splits into Overdue / Today / Inbox, prints colorized |
| `todo add "x" [-d due] [-p pri] [-n notes]` | parses `-d` with chrono-node → `POST /api/tasks` |
| `todo list --all` | `GET /api/tasks`, groups by status, Done capped at last 20 |
| `todo done <n>` / `start <n>` | resolves `<n>` → id, `PATCH {status}` |
| `todo rm <n>` | `DELETE` (soft), prints undo hint |
| `todo undo` | inverse of the last done/rm: `restore` or `PATCH {status:'todo'}` |
| `todo focus <n> [-t min]` | `POST /api/focus/start`, renders a terminal progress bar |
| `todo open` | health check, then `open http://127.0.0.1:4521` |
| `todo server start\|stop\|status` | health check / SIGTERM by pid file (fallback `lsof -ti :port`) |

Three mechanisms worth understanding:

**Index → id mapping.** Every printed list writes `{displayIndex: taskId}` to
`~/.todoo/last-list.json` (`format.js` → `state.js`). Commands taking `<n>` resolve it
through that file, so `todo done 2` means "the second task in whatever I last looked at".
Indexes are stable until the next list is printed.

**Undo.** `done`/`rm` write `{type, task_id}` to `~/.todoo/last-action.json`; `todo undo`
reads it, performs the inverse via the API, and clears it. One level deep, by design.

**Auto-start (`api.js`).** Every API call goes through `ensureServer()`: try
`GET /api/health`; on failure, `spawn` the server (`node packages/server/src/index.js`)
**detached with stdio ignored**, `unref()` so the CLI can exit while the server lives on,
write the pid to `~/.todoo/server.pid`, then poll health every 150 ms for up to 5 s.
This is why FR-3.5 ("every command works even when the server is down") holds, and why
business logic never needs to exist in the CLI.

The terminal focus timer mirrors the web's: it computes remaining time from the session's
`started_at` each tick, renders a 30-char progress bar in place (`\r`), rings the terminal
bell on completion, and stops the session on Ctrl-C (`completed: false`) — the same
`409`-guarded, server-owned session the web app would show.

`dates.js` wraps chrono-node with `forwardDate: true` (ambiguous dates resolve to the
future) and one opinion: if the user gave no time of day, default to **18:00 local**.

## 7. Cross-cutting design decisions

These four decisions shape most of the code; each exists to kill a specific class of bug.

### 7.1 The server never computes "today"

"Today" depends on the client's timezone, and the server can't know it. So every
time-windowed query (`/api/tasks?due_after/due_before`, `/api/stats?from&to`) takes
explicit UTC ISO bounds, and **clients** convert their local midnight–midnight to UTC
(`localDayRange()` on the web, `todayBounds()` in the CLI). The server only ever compares
ISO strings. Result: correct behavior in any timezone, including across DST changes, with
zero timezone code on the server.

### 7.2 Fractional ordering (`sort_order REAL`)

Dropping a card between neighbors with sort orders 1.0 and 2.0 writes 1.5 — **one UPDATE
to one row**, computed by the client, instead of re-indexing the column. Appends use
MAX+1. Repeated splitting shrinks the gap (1.5, 1.25, 1.125…), but a REAL has ~52 bits of
mantissa, so degenerate cases are far beyond human dragging; no rebalancing pass exists or
is needed at this scale.

### 7.3 Soft delete + 30-day purge

`DELETE` only sets `deleted_at`, which makes Undo trivial (`restore` clears it) and makes
deletion forgiving. Every live query filters `deleted_at IS NULL`. Actual row deletion
happens once, at server startup, for rows deleted more than 30 days ago
(`purgeOldDeleted` in `db/index.js`).

### 7.4 Timestamp-derived timers

iOS suspends JavaScript in background tabs/PWAs, so a timer that decrements a counter
every second silently freezes. Todoo never counts down: the server records `started_at`,
and every renderer (web ring, terminal bar) recomputes
`remaining = planned_sec - (now - started_at)` on each tick — plus immediately on
`visibilitychange`. A suspended phone wakes up showing the *correct* remaining time. The
server independently caps `duration_sec` at stop time, so stats stay honest too.

## 8. End-to-end walkthroughs

**`todo add "pay rent" -d "fri 14:00"`** → chrono-node parses to next Friday 14:00 local,
converted to ISO UTC → `ensureServer()` health-checks (spawns the server if needed) →
`POST /api/tasks` validates, trims, assigns bottom-of-column `sort_order`, inserts →
CLI prints confirmation. The web app sees it on its next refetch (≤5 s stale window or on
window focus) — same database, no sync protocol needed.

**Swipe right on a task (web)** → framer-motion `onDragEnd` passes the 80 px threshold →
`patch.mutate({status:'done'})`: cache updated instantly (row animates out via
`AnimatePresence`), `completed_at` predicted client-side → toast offers Undo for 5 s →
server PATCH sets the real `completed_at` and appends to the Done column → `onSettled`
refetch reconciles. Undo simply patches the status back.

**Drag a card between two cards** → BoardView computes midpoint `sort_order` →
`PATCH {status, sort_order}` → because `sort_order` is explicit, the server skips its
append rule and writes exactly that position → optimistic cache means the card never
flickers.

**Focus session across devices** → iPad: `POST /api/focus/start` (task promoted to
in_progress if it was todo; 409 if something is already running) → Mac opens `/focus`,
`GET /api/focus/active` returns the same session → both render the same ring from the
same `started_at` → iPad sleeps; on wake, `visibilitychange` re-syncs instantly → at zero,
the chime fires once (ref-guarded), `POST .../stop {completed:true}`, server computes
capped `duration_sec` → `/api/stats` for the local day now includes it.

## 9. Developing, testing, releasing

```bash
npm install          # workspace root; Node ≥ 23.4 required (node:sqlite)
npm run dev          # server :4521 + Vite :5173 (proxy /api), via concurrently
npm run build        # builds packages/web/dist
npm start            # production mode: API + built web app on :4521
npm test             # server integration suite + CLI date-parsing unit tests
npm run cli:link     # makes `todo` available globally
```

| Env var | Default | Purpose |
|---|---|---|
| `TODOO_PORT` | `4521` | API/server port |
| `TODOO_HOST` | `127.0.0.1` | `0.0.0.0` enables LAN access (no auth — trusted networks only) |
| `TODOO_DB` | `~/.todoo/data.db` | DB path; `:memory:` for throwaway runs and tests |

**Testing strategy.** Server tests (`packages/server/test/api.test.js`) build the app
with an in-memory DB and exercise every endpoint through `fastify.inject()` — full
HTTP semantics, no real port. CLI tests cover `parseDue()`, the most fragile logic.
The web UI is covered by a manual checklist per milestone (Safari first, iPhone SE width,
both themes, timer-after-backgrounding) — see `docs/PLAN.md`.

**Files on disk at runtime** (all under `~/.todoo/`): `data.db` (+ WAL/SHM sidecars),
`last-list.json`, `last-action.json`, `server.pid`. Backing up Todoo = copying `data.db`.

## 10. How to extend it

- **New API endpoint**: add a route module (or extend one) in `packages/server/src/routes/`,
  register it in `app.js`, define a JSON schema for the body, return the shared error
  shape, and add an inject() test. Document it in `docs/API.md`.
- **New web view**: add `src/views/X.jsx`, a `<Route>` in `App.jsx`, and a tab in
  `AppShell.jsx`'s `TABS`. Read data via `useTasks()` or a new query hook; write via
  mutations following the optimistic pattern in `useTasks.js`.
- **New CLI command**: add a `program.command()` in `packages/cli/src/index.js` calling
  the API through `api.js` (auto-start comes free). If it prints a task list, route it
  through `printList()` so `<n>` references keep working.
- **Schema change**: append a new SQL string to the `MIGRATIONS` array in
  `db/index.js` — never edit an applied migration; existing databases only run new entries.

Planned next (see README roadmap): recurring tasks, natural-language quick-add on the web,
streaks/weekly stats, cloud deployment with auth, Capacitor App Store build.

# Todoo — Requirements

## 1. Functional requirements

### FR-1 Task management
- FR-1.1 Create a task by typing a title and pressing Enter (web quick-add) or `todo add` (CLI).
- FR-1.2 A task may have: due date+time, notes, priority (none/low/medium/high).
- FR-1.3 Swipe right on a task (touch) marks it done; swipe left deletes it. Both show a 5-second Undo toast.
- FR-1.4 Deleting is always soft-delete; restore is possible until purge (30 days).
- FR-1.5 Tapping a task opens a detail view to edit title, notes, due, priority, and start focus.

### FR-2 Views
- FR-2.1 **Today** — sections: Overdue, Today, Tomorrow, No date. Quick-add on top.
- FR-2.2 **Board** — 3 columns (Todo / In Progress / Done), drag between columns and reorder within a column (works with touch on iPad). Done column shows only the last 7 days.
- FR-2.3 **Calendar** — month grid with dots on days that have tasks; tapping a day lists its tasks. Upcoming list (next 7 days) toggle.
- FR-2.4 **Focus** — pick a task (default: top of In Progress), countdown ring, configurable duration (15/25/45/custom), sound + prompt on finish, daily stats (minutes focused, sessions).

### FR-3 CLI (`todo`)
- FR-3.1 `todo` — list today + overdue, colorized.
- FR-3.2 `todo add "title" [-d "tomorrow 6pm"] [-p high]` — natural-language dates.
- FR-3.3 `todo done <n>` / `todo start <n>` / `todo rm <n>` / `todo undo` — `<n>` refers to the last printed list.
- FR-3.4 `todo list --all`, `todo open`, `todo focus <n> [-t 25]`, `todo server start|stop|status`.
- FR-3.5 Every command auto-starts the server if it is not running.

### FR-4 Appearance
- FR-4.1 Light & dark mode; follows system by default, manual override (auto/light/dark) persisted.
- FR-4.2 Minimal aesthetic: monochrome surfaces, a single accent color, rounded cards, smooth motion.

### FR-5 Platform reach
- FR-5.1 Installable as a PWA on iPhone, iPad, and Mac (manifest + service worker + icons).
- FR-5.2 Reachable from devices on the same Wi-Fi when the server opts into LAN mode.

## 2. Non-functional requirements
- NFR-1 Quick-add round trip (web, local) under 100 ms perceived (optimistic UI).
- NFR-2 Focus timer stays correct when iOS suspends the page (timestamp-based, never interval-counted).
- NFR-3 All data local to the user's machine; no third-party services.
- NFR-4 Server binds localhost by default; LAN exposure is explicit opt-in (`TODOO_HOST=0.0.0.0`).
- NFR-5 Works in Safari (primary), Chrome, Firefox; responsive from iPhone SE width (375px) to desktop.
- NFR-6 API covered by integration tests; date-parsing in CLI covered by unit tests.

## 3. Out of scope (v1)
Login/multi-user, cloud sync, collaboration/sharing, App Store distribution, push notifications
(iOS PWA notifications are unreliable; overdue tasks are surfaced visually instead).

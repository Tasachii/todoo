# Todoo API Contract (v1)

Base URL: `http://127.0.0.1:4521`
All bodies are JSON. All timestamps are ISO 8601 UTC strings (e.g. `2026-06-10T11:00:00.000Z`).
The server never computes "today" — clients always pass explicit time ranges in their local timezone, converted to UTC.

## Objects

### Task
```json
{
  "id": 1,
  "title": "Read chapter 4",
  "notes": "",
  "status": "todo",            // "todo" | "in_progress" | "done"
  "due_at": "2026-06-10T11:00:00.000Z",  // or null
  "priority": 0,                // 0 none, 1 low, 2 medium, 3 high
  "sort_order": 3.5,            // position inside its status column (ascending)
  "created_at": "2026-06-09T08:00:00.000Z",
  "completed_at": null,         // set when status becomes "done"
  "deleted_at": null            // soft delete marker
}
```

### FocusSession
```json
{
  "id": 1,
  "task_id": 4,                 // or null (free focus)
  "planned_sec": 1500,
  "started_at": "2026-06-10T08:00:00.000Z",
  "ended_at": null,             // null while running
  "duration_sec": null,         // actual elapsed seconds, set on stop
  "completed": 0                // 1 if the full planned duration elapsed
}
```

## Endpoints

### Health
- `GET /api/health` → `200 {"ok": true, "version": "0.1.0"}`

### Tasks
- `GET /api/tasks` → `200 {"tasks": [Task]}` ordered by `sort_order` ASC.
  Query params (all optional):
  - `status` — comma separated, e.g. `todo,in_progress`
  - `due_after`, `due_before` — ISO strings, filter on `due_at`
  - `q` — case-insensitive substring match on title/notes
  - `deleted=true` — return ONLY soft-deleted tasks (default: excluded)
- `POST /api/tasks` body `{title, notes?, due_at?, priority?, status?}` → `201 {"task": Task}`.
  `title` required, non-empty. New task goes to the bottom of its status column.
- `GET /api/tasks/:id` → `200 {"task": Task}` | `404`
- `PATCH /api/tasks/:id` body: any subset of `{title, notes, due_at, priority, status, sort_order}` → `200 {"task": Task}`.
  Rules:
  - `status` → `"done"` sets `completed_at` (now). Leaving `"done"` clears it.
  - `status` change WITHOUT `sort_order` appends to bottom of the target column.
  - Drag & drop sends both `status` and `sort_order` (fractional indexing; client computes midpoint).
- `DELETE /api/tasks/:id` → `200 {"task": Task}` (soft delete, sets `deleted_at`)
- `POST /api/tasks/:id/restore` → `200 {"task": Task}` (clears `deleted_at`)

### Focus
- `POST /api/focus/start` body `{task_id?, duration_sec}` → `201 {"session": FocusSession}`.
  `409` if a session is already active. If `task_id` given, that task's status is set to `in_progress` (unless already `done`).
- `POST /api/focus/:id/stop` body `{completed: boolean}` → `200 {"session": FocusSession}`.
  Server computes `duration_sec = now - started_at` (capped at `planned_sec`).
- `GET /api/focus/active` → `200 {"session": FocusSession | null}` (includes `task_title` when task_id is set)

### Stats
- `GET /api/stats?from=ISO&to=ISO` → `200 {"focus_sec": 4500, "focus_sessions": 3, "tasks_completed": 5}`
  Counts focus sessions whose `started_at` and completed tasks whose `completed_at` fall in `[from, to)`.

### Settings
- `GET /api/settings` → `200 {"settings": {"theme": "auto", "focus_duration_sec": "1500", "break_duration_sec": "300"}}`
- `PUT /api/settings` body `{key: value, ...}` (merge) → `200 {"settings": {...}}`

## Errors
Non-2xx responses: `{"error": {"code": "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "INTERNAL", "message": "..."}}`

Bodies are validated strictly: unknown fields, malformed JSON, and empty bodies that
claim `application/json` are all rejected with `400 VALIDATION`.

## Server behavior
- Binds `127.0.0.1` by default. Set `TODOO_HOST=0.0.0.0` to allow same-Wi-Fi devices (trusted networks only — there is no auth in v1).
- DB file: `~/.todoo/data.db` (override with `TODOO_DB`, use `:memory:` in tests).
- On startup, purges soft-deleted tasks older than 30 days.
- Serves the built web app (`packages/web/dist`) at `/` when present.

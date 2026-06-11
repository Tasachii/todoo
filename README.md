# Todoo

A local-first todo application for Mac, iPhone, and iPad, paired with a terminal CLI that
shares the same data. Capture a task from the command line in seconds, organize it on a
kanban board from your iPad, run a focus session, and review your week on the calendar —
all backed by a single SQLite file on your machine. No accounts, no cloud, no tracking.

## Why this exists

Most todo apps force a choice: fast capture (terminal tools) or rich organization
(GUI apps). Todoo does both against one source of truth. The REST API is the single
authority over the data; the web app and the CLI are equal clients, so a task added with
`todo add` appears in the browser instantly, and a card dragged to *Done* on the board is
reflected in the next `todo list`.

## Features

### Task management
- Quick-add bar on the web (type, press Enter) and `todo add` in the terminal, with
  natural-language dates such as `tomorrow 6pm`, `fri 14:00`, or `25/12`
- Tasks carry a due date and time, free-form notes, and a priority (none / low / medium / high)
- Swipe right on a task to complete it, swipe left to delete; both actions show a
  five-second Undo toast
- Deletion is always a soft delete; deleted tasks are recoverable for 30 days before
  being purged
- Tapping a task opens a detail sheet for editing title, notes, schedule, and priority

### Views
- **Today** — sections for Overdue, Today, Tomorrow, and Inbox (tasks without a date)
- **Board** — three columns (To do / In progress / Done) with drag and drop, including
  touch support on iPad; cards can also be reordered within a column
- **Calendar** — month grid with markers on days that have tasks, plus an Upcoming list
  covering the next seven days
- **Focus** — a countdown ring tied to a task, with two styles: a plain timer
  (15/25/45/custom minutes with an optional break) and a Pomodoro cycle (25/5 or 50/10
  work/break rounds with a long break after the fourth round, breaks starting
  automatically). Both play a completion chime and feed daily statistics (minutes
  focused, sessions, tasks completed)

### Platform
- Light and dark themes; follows the system setting by default with a manual override
- Installable as a PWA on iPhone, iPad, and Mac (Safari, Add to Home Screen)
- Accessible from other devices on the same Wi-Fi network when LAN mode is enabled
- The focus timer derives remaining time from timestamps, so it stays correct even when
  iOS suspends the page in the background

## Architecture

```
CLI (todo) ----+
               +----> Fastify REST API (127.0.0.1:4521) ----> SQLite (~/.todoo/data.db)
Browser -------+              |
                              +--- serves the built web app (packages/web/dist)
```

The repository is an npm-workspaces monorepo:

| Package | Role | Key technology |
|---|---|---|
| `packages/server` | REST API, data layer, serves the web build | Fastify 5, built-in `node:sqlite` |
| `packages/web` | Progressive web app | React 18, Vite, Tailwind CSS v4, TanStack Query, dnd-kit, framer-motion |
| `packages/cli` | `todo` command | commander, chrono-node, picocolors |

Design decisions worth noting:

- **`node:sqlite` over an ORM or native driver.** Node 23 ships SQLite in the standard
  library, which removes native compilation entirely. The database is one file; backing
  up means copying it.
- **The CLI never touches the database directly.** It speaks to the same API as the
  browser and transparently starts the server when it is not running, so business rules
  live in exactly one place.
- **Timezone-safe by construction.** The server never computes "today"; clients convert
  their local day boundaries to UTC and pass explicit ranges.
- **Fractional ordering.** Card positions use a `REAL` sort key, so dropping a card
  between two others writes a single midpoint value instead of re-indexing the column.

The full plan, requirements, and API contract are in [`docs/`](docs/).

## Requirements

- Node.js 23.4 or newer (for the built-in `node:sqlite` module)
- macOS is the primary target; Linux works as well

## Installation

```bash
git clone https://github.com/Tasachii/todoo.git
cd todoo
npm install
```

Install the `todo` command globally:

```bash
npm run cli:link
```

## Usage

### Development

```bash
npm run dev
```

This starts the API server on `http://127.0.0.1:4521` and the Vite dev server on
`http://localhost:5173` (with `/api` proxied to the backend).

### Daily use

```bash
npm run build    # build the web app once
npm start        # serve app + API together at http://127.0.0.1:4521
```

To use Todoo from an iPhone or iPad on the same Wi-Fi network:

```bash
TODOO_HOST=0.0.0.0 npm start
```

Then open `http://<your-mac-ip>:4521` in Safari and choose **Add to Home Screen** to
install it as an app. Note that LAN mode has no authentication; use it only on networks
you trust.

### CLI reference

```
todo                          List overdue, today, and inbox tasks
todo add "title"              Add a task
  -d, --due <text>            Natural-language due date ("tomorrow 6pm", "fri 14:00")
  -p, --priority <level>      low | med | high
  -n, --notes <text>          Attach notes
todo list --all               All tasks grouped by status
todo done <n>                 Complete task <n> from the last printed list
todo start <n>                Move task <n> to In progress
todo rm <n>                   Delete task <n> (soft delete)
todo undo                     Undo the last done/rm action
todo focus <n> [-t minutes]   Run a focus session in the terminal (default 25)
todo open                     Open the web app in the browser
todo server <action>          start | stop | status
```

List numbers refer to the most recently printed list, so a typical flow is `todo`,
then `todo done 2`.

### Configuration

| Environment variable | Default | Purpose |
|---|---|---|
| `TODOO_PORT` | `4521` | API/server port |
| `TODOO_HOST` | `127.0.0.1` | Bind address; set `0.0.0.0` to allow LAN access |
| `TODOO_DB` | `~/.todoo/data.db` | Database file path (`:memory:` for throwaway runs) |

## Testing

```bash
npm test
```

Runs the server integration suite (every endpoint, via Fastify's injection, no real
network) and the CLI unit tests (natural-language date parsing).

## Project documentation

- [`docs/PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md) — the full picture: how every part of the code works, data flows, and design decisions
- [`docs/PLAN.md`](docs/PLAN.md) — technical plan, milestones, and risk register
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — functional and non-functional requirements
- [`docs/API.md`](docs/API.md) — REST API contract
- [`SKILLS.md`](SKILLS.md) — log of skills and techniques used while building this project

## Roadmap

Planned after v1, in order of value: recurring tasks, natural-language quick-add in the
web app, streaks and weekly statistics, cloud deployment with authentication for use
outside the home network, and an App Store build via Capacitor.

import { program } from 'commander'
import pc from 'picocolors'
import { api } from './api.js'
import { parseDue } from './dates.js'
import { printList, formatDue, isOverdue, isDueToday } from './format.js'
import { readLastList, writeLastList, readLastAction, writeLastAction, clearLastAction } from './state.js'
import { execSync, spawn } from 'node:child_process'

// ── helpers ──────────────────────────────────────────────────────────────────

function handleError(err) {
  console.error(pc.red(`Error: ${err.message}`))
  process.exit(1)
}

function resolveIndex(n) {
  const idx = parseInt(n, 10)
  const mapping = readLastList()
  if (!mapping) {
    console.error(pc.yellow('No task list found. Run `todo` first to see your tasks.'))
    process.exit(1)
  }
  const id = mapping[idx]
  if (!id) {
    console.error(pc.yellow(`Index ${idx} not found. Run \`todo\` first to see your tasks.`))
    process.exit(1)
  }
  return id
}

function priorityToInt(p) {
  const map = { low: 1, med: 2, medium: 2, high: 3 }
  return map[p] ?? 0
}

/** Get local day boundaries as UTC ISO strings */
function todayBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

// ── default command: todo (no args) ──────────────────────────────────────────

async function cmdDefault() {
  try {
    const { tasks } = await api.get('/api/tasks?status=todo,in_progress')
    const now = new Date()
    const { start: todayStart, end: todayEnd } = todayBounds()

    const overdue = tasks.filter(t => t.due_at && new Date(t.due_at) < now)
    const today = tasks.filter(t => {
      if (!t.due_at) return false
      const d = new Date(t.due_at)
      return d >= now && new Date(t.due_at) <= new Date(todayEnd)
    })
    const inbox = tasks.filter(t => !t.due_at)

    const sections = [
      { label: 'Overdue', tasks: overdue },
      { label: 'Today', tasks: today },
      { label: 'Inbox', tasks: inbox },
    ]

    const anyTask = overdue.length + today.length + inbox.length > 0
    if (!anyTask) {
      console.log(pc.green('\nAll clear! No pending tasks.'))
      writeLastList({})
      return
    }

    printList(sections)
  } catch (err) {
    handleError(err)
  }
}

// ── add ───────────────────────────────────────────────────────────────────────

async function cmdAdd(title, opts) {
  try {
    const body = { title }
    if (opts.due) {
      const iso = parseDue(opts.due)
      if (!iso) {
        console.error(pc.red(`Could not parse date: "${opts.due}"`))
        process.exit(1)
      }
      body.due_at = iso
    }
    if (opts.priority) body.priority = priorityToInt(opts.priority)
    if (opts.notes) body.notes = opts.notes

    const { task } = await api.post('/api/tasks', body)
    const dueStr = task.due_at ? ` due ${formatDue(task.due_at)}` : ''
    console.log(pc.green(`Added: "${task.title}"${dueStr} (id ${task.id})`) )
  } catch (err) {
    handleError(err)
  }
}

// ── list --all ────────────────────────────────────────────────────────────────

async function cmdList(opts) {
  try {
    if (opts.all) {
      const { tasks: all } = await api.get('/api/tasks')
      const todo = all.filter(t => t.status === 'todo')
      const inProg = all.filter(t => t.status === 'in_progress')
      const done = all.filter(t => t.status === 'done').slice(-20)

      printList([
        { label: 'Todo', tasks: todo },
        { label: 'In Progress', tasks: inProg },
        { label: 'Done (last 20)', tasks: done },
      ])
    } else {
      await cmdDefault()
    }
  } catch (err) {
    handleError(err)
  }
}

// ── done ──────────────────────────────────────────────────────────────────────

async function cmdDone(n) {
  try {
    const id = resolveIndex(n)
    const { task } = await api.patch(`/api/tasks/${id}`, { status: 'done' })
    writeLastAction({ type: 'done', task_id: id })
    console.log(pc.green(`Done: "${task.title}"`))
  } catch (err) {
    handleError(err)
  }
}

// ── start ─────────────────────────────────────────────────────────────────────

async function cmdStart(n) {
  try {
    const id = resolveIndex(n)
    const { task } = await api.patch(`/api/tasks/${id}`, { status: 'in_progress' })
    console.log(pc.cyan(`Started: "${task.title}"`))
  } catch (err) {
    handleError(err)
  }
}

// ── rm ────────────────────────────────────────────────────────────────────────

async function cmdRm(n) {
  try {
    const id = resolveIndex(n)
    const { task } = await api.delete(`/api/tasks/${id}`)
    writeLastAction({ type: 'delete', task_id: id })
    console.log(pc.dim(`Deleted: "${task.title}"`))
    console.log(pc.dim('Run `todo undo` to restore.'))
  } catch (err) {
    handleError(err)
  }
}

// ── undo ──────────────────────────────────────────────────────────────────────

async function cmdUndo() {
  try {
    const action = readLastAction()
    if (!action || !action.type) {
      console.log(pc.yellow('Nothing to undo.'))
      return
    }
    if (action.type === 'delete') {
      const { task } = await api.post(`/api/tasks/${action.task_id}/restore`)
      clearLastAction()
      console.log(pc.green(`Restored: "${task.title}"`))
    } else if (action.type === 'done') {
      const { task } = await api.patch(`/api/tasks/${action.task_id}`, { status: 'todo' })
      clearLastAction()
      console.log(pc.green(`Marked todo again: "${task.title}"`))
    } else {
      console.log(pc.yellow('Nothing to undo.'))
    }
  } catch (err) {
    handleError(err)
  }
}

// ── focus ─────────────────────────────────────────────────────────────────────

async function cmdFocus(n, opts) {
  const minutes = parseInt(opts.time ?? 25, 10)
  const duration_sec = minutes * 60

  let task_id
  try {
    task_id = resolveIndex(n)
  } catch {
    // resolveIndex already exits on error
    return
  }

  let session
  try {
    const result = await api.post('/api/focus/start', { task_id, duration_sec })
    session = result.session
  } catch (err) {
    if (err.status === 409) {
      console.error(pc.yellow('A focus session is already active. Run `todo server status` or check the web app.'))
      process.exit(1)
    }
    handleError(err)
  }

  const started = new Date(session.started_at).getTime()
  const planned = session.planned_sec * 1000
  const BAR_WIDTH = 30

  function renderBar() {
    const now = Date.now()
    const elapsed = now - started
    const remaining = Math.max(0, planned - elapsed)
    const remainSec = Math.ceil(remaining / 1000)
    const progress = Math.min(1, elapsed / planned)
    const filled = Math.round(progress * BAR_WIDTH)
    const empty = BAR_WIDTH - filled
    const bar = pc.green('█'.repeat(filled)) + pc.dim('░'.repeat(empty))
    const mins = String(Math.floor(remainSec / 60)).padStart(2, '0')
    const secs = String(remainSec % 60).padStart(2, '0')
    process.stdout.write(`\r[${bar}] ${mins}:${secs} remaining `)
    return remaining <= 0
  }

  console.log(pc.cyan(`\nFocus: ${minutes}m on task #${n}. Press Ctrl-C to stop.\n`))

  let interval
  let stopped = false

  async function stop(completed) {
    if (stopped) return
    stopped = true
    clearInterval(interval)
    process.stdout.write('\n')
    try {
      await api.post(`/api/focus/${session.id}/stop`, { completed })
    } catch {}
    if (completed) {
      process.stdout.write('\x07') // bell
      console.log(pc.green('\nFocus session complete!'))
      console.log(pc.dim(`Run \`todo done ${n}\` to mark the task done.`))
    } else {
      console.log(pc.yellow('\nFocus session stopped.'))
    }
  }

  process.on('SIGINT', async () => {
    await stop(false)
    process.exit(0)
  })

  interval = setInterval(async () => {
    const done = renderBar()
    if (done) {
      await stop(true)
      process.exit(0)
    }
  }, 1000)

  // Initial render
  renderBar()
}

// ── open ──────────────────────────────────────────────────────────────────────

async function cmdOpen() {
  try {
    await api.get('/api/health')
    execSync(`open http://127.0.0.1:${process.env.TODOO_PORT || 4521}`)
  } catch (err) {
    handleError(err)
  }
}

// ── server ────────────────────────────────────────────────────────────────────

async function cmdServer(action) {
  const { readServerPid } = await import('./state.js')

  if (action === 'start') {
    const { serverIsUp, ensureServer } = await import('./api.js')
    if (await serverIsUp()) {
      console.log(pc.green('Server is already running.'))
    } else {
      await ensureServer() // exits with an error message if it cannot start
      console.log(pc.green('Server started.'))
    }
  } else if (action === 'stop') {
    let killed = false
    const pid = readServerPid()
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM')
        killed = true
        console.log(pc.dim(`Stopped server (pid ${pid}).`))
      } catch {}
    }
    if (!killed) {
      try {
        const pids = execSync(`lsof -ti :${process.env.TODOO_PORT || 4521}`).toString().trim()
        if (pids) {
          pids.split('\n').forEach(p => {
            try { process.kill(parseInt(p, 10), 'SIGTERM') } catch {}
          })
          console.log(pc.dim('Stopped server.'))
        } else {
          console.log(pc.yellow('No server process found.'))
        }
      } catch {
        console.log(pc.yellow('No server process found.'))
      }
    }
  } else if (action === 'status') {
    try {
      const { ok, version } = await api.get('/api/health')
      console.log(pc.green(`Server running — version ${version}`))
    } catch {
      console.log(pc.yellow('Server is not running.'))
    }
  } else {
    console.error(pc.red(`Unknown server action: ${action}. Use start|stop|status.`))
    process.exit(1)
  }
}

// ── wire up commander ─────────────────────────────────────────────────────────

program
  .name('todo')
  .description('todoo CLI')
  .version('0.1.0')
  .action(cmdDefault)

program
  .command('add <title>')
  .description('Add a new task')
  .option('-d, --due <text>', 'Due date (natural language)')
  .option('-p, --priority <level>', 'Priority: low | med | high')
  .option('-n, --notes <text>', 'Notes')
  .action(cmdAdd)

program
  .command('list')
  .description('List tasks (use --all for all statuses)')
  .option('--all', 'Show all tasks grouped by status')
  .action(cmdList)

program
  .command('done <n>')
  .description('Mark task <n> (from last list) as done')
  .action(cmdDone)

program
  .command('start <n>')
  .description('Mark task <n> as in_progress')
  .action(cmdStart)

program
  .command('rm <n>')
  .description('Soft-delete task <n>')
  .action(cmdRm)

program
  .command('undo')
  .description('Undo the last done or rm action')
  .action(cmdUndo)

program
  .command('focus <n>')
  .description('Start a focus session on task <n>')
  .option('-t, --time <minutes>', 'Duration in minutes (default 25)')
  .action(cmdFocus)

program
  .command('open')
  .description('Open the web UI in the browser')
  .action(cmdOpen)

program
  .command('server <action>')
  .description('Manage the server: start|stop|status')
  .action(cmdServer)

export { program }

import pc from 'picocolors'
import { writeLastList } from './state.js'

const PRIORITY_LABELS = { 0: '', 1: '!', 2: '!!', 3: '!!!' }

/**
 * Format a due date for display in local time.
 * @param {string|null} due_at - ISO UTC string
 * @returns {string}
 */
export function formatDue(due_at) {
  if (!due_at) return ''
  const d = new Date(due_at)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

/**
 * Determine if a task is overdue (due_at < now, not done).
 */
export function isOverdue(task) {
  if (!task.due_at) return false
  if (task.status === 'done') return false
  return new Date(task.due_at) < new Date()
}

/**
 * Determine if a task is due today (local timezone).
 */
export function isDueToday(task) {
  if (!task.due_at) return false
  if (task.status === 'done') return false
  const due = new Date(task.due_at)
  const now = new Date()
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  )
}

/**
 * Render a single task line with color.
 * @param {number} index - 1-based display index
 * @param {object} task
 * @returns {string}
 */
export function renderTask(index, task) {
  const pri = PRIORITY_LABELS[task.priority] || ''
  const due = formatDue(task.due_at)
  const priStr = pri ? pc.bold(pc.yellow(` ${pri}`)) : ''
  const dueStr = due ? pc.dim(` [${due}]`) : ''
  const numStr = pc.dim(`${String(index).padStart(2)}.`)

  let title = task.title
  let line

  if (task.status === 'done') {
    // dim + strikethrough simulation (crossed out)
    line = `${numStr} ${pc.dim(pc.strikethrough(title))}${priStr}${dueStr}`
  } else if (isOverdue(task)) {
    line = `${numStr} ${pc.red(title)}${priStr}${dueStr}`
  } else if (isDueToday(task)) {
    line = `${numStr} ${pc.yellow(title)}${priStr}${dueStr}`
  } else {
    line = `${numStr} ${title}${priStr}${dueStr}`
  }

  return line
}

/**
 * Print a labeled section of tasks, returns the count printed.
 * @param {string} label
 * @param {object[]} tasks
 * @param {object} mapping - index→task_id mapping (mutated in place)
 * @param {number} startIndex
 * @returns {number} next index
 */
export function printSection(label, tasks, mapping, startIndex = 1) {
  if (tasks.length === 0) return startIndex
  console.log(pc.bold(pc.cyan(`\n${label}`)))
  let idx = startIndex
  for (const task of tasks) {
    mapping[idx] = task.id
    console.log(renderTask(idx, task))
    idx++
  }
  return idx
}

/**
 * Print a list of tasks grouped into sections, saves the index→id mapping.
 * sections: array of {label, tasks}
 * @param {Array<{label: string, tasks: object[]}>} sections
 */
export function printList(sections) {
  const mapping = {}
  let idx = 1
  let anyPrinted = false

  for (const { label, tasks } of sections) {
    if (tasks.length > 0) {
      anyPrinted = true
      idx = printSection(label, tasks, mapping, idx)
    }
  }

  if (!anyPrinted) {
    console.log(pc.dim('\nNo tasks found.'))
  } else {
    console.log('') // trailing newline
  }

  writeLastList(mapping)
}

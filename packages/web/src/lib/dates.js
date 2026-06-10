import {
  isToday,
  isTomorrow,
  isThisYear,
  startOfDay,
  endOfDay,
  format,
  parseISO,
} from 'date-fns'

export const dayKey = (date) => format(date, 'yyyy-MM-dd')

export function localDayRange(date = new Date()) {
  return { from: startOfDay(date).toISOString(), to: endOfDay(date).toISOString() }
}

export function isOverdue(task, now = new Date()) {
  return task.due_at && task.status !== 'done' && new Date(task.due_at) < now
}

export function formatDue(iso) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  const time = format(d, 'HH:mm')
  if (isToday(d)) return `Today ${time}`
  if (isTomorrow(d)) return `Tomorrow ${time}`
  return `${format(d, isThisYear(d) ? 'EEE d MMM' : 'd MMM yyyy')} ${time}`
}

// value for <input type="datetime-local">
export function toLocalInput(iso) {
  if (!iso) return ''
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
}

export function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null
}

// Natural-language date detection for the quick-add bar.
// Mirrors the CLI's parsing rules (packages/cli/src/dates.js): forward-looking
// dates, and 18:00 local when no time of day is given.
//
// chrono-node is sizeable, so callers load this module lazily (dynamic import)
// — it becomes its own chunk and only downloads on first use.

import * as chrono from 'chrono-node'

/**
 * Find a date phrase inside a quick-add title.
 * @param {string} text
 * @param {Date} ref
 * @returns {{ due_at: string, matched: string, title: string } | null}
 *   due_at — ISO UTC; matched — the phrase found (e.g. "tomorrow 6pm");
 *   title — the input with the phrase removed and whitespace tidied.
 */
export function detectDue(text, ref = new Date()) {
  if (!text || typeof text !== 'string') return null

  const results = chrono.parse(text, ref, { forwardDate: true })
  if (!results || results.length === 0) return null

  const result = results[0]
  const date = result.date()
  if (!date) return null

  // Bare numbers ("call 42") parse as days/hours in chrono — too eager for a
  // quick-add bar. Only accept phrases that contain a letter or a date
  // separator, so "42" is a title but "25/12" and "tomorrow" are dates.
  if (!/[a-z/:]/i.test(result.text)) return null

  if (!result.start.isCertain('hour')) {
    date.setHours(18, 0, 0, 0)
  }
  // Note: "dinner at 8" parses as 08:00 (hour certain, meridiem not) — kept
  // as-is deliberately; the chip makes it visible and the picker overrides.

  // Never schedule into the past: the 18:00 default (or an ambiguous morning
  // hour) can land before "now". Keep an explicit weekday on its weekday.
  if (date < ref) {
    date.setDate(date.getDate() + (result.start.isCertain('weekday') ? 7 : 1))
  }

  const title = (
    text.slice(0, result.index) + text.slice(result.index + result.text.length)
  )
    .replace(/\s{2,}/g, ' ')
    .trim()

  // The whole input was a date — that's a title, not a schedule.
  if (!title) return null

  return { due_at: date.toISOString(), matched: result.text, title }
}

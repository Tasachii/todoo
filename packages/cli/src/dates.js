import * as chrono from 'chrono-node'

/**
 * Parse a natural language date string into an ISO UTC string.
 * @param {string} text
 * @param {Date} ref - reference date for relative expressions
 * @returns {string|null} ISO UTC string or null if unparseable
 */
export function parseDue(text, ref = new Date()) {
  if (!text || typeof text !== 'string') return null

  const results = chrono.parse(text, ref, { forwardDate: true })
  if (!results || results.length === 0) return null

  const result = results[0]
  const date = result.date()
  if (!date) return null

  // If no time of day was specified, default to 18:00 local time
  if (!result.start.isCertain('hour')) {
    date.setHours(18, 0, 0, 0)
  }

  return date.toISOString()
}

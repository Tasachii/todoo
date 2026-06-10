import { describe, it, expect } from 'vitest'
import { parseDue } from '../src/dates.js'

// Fixed reference date: 2026-06-10T03:00:00 (local time, a Wednesday)
const REF = new Date('2026-06-10T03:00:00')

describe('parseDue', () => {
  it('returns null for garbage input', () => {
    expect(parseDue('asdfghjkl', REF)).toBeNull()
    expect(parseDue('', REF)).toBeNull()
    expect(parseDue(null, REF)).toBeNull()
  })

  it('"tomorrow 6pm" → next day at 18:00 local', () => {
    const result = parseDue('tomorrow 6pm', REF)
    expect(result).not.toBeNull()
    const d = new Date(result)
    // Should be 2026-06-11
    const local = new Date(d)
    expect(local.getFullYear()).toBe(2026)
    expect(local.getMonth()).toBe(5) // June = 5
    expect(local.getDate()).toBe(11)
    expect(local.getHours()).toBe(18)
    expect(local.getMinutes()).toBe(0)
  })

  it('"today" with no time → defaults to 18:00 local', () => {
    const result = parseDue('today', REF)
    expect(result).not.toBeNull()
    const d = new Date(result)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(10)
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(0)
  })

  it('"fri 14:00" → next Friday at 14:00 local', () => {
    const result = parseDue('fri 14:00', REF)
    expect(result).not.toBeNull()
    const d = new Date(result)
    // 2026-06-10 is a Wednesday; next Friday is 2026-06-12
    expect(d.getDay()).toBe(5) // Friday
    expect(d.getHours()).toBe(14)
    expect(d.getMinutes()).toBe(0)
  })

  it('"25/12" with no time → defaults to 18:00 local on Dec 25', () => {
    const result = parseDue('25/12', REF)
    expect(result).not.toBeNull()
    const d = new Date(result)
    expect(d.getMonth()).toBe(11) // December = 11
    expect(d.getDate()).toBe(25)
    expect(d.getHours()).toBe(18)
    expect(d.getMinutes()).toBe(0)
  })

  it('default-18:00 behavior: no time given sets hour to 18', () => {
    const result = parseDue('next monday', REF)
    expect(result).not.toBeNull()
    const d = new Date(result)
    expect(d.getHours()).toBe(18)
  })

  it('explicit time is preserved', () => {
    const result = parseDue('tomorrow 9am', REF)
    expect(result).not.toBeNull()
    const d = new Date(result)
    expect(d.getHours()).toBe(9)
  })
})

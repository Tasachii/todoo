import { describe, it, expect } from 'vitest'
import { detectDue } from '../src/lib/quickdate.js'

// Fixed reference: Wednesday 2026-06-10, 03:00 local
const REF = new Date('2026-06-10T03:00:00')

describe('detectDue', () => {
  it('finds the phrase, strips it from the title, defaults to 18:00', () => {
    const r = detectDue('pay rent tomorrow', REF)
    expect(r).not.toBeNull()
    expect(r.title).toBe('pay rent')
    expect(r.matched).toBe('tomorrow')
    const d = new Date(r.due_at)
    expect(d.getDate()).toBe(11)
    expect(d.getHours()).toBe(18)
  })

  it('keeps an explicit time and handles mid-string phrases', () => {
    const r = detectDue('ส่งงาน tomorrow 6pm ให้ลูกค้า', REF)
    expect(r.title).toBe('ส่งงาน ให้ลูกค้า')
    expect(new Date(r.due_at).getHours()).toBe(18)
  })

  it('parses day names and slash dates forward', () => {
    expect(new Date(detectDue('review fri 14:00', REF).due_at).getDay()).toBe(5)
    const xmas = detectDue('ซื้อของขวัญ 25/12', REF)
    expect(new Date(xmas.due_at).getMonth()).toBe(11)
    expect(new Date(xmas.due_at).getDate()).toBe(25)
  })

  it('ignores bare numbers and plain titles', () => {
    expect(detectDue('call agent 42', REF)).toBeNull()
    expect(detectDue('buy milk', REF)).toBeNull()
    expect(detectDue('', REF)).toBeNull()
    expect(detectDue(null, REF)).toBeNull()
  })

  it('returns null when the whole input is just a date (no title left)', () => {
    expect(detectDue('tomorrow 6pm', REF)).toBeNull()
  })

  it('never schedules into the past', () => {
    const evening = new Date('2026-06-10T20:00:00') // 18:00 default already passed
    const r = detectDue('finish report today', evening)
    expect(new Date(r.due_at) > evening).toBe(true)
    expect(new Date(r.due_at).getHours()).toBe(18)

    // an explicit weekday whose time already passed keeps its weekday (+7 days)
    const friAfternoon = new Date('2026-06-12T15:00:00') // a Friday, after 14:00
    const fri = detectDue('review fri 14:00', friAfternoon)
    const d = new Date(fri.due_at)
    expect(d.getDay()).toBe(5)
    expect(d > friAfternoon).toBe(true)
  })
})

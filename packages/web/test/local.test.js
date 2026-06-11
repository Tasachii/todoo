import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalApi } from '../src/api/local.js'

// The standalone engine must follow the same business rules as the server —
// these tests mirror packages/server/test/api.test.js case by case.

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    dump: () => map.get('todoo-data-v1'),
  }
}

let api
let storage

beforeEach(() => {
  storage = memoryStorage()
  api = createLocalApi(storage)
})

describe('tasks', () => {
  it('creates a task with defaults and trims the title', async () => {
    const task = await api.createTask({ title: '  read ch4  ' })
    expect(task.title).toBe('read ch4')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe(0)
    expect(task.sort_order).toBe(1)
    expect(task.completed_at).toBeNull()
  })

  it('rejects empty titles', async () => {
    await expect(api.createTask({ title: '' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.createTask({})).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('rejects out-of-bounds fields like the server schemas do', async () => {
    await expect(api.createTask({ title: 'x', status: 'frozen' })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    await expect(api.createTask({ title: 'x', priority: 9 })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    await expect(api.createTask({ title: 'y'.repeat(501) })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    const a = await api.createTask({ title: 'ok' })
    await expect(api.patchTask(a.id, { status: 'nope' })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    await expect(api.patchTask(a.id, { priority: -1 })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })

  it('marks done and sets completed_at, appends to the done column', async () => {
    const a = await api.createTask({ title: 'a' })
    await api.createTask({ title: 'old done', status: 'done' })

    const updated = await api.patchTask(a.id, { status: 'done' })
    expect(updated.completed_at).toBeTruthy()
    const done = (await api.tasks()).filter((t) => t.status === 'done')
    expect(done.at(-1).id).toBe(a.id)

    const back = await api.patchTask(a.id, { status: 'todo' })
    expect(back.completed_at).toBeNull()
  })

  it('respects explicit sort_order on drag', async () => {
    const a = await api.createTask({ title: 'a' })
    await api.createTask({ title: 'b' })
    const moved = await api.patchTask(a.id, { status: 'in_progress', sort_order: 0.5 })
    expect(moved.sort_order).toBe(0.5)
    expect(moved.status).toBe('in_progress')
  })

  it('soft deletes, hides from lists, restores', async () => {
    const a = await api.createTask({ title: 'a' })
    const deleted = await api.deleteTask(a.id)
    expect(deleted.deleted_at).toBeTruthy()
    expect(await api.tasks()).toHaveLength(0)

    const restored = await api.restoreTask(a.id)
    expect(restored.deleted_at).toBeNull()
    expect(await api.tasks()).toHaveLength(1)
  })

  it('404s on missing or already-deleted ids', async () => {
    await expect(api.patchTask(999, { title: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const a = await api.createTask({ title: 'a' })
    await api.deleteTask(a.id)
    await expect(api.deleteTask(a.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(api.restoreTask(999)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('purges soft-deleted tasks older than 30 days on startup', async () => {
    const a = await api.createTask({ title: 'old' })
    await api.deleteTask(a.id)
    // backdate the deletion beyond the purge window, then "relaunch"
    const snapshot = JSON.parse(storage.dump())
    snapshot.tasks[0].deleted_at = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString()
    storage.setItem('todoo-data-v1', JSON.stringify(snapshot))

    const reopened = createLocalApi(storage)
    await expect(reopened.restoreTask(a.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('focus sessions', () => {
  it('starts, blocks a second session, stops with elapsed time', async () => {
    const task = await api.createTask({ title: 'a' })
    const session = await api.focusStart({ task_id: task.id, duration_sec: 1500 })
    expect(session.ended_at).toBeNull()

    const after = (await api.tasks()).find((t) => t.id === task.id)
    expect(after.status).toBe('in_progress')

    await expect(api.focusStart({ duration_sec: 1500 })).rejects.toMatchObject({
      code: 'CONFLICT',
    })

    const active = await api.focusActive()
    expect(active.id).toBe(session.id)
    expect(active.task_title).toBe('a')

    const stopped = await api.focusStop(session.id, false)
    expect(stopped.ended_at).toBeTruthy()
    expect(stopped.duration_sec).toBeGreaterThanOrEqual(0)
    expect(await api.focusActive()).toBeNull()
  })

  it('stop is idempotent and caps duration at planned_sec', async () => {
    let t = new Date('2026-06-11T08:00:00.000Z')
    const clocked = createLocalApi(memoryStorage(), () => t)
    const session = await clocked.focusStart({ duration_sec: 60 })
    t = new Date('2026-06-11T09:00:00.000Z') // an hour later
    const stopped = await clocked.focusStop(session.id, true)
    expect(stopped.duration_sec).toBe(60) // capped
    const again = await clocked.focusStop(session.id, false)
    expect(again.completed).toBe(1) // unchanged — idempotent
  })

  it('clamps duration at 0 when the device clock moves backwards', async () => {
    let t = new Date('2026-06-11T08:00:00.000Z')
    const clocked = createLocalApi(memoryStorage(), () => t)
    const session = await clocked.focusStart({ duration_sec: 60 })
    t = new Date('2026-06-11T07:00:00.000Z') // clock wound back an hour
    const stopped = await clocked.focusStop(session.id, false)
    expect(stopped.duration_sec).toBe(0) // never negative
  })

  it('rejects out-of-range durations', async () => {
    await expect(api.focusStart({ duration_sec: 5 })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })
})

describe('stats', () => {
  it('counts completed tasks and finished focus time in range', async () => {
    const task = await api.createTask({ title: 'a' })
    await api.patchTask(task.id, { status: 'done' })
    const session = await api.focusStart({ duration_sec: 60 })
    await api.focusStop(session.id, true)

    const from = new Date(Date.now() - 3600_000).toISOString()
    const to = new Date(Date.now() + 3600_000).toISOString()
    const stats = await api.stats(from, to)
    expect(stats.tasks_completed).toBe(1)
    expect(stats.focus_sessions).toBe(1)
  })
})

describe('settings and persistence', () => {
  it('returns defaults and merges updates', async () => {
    const before = await api.settings()
    expect(before.theme).toBe('auto')
    expect(before.focus_style).toBe('timer')
    expect(before.pomodoro_rounds).toBe('4')

    const after = await api.saveSettings({ focus_style: 'pomodoro', pomodoro_work_sec: 3000 })
    expect(after.focus_style).toBe('pomodoro')
    expect(after.pomodoro_work_sec).toBe('3000') // values stored as strings
    expect(after.break_duration_sec).toBe('300')
  })

  it('survives a relaunch from the same storage', async () => {
    await api.createTask({ title: 'persisted' })
    await api.saveSettings({ theme: 'dark' })

    const reopened = createLocalApi(storage)
    expect((await reopened.tasks())[0].title).toBe('persisted')
    expect((await reopened.settings()).theme).toBe('dark')
    const next = await reopened.createTask({ title: 'second' })
    expect(next.id).toBe(2) // id sequence continues, no collisions
  })

  it('export → import round-trips into a fresh engine without id collisions', async () => {
    const keep = await api.createTask({ title: 'keep', priority: 2 })
    const gone = await api.createTask({ title: 'gone' })
    await api.deleteTask(gone.id)
    const session = await api.focusStart({ duration_sec: 60 })
    await api.focusStop(session.id, true)
    await api.saveSettings({ theme: 'dark' })

    const dump = await api.exportData()
    expect(dump.app).toBe('todoo')
    expect(dump.tasks).toHaveLength(2) // includes the deleted one

    const fresh = createLocalApi(memoryStorage())
    const { imported } = await fresh.importData(dump)
    expect(imported).toEqual({ tasks: 2, focus_sessions: 1, settings: 1 })

    const tasks = await fresh.tasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ id: keep.id, title: 'keep', priority: 2 })
    expect((await fresh.settings()).theme).toBe('dark')
    const next = await fresh.createTask({ title: 'new' })
    expect(next.id).toBeGreaterThan(gone.id)
  })

  it('importData rejects non-backup payloads', async () => {
    await expect(api.importData({ hello: 'world' })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    await expect(api.importData({ app: 'other', version: 1, tasks: [] })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
  })

  it('importData rejects malformed rows instead of poisoning the store', async () => {
    const base = { app: 'todoo', version: 1 }
    const task = (over) => ({
      id: 1, title: 'x', status: 'todo', sort_order: 1, ...over,
    })
    // non-numeric id would make taskSeq NaN forever
    await expect(api.importData({ ...base, tasks: [task({ id: 'x' })] })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    // duplicate ids
    await expect(
      api.importData({ ...base, tasks: [task({}), task({ title: 'y' })] })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    // invalid status / missing sort_order
    await expect(
      api.importData({ ...base, tasks: [task({ status: 'NONSENSE' })] })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      api.importData({ ...base, tasks: [task({ sort_order: undefined })] })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    // the store is untouched and still works after rejected imports
    const created = await api.createTask({ title: 'still fine' })
    expect(Number.isFinite(created.id)).toBe(true)
  })

  it('starts fresh when the snapshot is corrupt, keeping a recovery copy', async () => {
    storage.setItem('todoo-data-v1', '{not json')
    const reopened = createLocalApi(storage)
    expect(await reopened.tasks()).toEqual([])
    expect(storage.getItem('todoo-data-v1.corrupt')).toBe('{not json')
  })

  it('reconciles sequence counters from a partial snapshot (no id collisions)', async () => {
    storage.setItem(
      'todoo-data-v1',
      JSON.stringify({ tasks: [{ id: 7, title: 'old', status: 'todo', sort_order: 1 }] })
    )
    const reopened = createLocalApi(storage)
    const created = await reopened.createTask({ title: 'new' })
    expect(created.id).toBe(8)
  })
})

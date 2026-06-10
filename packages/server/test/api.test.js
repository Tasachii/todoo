import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from '../src/db/index.js'
import { buildApp } from '../src/app.js'

let app

beforeEach(() => {
  app = buildApp({ db: openDb(':memory:') })
})

async function createTask(body) {
  const res = await app.inject({ method: 'POST', url: '/api/tasks', body })
  return res.json().task
}

describe('health', () => {
  it('responds ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})

describe('tasks CRUD', () => {
  it('creates a task with defaults', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/tasks', body: { title: '  read ch4  ' } })
    expect(res.statusCode).toBe(201)
    const { task } = res.json()
    expect(task.title).toBe('read ch4')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe(0)
    expect(task.sort_order).toBe(1)
    expect(task.completed_at).toBeNull()
  })

  it('rejects empty titles and strips unknown fields', async () => {
    const empty = await app.inject({ method: 'POST', url: '/api/tasks', body: { title: '' } })
    expect(empty.statusCode).toBe(400)
    expect(empty.json().error.code).toBe('VALIDATION')
    // Fastify's default Ajv config removes additionalProperties instead of rejecting
    const unknown = await app.inject({ method: 'POST', url: '/api/tasks', body: { title: 'x', nope: 1 } })
    expect(unknown.statusCode).toBe(201)
    expect(unknown.json().task.nope).toBeUndefined()
  })

  it('lists with status and due range filters', async () => {
    await createTask({ title: 'a', due_at: '2026-06-10T05:00:00.000Z' })
    await createTask({ title: 'b', due_at: '2026-06-11T05:00:00.000Z' })
    await createTask({ title: 'c', status: 'done' })

    const todo = await app.inject({ method: 'GET', url: '/api/tasks?status=todo' })
    expect(todo.json().tasks.map((t) => t.title)).toEqual(['a', 'b'])

    const ranged = await app.inject({
      method: 'GET',
      url: '/api/tasks?due_after=2026-06-10T00:00:00.000Z&due_before=2026-06-11T00:00:00.000Z',
    })
    expect(ranged.json().tasks.map((t) => t.title)).toEqual(['a'])
  })

  it('marks done via PATCH and sets completed_at, appends to done column', async () => {
    const task = await createTask({ title: 'a' })
    await createTask({ title: 'old done', status: 'done' })
    const res = await app.inject({ method: 'PATCH', url: `/api/tasks/${task.id}`, body: { status: 'done' } })
    const updated = res.json().task
    expect(updated.completed_at).toBeTruthy()
    const done = await app.inject({ method: 'GET', url: '/api/tasks?status=done' })
    expect(done.json().tasks.at(-1).id).toBe(task.id)

    const back = await app.inject({ method: 'PATCH', url: `/api/tasks/${task.id}`, body: { status: 'todo' } })
    expect(back.json().task.completed_at).toBeNull()
  })

  it('respects explicit sort_order on drag', async () => {
    const a = await createTask({ title: 'a' })
    await createTask({ title: 'b' })
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${a.id}`,
      body: { status: 'in_progress', sort_order: 0.5 },
    })
    expect(res.json().task.sort_order).toBe(0.5)
  })

  it('soft deletes, hides from lists, restores', async () => {
    const task = await createTask({ title: 'a' })
    const del = await app.inject({ method: 'DELETE', url: `/api/tasks/${task.id}` })
    expect(del.json().task.deleted_at).toBeTruthy()

    const list = await app.inject({ method: 'GET', url: '/api/tasks' })
    expect(list.json().tasks).toHaveLength(0)
    const trash = await app.inject({ method: 'GET', url: '/api/tasks?deleted=true' })
    expect(trash.json().tasks).toHaveLength(1)

    const restored = await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/restore` })
    expect(restored.json().task.deleted_at).toBeNull()
  })

  it('404s on missing ids', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks/999' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })
})

describe('focus sessions', () => {
  it('starts, blocks a second session, stops with elapsed time', async () => {
    const task = await createTask({ title: 'a' })
    const start = await app.inject({
      method: 'POST',
      url: '/api/focus/start',
      body: { task_id: task.id, duration_sec: 1500 },
    })
    expect(start.statusCode).toBe(201)
    const session = start.json().session

    const taskAfter = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` })
    expect(taskAfter.json().task.status).toBe('in_progress')

    const second = await app.inject({ method: 'POST', url: '/api/focus/start', body: { duration_sec: 1500 } })
    expect(second.statusCode).toBe(409)

    const active = await app.inject({ method: 'GET', url: '/api/focus/active' })
    expect(active.json().session.id).toBe(session.id)
    expect(active.json().session.task_title).toBe('a')

    const stop = await app.inject({
      method: 'POST',
      url: `/api/focus/${session.id}/stop`,
      body: { completed: false },
    })
    expect(stop.json().session.ended_at).toBeTruthy()
    expect(stop.json().session.duration_sec).toBeGreaterThanOrEqual(0)

    const none = await app.inject({ method: 'GET', url: '/api/focus/active' })
    expect(none.json().session).toBeNull()
  })

  it('rejects out-of-range durations', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/focus/start', body: { duration_sec: 5 } })
    expect(res.statusCode).toBe(400)
  })
})

describe('stats', () => {
  it('counts completed tasks and finished focus time in range', async () => {
    const task = await createTask({ title: 'a' })
    await app.inject({ method: 'PATCH', url: `/api/tasks/${task.id}`, body: { status: 'done' } })
    const start = await app.inject({ method: 'POST', url: '/api/focus/start', body: { duration_sec: 60 } })
    await app.inject({ method: 'POST', url: `/api/focus/${start.json().session.id}/stop`, body: { completed: true } })

    const from = new Date(Date.now() - 3600_000).toISOString()
    const to = new Date(Date.now() + 3600_000).toISOString()
    const res = await app.inject({ method: 'GET', url: `/api/stats?from=${from}&to=${to}` })
    expect(res.json().tasks_completed).toBe(1)
    expect(res.json().focus_sessions).toBe(1)
  })
})

describe('settings', () => {
  it('returns defaults and merges updates', async () => {
    const before = await app.inject({ method: 'GET', url: '/api/settings' })
    expect(before.json().settings.theme).toBe('auto')

    await app.inject({ method: 'PUT', url: '/api/settings', body: { theme: 'dark' } })
    const after = await app.inject({ method: 'GET', url: '/api/settings' })
    expect(after.json().settings.theme).toBe('dark')
    expect(after.json().settings.focus_duration_sec).toBe('1500')
  })
})

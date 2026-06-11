import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { openDb } from '../../server/src/db/index.js'
import { buildApp } from '../../server/src/app.js'

// Integration test: the CLI's api wrapper against a real server instance.
// Regression guard for `todo rm`, which broke because the wrapper sent a
// Content-Type header on bodyless DELETE requests.

let app
let api

beforeAll(async () => {
  app = buildApp({ db: openDb(':memory:') })
  await app.listen({ host: '127.0.0.1', port: 0 })
  // api.js reads TODOO_PORT at import time, so set it before importing
  process.env.TODOO_PORT = String(app.server.address().port)
  ;({ api } = await import('../src/api.js'))
})

afterAll(async () => {
  await app.close()
})

describe('cli api wrapper', () => {
  it('GET works', async () => {
    const { ok } = await api.get('/api/health')
    expect(ok).toBe(true)
  })

  it('POST sends a JSON body', async () => {
    const { task } = await api.post('/api/tasks', { title: 'from cli' })
    expect(task.title).toBe('from cli')
  })

  it('PATCH sends a JSON body', async () => {
    const { task: created } = await api.post('/api/tasks', { title: 'patch me' })
    const { task } = await api.patch(`/api/tasks/${created.id}`, { status: 'done' })
    expect(task.status).toBe('done')
    expect(task.completed_at).toBeTruthy()
  })

  it('DELETE works without a body (todo rm regression)', async () => {
    const { task: created } = await api.post('/api/tasks', { title: 'delete me' })
    const { task } = await api.delete(`/api/tasks/${created.id}`)
    expect(task.deleted_at).toBeTruthy()
  })

  it('bodyless POST works (restore)', async () => {
    const { task: created } = await api.post('/api/tasks', { title: 'restore me' })
    await api.delete(`/api/tasks/${created.id}`)
    const { task } = await api.post(`/api/tasks/${created.id}/restore`)
    expect(task.deleted_at).toBeNull()
  })

  it('surfaces server errors with status and code', async () => {
    await expect(api.get('/api/tasks/99999')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })
})

import { taskById, nextSortOrder, notFound } from '../db/queries.js'

const taskBodyProps = {
  title: { type: 'string', minLength: 1, maxLength: 500 },
  notes: { type: 'string', maxLength: 10000 },
  due_at: { type: ['string', 'null'] },
  priority: { type: 'integer', minimum: 0, maximum: 3 },
  status: { enum: ['todo', 'in_progress', 'done'] },
}

export default async function tasksRoutes(app) {
  const { db } = app

  app.get('/api/tasks', async (req) => {
    const { status, due_after, due_before, q, deleted } = req.query
    const clauses = [deleted === 'true' ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL']
    const params = []
    if (status) {
      const list = String(status).split(',')
      clauses.push(`status IN (${list.map(() => '?').join(',')})`)
      params.push(...list)
    }
    if (due_after) {
      clauses.push('due_at >= ?')
      params.push(due_after)
    }
    if (due_before) {
      clauses.push('due_at < ?')
      params.push(due_before)
    }
    if (q) {
      clauses.push('(title LIKE ? OR notes LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }
    const tasks = db
      .prepare(`SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY sort_order ASC`)
      .all(...params)
    return { tasks }
  })

  app.post(
    '/api/tasks',
    {
      schema: {
        body: {
          type: 'object',
          required: ['title'],
          properties: taskBodyProps,
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { title, notes = '', due_at = null, priority = 0, status = 'todo' } = req.body
      const now = new Date().toISOString()
      const info = db
        .prepare(
          `INSERT INTO tasks (title, notes, status, due_at, priority, sort_order, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          title.trim(),
          notes,
          status,
          due_at,
          priority,
          nextSortOrder(db, status),
          now,
          status === 'done' ? now : null
        )
      reply.code(201)
      return { task: taskById(db, info.lastInsertRowid) }
    }
  )

  app.get('/api/tasks/:id', async (req, reply) => {
    const task = taskById(db, req.params.id)
    if (!task) return notFound(reply)
    return { task }
  })

  app.patch(
    '/api/tasks/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: { ...taskBodyProps, sort_order: { type: 'number' } },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const task = taskById(db, req.params.id)
      if (!task || task.deleted_at) return notFound(reply)

      const updates = {}
      for (const key of ['title', 'notes', 'due_at', 'priority', 'sort_order']) {
        if (key in req.body) updates[key] = req.body[key]
      }
      if (typeof updates.title === 'string') updates.title = updates.title.trim()
      if ('status' in req.body && req.body.status !== task.status) {
        updates.status = req.body.status
        updates.completed_at = req.body.status === 'done' ? new Date().toISOString() : null
        if (!('sort_order' in req.body)) updates.sort_order = nextSortOrder(db, req.body.status)
      }
      if (Object.keys(updates).length === 0) return { task }

      const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ')
      db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...Object.values(updates), task.id)
      return { task: taskById(db, task.id) }
    }
  )

  app.delete('/api/tasks/:id', async (req, reply) => {
    const task = taskById(db, req.params.id)
    if (!task || task.deleted_at) return notFound(reply)
    db.prepare('UPDATE tasks SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), task.id)
    return { task: taskById(db, task.id) }
  })

  app.post('/api/tasks/:id/restore', async (req, reply) => {
    const task = taskById(db, req.params.id)
    if (!task || !task.deleted_at) return notFound(reply, 'No deleted task with that id')
    db.prepare('UPDATE tasks SET deleted_at = NULL WHERE id = ?').run(task.id)
    return { task: taskById(db, task.id) }
  })
}

export function taskById(db, id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) ?? null
}

// Bottom of a status column. Fractional values from drag & drop live between integers,
// so MAX + 1 always lands strictly below everything visible.
export function nextSortOrder(db, status) {
  const row = db
    .prepare('SELECT MAX(sort_order) AS m FROM tasks WHERE status = ? AND deleted_at IS NULL')
    .get(status)
  return (row?.m ?? 0) + 1
}

export function notFound(reply, message = 'Not found') {
  return reply.code(404).send({ error: { code: 'NOT_FOUND', message } })
}

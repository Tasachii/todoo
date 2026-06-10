export default async function statsRoutes(app) {
  const { db } = app

  app.get(
    '/api/stats',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['from', 'to'],
          properties: { from: { type: 'string' }, to: { type: 'string' } },
        },
      },
    },
    async (req) => {
      const { from, to } = req.query
      const focus = db
        .prepare(
          `SELECT COALESCE(SUM(duration_sec), 0) AS focus_sec, COUNT(*) AS focus_sessions
           FROM focus_sessions
           WHERE ended_at IS NOT NULL AND started_at >= ? AND started_at < ?`
        )
        .get(from, to)
      const tasks = db
        .prepare(
          `SELECT COUNT(*) AS c FROM tasks
           WHERE deleted_at IS NULL AND completed_at >= ? AND completed_at < ?`
        )
        .get(from, to)
      return {
        focus_sec: focus.focus_sec,
        focus_sessions: focus.focus_sessions,
        tasks_completed: tasks.c,
      }
    }
  )
}

const DEFAULTS = {
  theme: 'auto',
  focus_style: 'timer', // 'timer' | 'pomodoro'
  focus_duration_sec: '1500',
  break_duration_sec: '300',
  pomodoro_work_sec: '1500',
  pomodoro_break_sec: '300',
  pomodoro_long_break_sec: '900',
  pomodoro_rounds: '4',
}

function allSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  return { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }
}

export default async function settingsRoutes(app) {
  const { db } = app

  app.get('/api/settings', async () => ({ settings: allSettings(db) }))

  app.put(
    '/api/settings',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: { anyOf: [{ type: 'string' }, { type: 'number' }] },
        },
      },
    },
    async (req) => {
      const upsert = db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      for (const [key, value] of Object.entries(req.body)) {
        upsert.run(key, String(value))
      }
      return { settings: allSettings(db) }
    }
  )
}

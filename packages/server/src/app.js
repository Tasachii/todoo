import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tasksRoutes from './routes/tasks.js'
import focusRoutes from './routes/focus.js'
import statsRoutes from './routes/stats.js'
import settingsRoutes from './routes/settings.js'

export const VERSION = '0.1.0'

export function buildApp({ db, logger = false } = {}) {
  const app = Fastify({ logger })
  app.decorate('db', db)

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: err.message } })
    }
    req.log.error(err)
    reply
      .code(err.statusCode && err.statusCode >= 400 ? err.statusCode : 500)
      .send({ error: { code: 'INTERNAL', message: err.message } })
  })

  app.get('/api/health', async () => ({ ok: true, version: VERSION }))

  app.register(tasksRoutes)
  app.register(focusRoutes)
  app.register(statsRoutes)
  app.register(settingsRoutes)

  const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url))
  const hasWebBuild = existsSync(webDist)
  if (hasWebBuild) {
    app.register(fastifyStatic, { root: webDist })
  }
  app.setNotFoundHandler((req, reply) => {
    if (!req.url.startsWith('/api/') && hasWebBuild) {
      return reply.sendFile('index.html') // SPA fallback for client-side routes
    }
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } })
  })

  return app
}

import { openDb, defaultDbPath } from './db/index.js'
import { buildApp } from './app.js'

const host = process.env.TODOO_HOST || '127.0.0.1'
const port = Number(process.env.TODOO_PORT || 4521)

const db = openDb()
const app = buildApp({ db })

try {
  await app.listen({ host, port })
  console.log(`todoo server → http://${host}:${port}  (db: ${defaultDbPath()})`)
  if (host !== '127.0.0.1') {
    console.log('⚠️  LAN mode: anyone on this network can read/write your tasks.')
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

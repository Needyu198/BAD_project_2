import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL or POSTGRES_URL is not set.')
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })

try {
  for (const name of ['001_initial_schema', '002_queue']) {
    const migrationUrl = new URL(`../migrations/${name}.sql`, import.meta.url)
    const migrationSql = await readFile(fileURLToPath(migrationUrl), 'utf8')
    await pool.query(migrationSql)
    console.log(`Applied migration ${name}.`)
  }
} finally {
  await pool.end()
}

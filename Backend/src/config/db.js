import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
})

export async function connectDatabase() {
  const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

  if (!postgresUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL is not set in environment variables')
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_records (
      model_name TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (model_name, id)
    )
  `)
  console.log('PostgreSQL connected')
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import pg from 'pg'

// Explicit test connection only: never loads the application's .env.
test('queue REST lifecycle, validation, ownership, and concurrent mutations', { skip: !process.env.QUEUE_TEST_DATABASE_URL }, async () => {
  const schema = `queue_test_${process.pid}_${Date.now()}`
  const admin = new pg.Pool({ connectionString: process.env.QUEUE_TEST_DATABASE_URL })
  let pool
  let server
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    const url = new URL(process.env.QUEUE_TEST_DATABASE_URL)
    url.searchParams.set('options', `-c search_path=${schema},public`)
    process.env.DATABASE_URL = url.toString()
    ;({ pool } = await import('../src/config/db.js'))
    for (const migration of ['001_initial_schema', '002_queue', '002_queue']) {
      await pool.query(await readFile(new URL(`../migrations/${migration}.sql`, import.meta.url), 'utf8'))
    }
    await pool.query(`INSERT INTO users (id, name, email, password_hash, role) VALUES
      ('owner', 'Owner', 'queue-owner@example.test', 'test-only', 'pet-owner'),
      ('other', 'Other', 'queue-other@example.test', 'test-only', 'pet-owner'),
      ('staff', 'Staff', 'queue-staff@example.test', 'test-only', 'staff')`)
    for (let i = 1; i <= 8; i++) {
      await pool.query(`INSERT INTO pets (id, owner_id, name, breed, age, weight, vaccination_status)
        VALUES ($1, 'owner', $1, 'Cat', '2', '4', 'Current')`, [`pet${i}`])
    }
    const { default: express } = await import('express')
    const { queueRouter } = await import('../src/routes/queueRoutes.js')
    const app = express()
    app.use(express.json())
    app.use('/api/queue', queueRouter)
    app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.message }))
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
    const base = `http://127.0.0.1:${server.address().port}/api/queue`
    async function api(path = '', method = 'GET', userId = 'owner', body) {
      const response = await fetch(`${base}${path}?userId=${userId}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      })
      return { status: response.status, ...await response.json() }
    }
    const checkIn = (petId) => api('/check-in', 'POST', 'owner', { petId })
    assert.equal((await api('/check-in', 'POST', 'owner', {})).status, 400)
    assert.equal((await api('/check-in', 'POST', 'other', { petId: 'pet1' })).status, 404)
    const first = await checkIn('pet1')
    const second = await checkIn('pet2')
    assert.equal(first.status, 201)
    assert.equal(first.entry.queueNumber, 'A001')
    assert.equal(second.entry.queueNumber, 'A002')
    assert.equal(second.entry.patientsAhead, 1)
    assert.equal((await checkIn('pet1')).status, 409)
    assert.equal((await api('/next', 'POST')).status, 403)
    assert.equal((await api(`/${first.entry.id}`, 'GET', 'other')).status, 404)
    assert.equal((await api('/next', 'POST', 'staff')).entry.id, first.entry.id)
    assert.equal((await api(`/${first.entry.id}/cancel`, 'PATCH')).status, 409)
    assert.equal((await api(`/${second.entry.id}`)).entry.patientsAhead, 0)
    assert.equal((await api('/next', 'POST', 'staff')).entry.id, second.entry.id)
    const completed = (await api(`/${first.entry.id}`)).entry
    assert.equal(completed.status, 'COMPLETED')
    assert.ok(completed.calledAt)
    assert.ok(completed.completedAt)
    assert.equal((await api(`/${second.entry.id}`)).entry.status, 'SERVING')
    assert.equal((await api('/current')).current.queueNumber, 'A002')
    const third = await checkIn('pet3')
    await checkIn('pet4')
    const fifth = await checkIn('pet5')
    assert.equal(fifth.entry.patientsAhead, 2)
    assert.equal((await api(`/${third.entry.id}/cancel`, 'PATCH', 'other')).status, 404)
    assert.equal((await api(`/${third.entry.id}/cancel`, 'PATCH')).entry.status, 'CANCELLED')
    assert.equal((await api(`/${fifth.entry.id}`)).entry.patientsAhead, 1)
    assert.equal((await api(`/${third.entry.id}/cancel`, 'PATCH')).status, 409)
    const concurrent = await Promise.all([checkIn('pet6'), checkIn('pet6')])
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409])
    const calls = await Promise.all([api('/next', 'POST', 'staff'), api('/next', 'POST', 'staff')])
    assert.ok(calls.every((r) => r.status === 200))
    let snapshot = await api('', 'GET', 'staff')
    assert.equal(snapshot.queue.filter((q) => q.status === 'SERVING').length, 1)
    assert.equal(snapshot.current.queueNumber, 'A005')
    assert.equal((await api()).current.ownerName, undefined)
    // Direct writes cannot bypass the single-serving database invariant.
    await assert.rejects(pool.query("UPDATE queue_entries SET status = 'SERVING' WHERE id = $1", [first.entry.id]), { code: '23505' })
    await api('/next', 'POST', 'staff')
    assert.equal((await api('/next', 'POST', 'staff')).message, 'No patients waiting')
    snapshot = await api('', 'GET', 'staff')
    assert.equal(snapshot.current, null)
    assert.equal((await api('/next', 'POST', 'staff')).message, 'No patients waiting')
    const recheck = await checkIn('pet1')
    assert.equal(recheck.status, 201)
    assert.notEqual(recheck.entry.id, first.entry.id)
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    if (pool) await pool.end()
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
    await admin.end()
  }
})

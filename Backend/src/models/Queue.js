import { pool } from '../config/db.js'

// Local timezone that defines when the queue "day" rolls over. Queue numbers
// restart at A001 at local midnight in this zone. Defaults to the clinic's
// deployment region (Korea) but is overridable via QUEUE_TIMEZONE.
const QUEUE_TIMEZONE = process.env.QUEUE_TIMEZONE || 'Asia/Seoul'

// The local calendar date of an entry's creation timestamp. Two entries share a
// "queue day" when this expression matches, which is what makes numbering reset.
const localDay = `(q.created_at AT TIME ZONE '${QUEUE_TIMEZONE}')::date`
const localToday = `(clock_timestamp() AT TIME ZONE '${QUEUE_TIMEZONE}')::date`

// All queue mutations share a transaction lock, including check-in ordering.
// The partial unique index also enforces one SERVING row at database level.
async function mutate(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(72419021)')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function fail(status, message) {
  throw Object.assign(new Error(message), { status })
}

// queueNumber is a per-day rank: entries are numbered A001, A002, ... within
// their own local calendar day (ordered by ticket_number), so each new day the
// count starts over at A001. ticket_number remains the global, monotonic tie
// breaker and history key. patientsAhead only counts WAITING entries from the
// same day that are earlier in line.
const selectQueue = `
  SELECT q.ticket_number AS "_order",
    ${localDay} AS "_day",
    q.id,
    'A' || LPAD(
      ROW_NUMBER() OVER (PARTITION BY ${localDay} ORDER BY q.ticket_number)::text,
      3, '0'
    ) AS "queueNumber",
    q.owner_id AS "ownerId", q.pet_id AS "petId",
    COALESCE(u.name, 'Deleted owner') AS "ownerName", COALESCE(p.name, 'Deleted pet') AS "petName",
    q.status, q.created_at AS "createdAt", q.called_at AS "calledAt", q.completed_at AS "completedAt",
    CASE WHEN q.status = 'WAITING' THEN
      (SELECT COUNT(*)::int FROM queue_entries ahead
       WHERE ahead.status = 'WAITING'
         AND ahead.ticket_number < q.ticket_number
         AND (ahead.created_at AT TIME ZONE '${QUEUE_TIMEZONE}')::date = ${localDay})
      ELSE 0 END AS "patientsAhead"
  FROM queue_entries q
  LEFT JOIN users u ON u.id = q.owner_id
  LEFT JOIN pets p ON p.id = q.pet_id`

export const Queue = {
  async snapshot(ownerId = null, id = null) {
    // One SQL statement keeps current, queue statuses, and counts consistent.
    // The serving entry is only surfaced as "current" when it belongs to today,
    // so a stale SERVING row from a previous day never shows on the new day.
    const { rows } = await pool.query(`
      WITH entries AS (${selectQueue})
      SELECT COALESCE((SELECT json_agg(to_jsonb(e) - '_order' - '_day' ORDER BY e."_order") FROM entries e
        WHERE ($1::text IS NULL OR e."ownerId" = $1)
          AND ($2::text IS NULL OR e.id = $2)), '[]'::json) AS queue,
        (SELECT to_jsonb(e) - '_order' - '_day' FROM entries e
          WHERE e.status = 'SERVING' AND e."_day" = ${localToday}) AS current`, [ownerId, id])
    return rows[0]
  },

  checkIn(ownerId, petId) {
    return mutate(async (client) => {
      const pet = await client.query('SELECT id FROM pets WHERE id = $1 AND owner_id = $2 FOR SHARE', [petId, ownerId])
      if (!pet.rowCount) fail(404, 'Pet not found for this owner.')
      const existing = await client.query("SELECT id FROM queue_entries WHERE pet_id = $1 AND status IN ('WAITING', 'SERVING')", [petId])
      if (existing.rowCount) fail(409, 'This pet already has an active queue entry.')
      const { rows } = await client.query('INSERT INTO queue_entries (owner_id, pet_id) VALUES ($1, $2) RETURNING id', [ownerId, petId])
      return rows[0].id
    })
  },

  next() {
    return mutate(async (client) => {
      // Complete the patient currently being served (any day) so the single
      // SERVING slot is freed, then call the next WAITING patient from today
      // only. Uncalled WAITING entries left over from a previous day are not
      // pulled into the new day.
      await client.query("UPDATE queue_entries SET status = 'COMPLETED', completed_at = clock_timestamp() WHERE status = 'SERVING'")
      const { rows } = await client.query(`UPDATE queue_entries SET status = 'SERVING', called_at = clock_timestamp()
        WHERE id = (
          SELECT id FROM queue_entries
          WHERE status = 'WAITING'
            AND (created_at AT TIME ZONE '${QUEUE_TIMEZONE}')::date = ${localToday}
          ORDER BY ticket_number LIMIT 1)
        RETURNING id`)
      return rows[0]?.id || null
    })
  },

  cancel(id, ownerId = null) {
    return mutate(async (client) => {
      const { rows } = await client.query('SELECT status FROM queue_entries WHERE id = $1 AND ($2::text IS NULL OR owner_id = $2)', [id, ownerId])
      if (!rows.length) fail(404, 'Queue entry not found.')
      if (rows[0].status !== 'WAITING') fail(409, 'Only WAITING patients can cancel.')
      await client.query("UPDATE queue_entries SET status = 'CANCELLED' WHERE id = $1", [id])
      return id
    })
  },
}

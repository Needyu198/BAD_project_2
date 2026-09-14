BEGIN;

CREATE TABLE IF NOT EXISTS queue_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  ticket_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  pet_id TEXT REFERENCES pets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING', 'SERVING', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS queue_one_serving
  ON queue_entries ((1)) WHERE status = 'SERVING';
CREATE UNIQUE INDEX IF NOT EXISTS queue_one_active_per_pet
  ON queue_entries (pet_id) WHERE status IN ('WAITING', 'SERVING');
CREATE INDEX IF NOT EXISTS queue_waiting_order
  ON queue_entries (ticket_number) WHERE status = 'WAITING';
CREATE INDEX IF NOT EXISTS queue_owner ON queue_entries (owner_id, ticket_number);

INSERT INTO schema_migrations (version) VALUES ('002_queue') ON CONFLICT DO NOTHING;
COMMIT;

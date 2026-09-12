BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  email TEXT NOT NULL UNIQUE CHECK (email = LOWER(BTRIM(email))),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'pet-owner'
    CHECK (role IN ('pet-owner', 'doctor', 'staff')),
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  preferred_contact TEXT NOT NULL DEFAULT 'Email'
    CHECK (preferred_contact IN ('Email', 'Phone', 'SMS')),
  notification_preferences JSONB NOT NULL DEFAULT '{
    "appointmentReminders": true,
    "vaccinationReminders": true,
    "medicalRecordUpdates": true,
    "promotionalUpdates": false,
    "appointmentRequestAlerts": true,
    "paymentConfirmationAlerts": true,
    "doctorScheduleChanges": true,
    "weeklyPerformanceSummary": false
  }'::JSONB,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  working_days TEXT NOT NULL DEFAULT '',
  working_hours TEXT NOT NULL DEFAULT '',
  break_time TEXT NOT NULL DEFAULT '',
  profile_photo TEXT NOT NULL DEFAULT '',
  password_reset_token_hash TEXT,
  password_reset_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  breed TEXT NOT NULL CHECK (BTRIM(breed) <> ''),
  age TEXT NOT NULL CHECK (BTRIM(age) <> ''),
  weight TEXT NOT NULL CHECK (BTRIM(weight) <> ''),
  vaccination_status TEXT NOT NULL CHECK (BTRIM(vaccination_status) <> ''),
  pet_photo TEXT NOT NULL DEFAULT '',
  last_prescription_summary TEXT NOT NULL DEFAULT '',
  last_prescription_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  pet_name TEXT NOT NULL CHECK (BTRIM(pet_name) <> ''),
  doctor_name TEXT NOT NULL CHECK (BTRIM(doctor_name) <> ''),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  reason TEXT NOT NULL CHECK (BTRIM(reason) <> ''),
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id TEXT,
  doctor_name TEXT NOT NULL CHECK (BTRIM(doctor_name) <> ''),
  owner_name TEXT NOT NULL DEFAULT '',
  pet_name TEXT NOT NULL CHECK (BTRIM(pet_name) <> ''),
  appointment_date DATE,
  appointment_time TIME,
  symptoms TEXT NOT NULL DEFAULT '',
  temperature TEXT NOT NULL DEFAULT '',
  weight TEXT NOT NULL DEFAULT '',
  heart_rate TEXT NOT NULL DEFAULT '',
  respiratory_rate TEXT NOT NULL DEFAULT '',
  clinical_findings TEXT NOT NULL DEFAULT '',
  diagnosis TEXT NOT NULL CHECK (BTRIM(diagnosis) <> ''),
  treatment_plan TEXT NOT NULL CHECK (BTRIM(treatment_plan) <> ''),
  prescription TEXT NOT NULL CHECK (BTRIM(prescription) <> ''),
  follow_up_date DATE,
  outcome TEXT NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  pet_name TEXT NOT NULL CHECK (BTRIM(pet_name) <> ''),
  owner_name TEXT NOT NULL DEFAULT '',
  doctor_id TEXT,
  doctor_name TEXT NOT NULL CHECK (BTRIM(doctor_name) <> ''),
  medicine TEXT NOT NULL CHECK (BTRIM(medicine) <> ''),
  dosage TEXT NOT NULL CHECK (BTRIM(dosage) <> ''),
  duration TEXT NOT NULL CHECK (BTRIM(duration) <> ''),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  pet_name TEXT NOT NULL CHECK (BTRIM(pet_name) <> ''),
  owner_name TEXT NOT NULL DEFAULT '',
  doctor_id TEXT,
  doctor_name TEXT NOT NULL CHECK (BTRIM(doctor_name) <> ''),
  diagnosis TEXT NOT NULL CHECK (BTRIM(diagnosis) <> ''),
  prescription TEXT NOT NULL CHECK (BTRIM(prescription) <> ''),
  vaccine TEXT NOT NULL DEFAULT '',
  next_due_date DATE,
  lab_result TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vaccinations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  vaccine_id TEXT NOT NULL UNIQUE CHECK (BTRIM(vaccine_id) <> ''),
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL CHECK (BTRIM(vaccine_name) <> ''),
  date_given DATE NOT NULL,
  next_due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (next_due_date >= date_given)
);

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  doctor_id TEXT NOT NULL UNIQUE,
  doctor_name TEXT NOT NULL DEFAULT '',
  monday_friday TEXT NOT NULL DEFAULT '09:00 AM - 05:00 PM',
  saturday TEXT NOT NULL DEFAULT '10:00 AM - 02:00 PM',
  sunday TEXT NOT NULL DEFAULT 'Closed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_available_slots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  schedule_id TEXT NOT NULL REFERENCES doctor_schedules(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (slot_type IN ('regular', 'emergency')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time),
  UNIQUE (schedule_id, slot_date, start_time, end_time, slot_type)
);

CREATE TABLE IF NOT EXISTS doctor_blocked_slots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  schedule_id TEXT NOT NULL REFERENCES doctor_schedules(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time),
  UNIQUE (schedule_id, slot_date, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS billing_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  invoice_id TEXT NOT NULL UNIQUE CHECK (BTRIM(invoice_id) <> ''),
  invoice_number TEXT NOT NULL DEFAULT '',
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  owner_name TEXT NOT NULL CHECK (BTRIM(owner_name) <> ''),
  pet_name TEXT NOT NULL CHECK (BTRIM(pet_name) <> ''),
  doctor_name TEXT NOT NULL CHECK (BTRIM(doctor_name) <> ''),
  consultation_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (consultation_fee >= 0),
  service_charges NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_charges >= 0),
  medicine_charges NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (medicine_charges >= 0),
  lab_charges NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (lab_charges >= 0),
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance_due >= 0),
  payment_method TEXT NOT NULL DEFAULT '',
  payment_date DATE,
  reference_number TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL DEFAULT 'Unpaid'
    CHECK (payment_status IN ('Paid', 'Partial', 'Unpaid', 'Pending', 'Failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (amount_paid <= total_amount)
);

CREATE TABLE IF NOT EXISTS report_analytics_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  range_name TEXT NOT NULL DEFAULT 'this-month',
  from_date DATE,
  to_date DATE,
  doctor_name TEXT NOT NULL DEFAULT 'All',
  report_type TEXT NOT NULL DEFAULT 'Financial + Operational',
  metrics JSONB NOT NULL DEFAULT '[]'::JSONB,
  trend_rows JSONB NOT NULL DEFAULT '[]'::JSONB,
  insights JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_date IS NULL OR to_date IS NULL OR from_date <= to_date)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  action TEXT NOT NULL CHECK (BTRIM(action) <> ''),
  category TEXT NOT NULL CHECK (BTRIM(category) <> ''),
  description TEXT NOT NULL DEFAULT '',
  actor_id TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT 'Unknown User',
  actor_role TEXT NOT NULL DEFAULT 'unknown',
  entity_type TEXT NOT NULL CHECK (BTRIM(entity_type) <> ''),
  entity_id TEXT NOT NULL DEFAULT '',
  entity_label TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_slot_unique
  ON appointments (LOWER(doctor_name), appointment_date, appointment_time)
  WHERE status IN ('Pending', 'Confirmed');
CREATE INDEX IF NOT EXISTS appointments_owner_created_idx
  ON appointments (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS appointments_doctor_date_idx
  ON appointments (LOWER(doctor_name), appointment_date);
CREATE INDEX IF NOT EXISTS pets_owner_created_idx
  ON pets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prescriptions_pet_created_idx
  ON prescriptions (pet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prescriptions_doctor_created_idx
  ON prescriptions (LOWER(doctor_name), created_at DESC);
CREATE INDEX IF NOT EXISTS medical_records_pet_created_idx
  ON medical_records (pet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS medical_records_doctor_created_idx
  ON medical_records (LOWER(doctor_name), created_at DESC);
CREATE INDEX IF NOT EXISTS vaccinations_pet_due_idx
  ON vaccinations (pet_id, next_due_date);
CREATE INDEX IF NOT EXISTS billing_status_created_idx
  ON billing_records (payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_category_created_idx
  ON activity_logs (category, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_actor_role_created_idx
  ON activity_logs (actor_role, created_at DESC);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'pets', 'appointments', 'consultations', 'prescriptions',
    'medical_records', 'vaccinations', 'doctor_schedules', 'billing_records',
    'report_analytics_snapshots'
  ]
  LOOP
    EXECUTE FORMAT('DROP TRIGGER IF EXISTS %I ON %I', 'set_' || table_name || '_updated_at', table_name);
    EXECUTE FORMAT(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  END LOOP;
END;
$$;

INSERT INTO schema_migrations (version)
VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;

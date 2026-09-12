import 'dotenv/config'
import { pool } from '../src/config/db.js'
import { User } from '../src/models/User.js'
import { Pet } from '../src/models/Pet.js'
import { Appointment } from '../src/models/Appointment.js'
import { Consultation } from '../src/models/Consultation.js'
import { Prescription } from '../src/models/Prescription.js'
import { MedicalRecord } from '../src/models/MedicalRecord.js'
import { Vaccination } from '../src/models/Vaccination.js'
import { DoctorSchedule } from '../src/models/DoctorSchedule.js'
import { BillingRecord } from '../src/models/BillingRecord.js'
import { ReportAnalyticsSnapshot } from '../src/models/ReportAnalyticsSnapshot.js'
import { ActivityLog } from '../src/models/ActivityLog.js'

const models = new Map([
  ['users', User],
  ['pets', Pet],
  ['appointments', Appointment],
  ['consultations', Consultation],
  ['prescriptions', Prescription],
  ['medical_records', MedicalRecord],
  ['vaccinations', Vaccination],
  ['doctor_schedules', DoctorSchedule],
  ['billing_records', BillingRecord],
  ['report_analytics_snapshots', ReportAnalyticsSnapshot],
  ['activity_logs', ActivityLog],
])

let migrated = 0
let skipped = 0

try {
  const legacyTable = await pool.query("SELECT to_regclass('public.app_records') AS name")
  if (!legacyTable.rows[0].name) {
    console.log('No app_records table exists; nothing to migrate.')
  } else {
    const { rows } = await pool.query(`
      SELECT model_name, id, data
      FROM app_records
      ORDER BY CASE model_name
        WHEN 'users' THEN 1
        WHEN 'pets' THEN 2
        WHEN 'appointments' THEN 3
        ELSE 4
      END, created_at
    `)

    for (const row of rows) {
      const Model = models.get(row.model_name)
      if (!Model) {
        console.warn(`Skipping unsupported legacy model ${row.model_name}:${row.id}`)
        skipped += 1
        continue
      }
      if (await Model.findById(row.id)) {
        skipped += 1
        continue
      }
      await Model.create({ ...row.data, id: row.id })
      migrated += 1
    }

    console.log(`Migrated ${migrated} records; skipped ${skipped}.`)
  }
} finally {
  await pool.end()
}

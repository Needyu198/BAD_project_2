import { randomUUID } from 'node:crypto'
import { pool } from '../config/db.js'

const MODEL_CONFIGS = {
  users: {
    table: 'users',
    fields: {
      name: 'name', email: 'email', passwordHash: 'password_hash', role: 'role', phone: 'phone',
      address: 'address', preferredContact: 'preferred_contact', notificationPreferences: 'notification_preferences',
      twoFactorEnabled: 'two_factor_enabled', workingDays: 'working_days', workingHours: 'working_hours',
      breakTime: 'break_time', profilePhoto: 'profile_photo', passwordResetToken: 'password_reset_token_hash',
      passwordResetExpiresAt: 'password_reset_expires_at',
    },
    jsonFields: ['notificationPreferences'],
  },
  pets: {
    table: 'pets',
    fields: {
      ownerId: 'owner_id', ownerName: 'owner_name', name: 'name', breed: 'breed', age: 'age', weight: 'weight',
      vaccinationStatus: 'vaccination_status', petPhoto: 'pet_photo',
      lastPrescriptionSummary: 'last_prescription_summary', lastPrescriptionAt: 'last_prescription_at',
    },
  },
  appointments: {
    table: 'appointments',
    fields: {
      ownerId: 'owner_id', ownerName: 'owner_name', petName: 'pet_name', doctorName: 'doctor_name',
      appointmentDate: 'appointment_date', appointmentTime: 'appointment_time', reason: 'reason', status: 'status',
    },
    nullIfEmpty: ['ownerId'],
  },
  consultations: {
    table: 'consultations',
    fields: {
      appointmentId: 'appointment_id', doctorId: 'doctor_id', doctorName: 'doctor_name', ownerName: 'owner_name',
      petName: 'pet_name', appointmentDate: 'appointment_date', appointmentTime: 'appointment_time',
      symptoms: 'symptoms', temperature: 'temperature', weight: 'weight', heartRate: 'heart_rate',
      respiratoryRate: 'respiratory_rate', clinicalFindings: 'clinical_findings', diagnosis: 'diagnosis',
      treatmentPlan: 'treatment_plan', prescription: 'prescription', followUpDate: 'follow_up_date', outcome: 'outcome',
    },
    nullIfEmpty: ['doctorId', 'appointmentDate', 'appointmentTime', 'followUpDate'],
  },
  prescriptions: {
    table: 'prescriptions',
    fields: {
      petId: 'pet_id', petName: 'pet_name', ownerName: 'owner_name', doctorId: 'doctor_id',
      doctorName: 'doctor_name', medicine: 'medicine', dosage: 'dosage', duration: 'duration', notes: 'notes',
    },
    nullIfEmpty: ['doctorId'],
  },
  medical_records: {
    table: 'medical_records',
    fields: {
      petId: 'pet_id', petName: 'pet_name', ownerName: 'owner_name', doctorId: 'doctor_id',
      doctorName: 'doctor_name', diagnosis: 'diagnosis', prescription: 'prescription', vaccine: 'vaccine',
      nextDueDate: 'next_due_date', labResult: 'lab_result', notes: 'notes', recordDate: 'record_date',
    },
    nullIfEmpty: ['doctorId', 'nextDueDate'],
  },
  vaccinations: {
    table: 'vaccinations',
    fields: { vaccineId: 'vaccine_id', petId: 'pet_id', vaccineName: 'vaccine_name', dateGiven: 'date_given', nextDueDate: 'next_due_date' },
  },
  doctor_schedules: {
    table: 'doctor_schedules', fields: { doctorId: 'doctor_id', doctorName: 'doctor_name' }, schedule: true,
  },
  billing_records: {
    table: 'billing_records',
    fields: {
      invoiceId: 'invoice_id', invoiceNumber: 'invoice_number', appointmentId: 'appointment_id',
      ownerName: 'owner_name', petName: 'pet_name', doctorName: 'doctor_name', consultationFee: 'consultation_fee',
      serviceCharges: 'service_charges', medicineCharges: 'medicine_charges', labCharges: 'lab_charges',
      taxAmount: 'tax_amount', discountAmount: 'discount_amount', subTotal: 'subtotal', totalAmount: 'total_amount',
      amountPaid: 'amount_paid', balanceDue: 'balance_due', paymentMethod: 'payment_method', paymentDate: 'payment_date',
      referenceNumber: 'reference_number', paymentStatus: 'payment_status',
    },
    nullIfEmpty: ['appointmentId', 'paymentDate'],
  },
  report_analytics_snapshots: {
    table: 'report_analytics_snapshots',
    fields: {
      range: 'range_name', fromDate: 'from_date', toDate: 'to_date', doctorName: 'doctor_name',
      reportType: 'report_type', metrics: 'metrics', trendRows: 'trend_rows', insights: 'insights',
    },
    nullIfEmpty: ['fromDate', 'toDate'],
    jsonFields: ['metrics', 'trendRows', 'insights'],
  },
  activity_logs: {
    table: 'activity_logs',
    fields: {
      action: 'action', category: 'category', description: 'description', actorId: 'actor_id', actorName: 'actor_name',
      actorRole: 'actor_role', entityType: 'entity_type', entityId: 'entity_id', entityLabel: 'entity_label', metadata: 'metadata',
    },
    activityLog: true,
    jsonFields: ['metadata'],
  },
}

function readPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value)
}

function matchesCondition(value, condition) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return value === condition
  return Object.entries(condition).every(([operator, expected]) => {
    if (operator === '$in') return expected.includes(value)
    if (operator === '$ne') return value !== expected
    if (operator === '$gte') return value >= expected
    if (operator === '$lte') return value <= expected
    if (operator === '$gt') return value > expected
    if (operator === '$lt') return value < expected
    return value === condition
  })
}

function matches(document, query = {}) {
  return Object.entries(query).every(([key, condition]) => {
    if (key === '$and') return condition.every((item) => matches(document, item))
    if (key === '$or') return condition.some((item) => matches(document, item))
    return matchesCondition(readPath(document, key), condition)
  })
}

function normalizeTime(value) {
  const text = String(value || '')
  return /^\d{2}:\d{2}:\d{2}/.test(text) ? text.slice(0, 5) : text
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-')
  }
  const text = String(value || '')
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text
}

class PostgresQuery {
  constructor(executor, single = false) {
    this.executor = executor
    this.single = single
    this.sortSpec = null
    this.limitValue = null
  }
  sort(spec) { this.sortSpec = spec; return this }
  limit(value) { this.limitValue = value; return this }
  lean() { return this }
  then(resolve, reject) { return this.execute().then(resolve, reject) }
  async execute() {
    let result = await this.executor()
    if (this.single) return result || null
    if (!Array.isArray(result)) result = result ? [result] : []
    if (this.sortSpec) {
      const entries = Object.entries(this.sortSpec)
      result.sort((left, right) => {
        for (const [field, direction] of entries) {
          const leftValue = readPath(left, field)
          const rightValue = readPath(right, field)
          if (leftValue === rightValue) continue
          return (leftValue > rightValue ? 1 : -1) * direction
        }
        return 0
      })
    }
    return this.limitValue === null ? result : result.slice(0, this.limitValue)
  }
}

export function createPostgresModel(modelName) {
  const config = MODEL_CONFIGS[modelName]
  if (!config) throw new Error(`No PostgreSQL table mapping exists for model: ${modelName}`)

  function rowToDocument(row) {
    if (!row) return null
    const document = { _id: row.id, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at || row.created_at }
    for (const [property, column] of Object.entries(config.fields)) {
      if (property.endsWith('Time')) document[property] = normalizeTime(row[column])
      else if (property.endsWith('Date') || property === 'dateGiven') document[property] = normalizeDate(row[column])
      else document[property] = row[column]
    }
    if (config.activityLog) {
      document.actor = { id: row.actor_id, name: row.actor_name, role: row.actor_role }
      document.entity = { type: row.entity_type, id: row.entity_id, label: row.entity_label }
      for (const key of ['actorId', 'actorName', 'actorRole', 'entityType', 'entityId', 'entityLabel']) delete document[key]
    }
    if (config.schedule) {
      document.clinicHours = { mondayFriday: row.monday_friday, saturday: row.saturday, sunday: row.sunday }
      document.availableSlots = row.available_slots || []
      document.blockedSlots = row.blocked_slots || []
    }
    return Object.assign(new Model(), document)
  }

  function dataToRow(data) {
    const source = { ...data }
    if (config.activityLog) {
      source.actorId = data.actor?.id || ''
      source.actorName = data.actor?.name || 'Unknown User'
      source.actorRole = data.actor?.role || 'unknown'
      source.entityType = data.entity?.type || ''
      source.entityId = data.entity?.id || ''
      source.entityLabel = data.entity?.label || ''
    }
    const row = {}
    for (const [property, column] of Object.entries(config.fields)) {
      if (source[property] !== undefined) {
        if (config.nullIfEmpty?.includes(property) && source[property] === '') row[column] = null
        else if (config.jsonFields?.includes(property)) row[column] = JSON.stringify(source[property])
        else row[column] = source[property]
      }
    }
    if (config.schedule && data.clinicHours) {
      if (data.clinicHours.mondayFriday !== undefined) row.monday_friday = data.clinicHours.mondayFriday
      if (data.clinicHours.saturday !== undefined) row.saturday = data.clinicHours.saturday
      if (data.clinicHours.sunday !== undefined) row.sunday = data.clinicHours.sunday
    }
    return row
  }

  async function attachScheduleSlots(client, rows) {
    if (!config.schedule || rows.length === 0) return rows
    const ids = rows.map((row) => row.id)
    const [available, blocked] = await Promise.all([
      client.query('SELECT * FROM doctor_available_slots WHERE schedule_id = ANY($1::text[]) ORDER BY slot_date, start_time', [ids]),
      client.query('SELECT * FROM doctor_blocked_slots WHERE schedule_id = ANY($1::text[]) ORDER BY slot_date, start_time', [ids]),
    ])
    return rows.map((row) => ({
      ...row,
      available_slots: available.rows.filter((slot) => slot.schedule_id === row.id).map((slot) => ({
        _id: slot.id, date: normalizeDate(slot.slot_date), startTime: normalizeTime(slot.start_time), endTime: normalizeTime(slot.end_time), slotType: slot.slot_type,
      })),
      blocked_slots: blocked.rows.filter((slot) => slot.schedule_id === row.id).map((slot) => ({
        _id: slot.id, date: normalizeDate(slot.slot_date), startTime: normalizeTime(slot.start_time), endTime: normalizeTime(slot.end_time), reason: slot.reason,
      })),
    }))
  }

  async function syncScheduleSlots(client, scheduleId, data) {
    if (!config.schedule) return
    if (Array.isArray(data.availableSlots)) {
      await client.query('DELETE FROM doctor_available_slots WHERE schedule_id = $1', [scheduleId])
      for (const slot of data.availableSlots) {
        await client.query(
          'INSERT INTO doctor_available_slots (id, schedule_id, slot_date, start_time, end_time, slot_type) VALUES ($1, $2, $3, $4, $5, $6)',
          [String(slot._id || slot.id || randomUUID()), scheduleId, slot.date, slot.startTime, slot.endTime, slot.slotType || 'regular']
        )
      }
    }
    if (Array.isArray(data.blockedSlots)) {
      await client.query('DELETE FROM doctor_blocked_slots WHERE schedule_id = $1', [scheduleId])
      for (const slot of data.blockedSlots) {
        await client.query(
          'INSERT INTO doctor_blocked_slots (id, schedule_id, slot_date, start_time, end_time, reason) VALUES ($1, $2, $3, $4, $5, $6)',
          [String(slot._id || slot.id || randomUUID()), scheduleId, slot.date, slot.startTime, slot.endTime, slot.reason || '']
        )
      }
    }
  }

  async function readRecords() {
    const { rows } = await pool.query(`SELECT * FROM ${config.table}`)
    return (await attachScheduleSlots(pool, rows)).map(rowToDocument)
  }

  async function insert(data) {
    const id = String(data._id || data.id || randomUUID())
    const valuesByColumn = dataToRow(data)
    const columns = ['id', ...Object.keys(valuesByColumn)]
    const values = [id, ...Object.values(valuesByColumn)]
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(`INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`, values)
      await syncScheduleSlots(client, id, data)
      const rows = await attachScheduleSlots(client, result.rows)
      await client.query('COMMIT')
      return rowToDocument(rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async function updateById(id, updates) {
    const valuesByColumn = dataToRow(updates)
    const columns = Object.keys(valuesByColumn)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      let row
      if (columns.length) {
        const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(', ')
        const result = await client.query(
          `UPDATE ${config.table} SET ${assignments} WHERE id = $${columns.length + 1} RETURNING *`,
          [...Object.values(valuesByColumn), String(id)]
        )
        row = result.rows[0]
      } else {
        const result = await client.query(`SELECT * FROM ${config.table} WHERE id = $1`, [String(id)])
        row = result.rows[0]
      }
      if (!row) { await client.query('ROLLBACK'); return null }
      await syncScheduleSlots(client, String(id), updates)
      const rows = await attachScheduleSlots(client, [row])
      await client.query('COMMIT')
      return rowToDocument(rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  class Model {
    static find(query = {}) { return new PostgresQuery(async () => (await readRecords()).filter((item) => matches(item, query))) }
    static findOne(query = {}) { return new PostgresQuery(async () => (await readRecords()).find((item) => matches(item, query)) || null, true) }
    static findById(id) { return this.findOne({ _id: String(id) }) }
    static async create(data) { return insert(data) }
    static findByIdAndUpdate(id, updates) { return new PostgresQuery(() => updateById(id, updates), true) }
    static findOneAndUpdate(query, updates) {
      return new PostgresQuery(async () => {
        const current = (await readRecords()).find((item) => matches(item, query))
        return current ? updateById(current.id, updates) : null
      }, true)
    }
    static findByIdAndDelete(id) { return this.findOneAndDelete({ _id: String(id) }) }
    static findOneAndDelete(query) {
      return new PostgresQuery(async () => {
        const current = (await readRecords()).find((item) => matches(item, query))
        if (!current) return null
        await pool.query(`DELETE FROM ${config.table} WHERE id = $1`, [current.id])
        return current
      }, true)
    }
    static async deleteMany(query = {}) {
      const records = (await readRecords()).filter((item) => matches(item, query))
      if (records.length) await pool.query(`DELETE FROM ${config.table} WHERE id = ANY($1::text[])`, [records.map((item) => item.id)])
      return { deletedCount: records.length }
    }
    static async ensureTable() { return undefined }
    async save() { return updateById(this.id, this) }
  }

  return Model
}

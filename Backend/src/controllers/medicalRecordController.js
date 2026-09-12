import { getPetDatabaseConnection } from '../config/petDb.js'
import { medicalRecordSchema } from '../models/MedicalRecord.js'
import { getActorFromRequest, recordActivityLog } from '../lib/activityLog.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function getMedicalRecordModel(connection) {
  return connection.models.MedicalRecord || connection.model('MedicalRecord', medicalRecordSchema)
}

function serializeRecord(item) {
  return {
    id: item.id,
    petId: item.petId,
    petName: item.petName,
    ownerName: item.ownerName || '',
    doctorId: item.doctorId || '',
    doctorName: item.doctorName,
    diagnosis: item.diagnosis,
    prescription: item.prescription,
    vaccine: item.vaccine || '',
    labResult: item.labResult || '',
    notes: item.notes || '',
    recordDate: item.recordDate || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export async function listMedicalRecords(req, res) {
  const connection = await getPetDatabaseConnection()
  const MedicalRecord = getMedicalRecordModel(connection)

  const doctorName = normalizeText(req.query.doctorName)
  const petId = normalizeText(req.query.petId)
  const search = normalizeText(req.query.search).toLowerCase()
  const query = {}
  if (doctorName) {
    query.doctorName = doctorName
  }
  if (petId) {
    query.petId = petId
  }

  const records = await MedicalRecord.find(query).sort({ createdAt: -1 }).limit(800)
  const filtered = search
    ? records.filter((item) => {
        return (
          String(item.petName || '').toLowerCase().includes(search) ||
          String(item.ownerName || '').toLowerCase().includes(search) ||
          String(item.petId || '').toLowerCase().includes(search) ||
          String(item.id || '').toLowerCase().includes(search)
        )
      })
    : records

  return res.status(200).json({
    records: filtered.map(serializeRecord),
  })
}

export async function createMedicalRecord(req, res) {
  const connection = await getPetDatabaseConnection()
  const MedicalRecord = getMedicalRecordModel(connection)

  const payload = {
    petId: normalizeText(req.body.petId),
    petName: normalizeText(req.body.petName),
    ownerName: normalizeText(req.body.ownerName),
    doctorId: normalizeText(req.body.doctorId),
    doctorName: normalizeText(req.body.doctorName),
    diagnosis: normalizeText(req.body.diagnosis),
    prescription: normalizeText(req.body.prescription),
    vaccine: normalizeText(req.body.vaccine),
    labResult: normalizeText(req.body.labResult),
    notes: normalizeText(req.body.notes),
    recordDate: normalizeText(req.body.recordDate) || new Date().toISOString().slice(0, 10),
  }

  if (!payload.petId || !payload.petName || !payload.doctorName || !payload.diagnosis || !payload.prescription) {
    return res.status(400).json({
      message: 'Pet, doctor, diagnosis, and prescription are required.',
    })
  }

  const record = await MedicalRecord.create(payload)

  if (payload.prescription) {
    await recordActivityLog({
      action: 'prescription.added',
      category: 'prescriptions',
      description: `Prescription added in medical record for ${payload.petName}.`,
      actor: getActorFromRequest(req, {
        id: payload.doctorId,
        name: payload.doctorName || 'Doctor',
        role: 'doctor',
      }),
      entity: {
        type: 'medical-record',
        id: record.id,
        label: `${payload.petName} | ${payload.recordDate}`,
      },
      metadata: {
        petId: payload.petId,
        petName: payload.petName,
        doctorName: payload.doctorName,
        recordDate: payload.recordDate,
      },
    })
  }

  return res.status(201).json({ record: serializeRecord(record) })
}

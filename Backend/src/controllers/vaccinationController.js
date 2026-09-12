import { getVaccinationModel } from '../config/petDb.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeIsoDate(value) {
  const raw = normalizeText(value)
  if (!raw) {
    return ''
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return parsed.toISOString().slice(0, 10)
}

function serializeVaccination(record) {
  return {
    id: record.id,
    vaccineId: record.vaccineId,
    petId: record.petId,
    vaccineName: record.vaccineName,
    dateGiven: record.dateGiven,
    nextDueDate: record.nextDueDate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export async function listVaccinations(req, res) {
  const Vaccination = await getVaccinationModel()
  const petId = normalizeText(req.query.petId)
  const petIds = String(req.query.petIds || '')
    .split(',')
    .map((value) => normalizeText(value))
    .filter(Boolean)
  const query = {}
  if (petIds.length > 0) {
    query.petId = { $in: petIds }
  } else if (petId) {
    query.petId = petId
  }
  const records = await Vaccination.find(query)
    .sort({ nextDueDate: 1, createdAt: -1 })
    .limit(500)

  return res.status(200).json({
    vaccinations: records.map(serializeVaccination),
  })
}

export async function createVaccination(req, res) {
  const vaccineId = normalizeText(req.body.vaccineId).toUpperCase()
  const petId = normalizeText(req.body.petId)
  const vaccineName = normalizeText(req.body.vaccineName)
  const dateGiven = normalizeIsoDate(req.body.dateGiven)
  const nextDueDate = normalizeIsoDate(req.body.nextDueDate)

  if (!vaccineId || !petId || !vaccineName || !dateGiven || !nextDueDate) {
    return res.status(400).json({
      message: 'vaccineId, petId, vaccineName, dateGiven, and nextDueDate are required.',
    })
  }

  if (nextDueDate < dateGiven) {
    return res.status(400).json({
      message: 'nextDueDate must be on or after dateGiven.',
    })
  }

  const Vaccination = await getVaccinationModel()
  const existing = await Vaccination.findOne({ vaccineId })
  if (existing) {
    return res.status(409).json({ message: 'Vaccine ID already exists.' })
  }

  const vaccination = await Vaccination.create({
    vaccineId,
    petId,
    vaccineName,
    dateGiven,
    nextDueDate,
  })

  return res.status(201).json({
    vaccination: serializeVaccination(vaccination),
  })
}

export async function deleteVaccination(req, res) {
  const { vaccinationId } = req.params
  const Vaccination = await getVaccinationModel()
  const deleted = await Vaccination.findByIdAndDelete(vaccinationId)

  if (!deleted) {
    return res.status(404).json({ message: 'Vaccination record not found.' })
  }

  return res.status(200).json({ message: 'Vaccination record deleted successfully.' })
}

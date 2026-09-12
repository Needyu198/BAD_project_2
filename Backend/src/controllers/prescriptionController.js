import { prescriptionSchema } from '../models/Prescription.js'
import { getPetDatabaseConnection, getPetModel } from '../config/petDb.js'
import { getActorFromRequest, recordActivityLog } from '../lib/activityLog.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function getPrescriptionModel(connection) {
  return connection.models.Prescription || connection.model('Prescription', prescriptionSchema)
}

function serializePrescription(item) {
  return {
    id: item.id,
    petId: item.petId,
    petName: item.petName,
    ownerName: item.ownerName || '',
    doctorId: item.doctorId || '',
    doctorName: item.doctorName,
    medicine: item.medicine,
    dosage: item.dosage,
    duration: item.duration,
    notes: item.notes || '',
    createdAt: item.createdAt,
  }
}

export async function listPrescriptions(req, res) {
  const connection = await getPetDatabaseConnection()
  const Prescription = getPrescriptionModel(connection)

  const doctorName = normalizeText(req.query.doctorName)
  const petId = normalizeText(req.query.petId)
  const query = {}
  if (doctorName) {
    query.doctorName = doctorName
  }
  if (petId) {
    query.petId = petId
  }

  const prescriptions = await Prescription.find(query).sort({ createdAt: -1 }).limit(300)

  return res.status(200).json({
    prescriptions: prescriptions.map(serializePrescription),
  })
}

export async function createPrescription(req, res) {
  const { petId, doctorId, doctorName, medicine, dosage, duration, notes } = req.body

  const normalizedPetId = normalizeText(petId)
  const normalizedDoctorName = normalizeText(doctorName)
  const normalizedMedicine = normalizeText(medicine)
  const normalizedDosage = normalizeText(dosage)
  const normalizedDuration = normalizeText(duration)

  if (!normalizedPetId || !normalizedDoctorName || !normalizedMedicine || !normalizedDosage || !normalizedDuration) {
    return res.status(400).json({
      message: 'Pet, doctor, medicine, dosage, and duration are required.',
    })
  }

  const Pet = await getPetModel()
  const pet = await Pet.findById(normalizedPetId)
  if (!pet) {
    return res.status(404).json({ message: 'Pet not found.' })
  }

  const connection = await getPetDatabaseConnection()
  const Prescription = getPrescriptionModel(connection)

  const prescription = await Prescription.create({
    petId: pet.id,
    petName: pet.name,
    ownerName: pet.ownerName || '',
    doctorId: normalizeText(doctorId),
    doctorName: normalizedDoctorName,
    medicine: normalizedMedicine,
    dosage: normalizedDosage,
    duration: normalizedDuration,
    notes: normalizeText(notes),
  })

  const summary = `${normalizedMedicine} | ${normalizedDosage} | ${normalizedDuration}`
  await Pet.findByIdAndUpdate(
    pet.id,
    {
      lastPrescriptionSummary: summary,
      lastPrescriptionAt: new Date().toISOString(),
    },
    { new: false }
  )

  await recordActivityLog({
    action: 'prescription.added',
    category: 'prescriptions',
    description: `Prescription added for ${pet.name}.`,
    actor: getActorFromRequest(req, {
      id: normalizeText(doctorId),
      name: normalizedDoctorName || 'Doctor',
      role: 'doctor',
    }),
    entity: {
      type: 'prescription',
      id: prescription.id,
      label: `${pet.name} | ${normalizedMedicine}`,
    },
    metadata: {
      petId: pet.id,
      petName: pet.name,
      doctorId: normalizeText(doctorId),
      doctorName: normalizedDoctorName,
      medicine: normalizedMedicine,
    },
  })

  return res.status(201).json({
    prescription: serializePrescription(prescription),
  })
}

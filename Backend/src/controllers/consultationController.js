import { Consultation } from '../models/Consultation.js'

export async function createConsultation(req, res) {
  const {
    appointmentId,
    doctorId,
    doctorName,
    ownerName,
    petName,
    appointmentDate,
    appointmentTime,
    symptoms,
    temperature,
    weight,
    heartRate,
    respiratoryRate,
    clinicalFindings,
    diagnosis,
    treatmentPlan,
    prescription,
    followUpDate,
    outcome,
  } = req.body

  if (!appointmentId || !doctorName || !petName || !diagnosis || !treatmentPlan || !prescription) {
    return res.status(400).json({
      message: 'Appointment, doctor, pet, diagnosis, treatment plan, and prescription are required.',
    })
  }

  const consultation = await Consultation.create({
    appointmentId: String(appointmentId).trim(),
    doctorId: String(doctorId || '').trim(),
    doctorName: String(doctorName).trim(),
    ownerName: String(ownerName || '').trim(),
    petName: String(petName).trim(),
    appointmentDate: String(appointmentDate || '').trim(),
    appointmentTime: String(appointmentTime || '').trim(),
    symptoms: String(symptoms || '').trim(),
    temperature: String(temperature || '').trim(),
    weight: String(weight || '').trim(),
    heartRate: String(heartRate || '').trim(),
    respiratoryRate: String(respiratoryRate || '').trim(),
    clinicalFindings: String(clinicalFindings || '').trim(),
    diagnosis: String(diagnosis).trim(),
    treatmentPlan: String(treatmentPlan).trim(),
    prescription: String(prescription).trim(),
    followUpDate: String(followUpDate || '').trim(),
    outcome: String(outcome || 'Completed').trim(),
  })

  return res.status(201).json({
    consultation: {
      id: consultation.id,
      appointmentId: consultation.appointmentId,
      doctorName: consultation.doctorName,
      ownerName: consultation.ownerName,
      petName: consultation.petName,
      diagnosis: consultation.diagnosis,
      treatmentPlan: consultation.treatmentPlan,
      prescription: consultation.prescription,
      outcome: consultation.outcome,
      createdAt: consultation.createdAt,
    },
  })
}

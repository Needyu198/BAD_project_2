import { Router } from 'express'
import { createMedicalRecord, listMedicalRecords } from '../controllers/medicalRecordController.js'

const medicalRecordRouter = Router()

medicalRecordRouter.get('/', listMedicalRecords)
medicalRecordRouter.post('/', createMedicalRecord)

export { medicalRecordRouter }

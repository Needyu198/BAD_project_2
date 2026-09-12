import { Router } from 'express'
import { createPrescription, listPrescriptions } from '../controllers/prescriptionController.js'

const prescriptionRouter = Router()

prescriptionRouter.get('/', listPrescriptions)
prescriptionRouter.post('/', createPrescription)

export { prescriptionRouter }

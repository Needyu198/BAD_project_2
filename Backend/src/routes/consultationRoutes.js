import { Router } from 'express'
import { createConsultation } from '../controllers/consultationController.js'

const consultationRouter = Router()

consultationRouter.post('/', createConsultation)

export { consultationRouter }

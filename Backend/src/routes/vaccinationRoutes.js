import { Router } from 'express'
import {
  createVaccination,
  deleteVaccination,
  listVaccinations,
} from '../controllers/vaccinationController.js'

const vaccinationRouter = Router()

vaccinationRouter.get('/', listVaccinations)
vaccinationRouter.post('/', createVaccination)
vaccinationRouter.delete('/:vaccinationId', deleteVaccination)

export { vaccinationRouter }

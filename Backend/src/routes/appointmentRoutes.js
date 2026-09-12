import { Router } from 'express'
import { createAppointment, deleteAppointment, listAppointments, updateAppointment } from '../controllers/appointmentController.js'

const appointmentRouter = Router()

appointmentRouter.get('/', listAppointments)
appointmentRouter.post('/', createAppointment)
appointmentRouter.put('/:appointmentId', updateAppointment)
appointmentRouter.delete('/:appointmentId', deleteAppointment)

export { appointmentRouter }

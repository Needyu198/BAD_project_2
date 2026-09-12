import { Router } from 'express'
import {
  addAvailableSlot,
  addBlockedSlot,
  deleteScheduleSlot,
  getDoctorSchedule,
  updateClinicHours,
} from '../controllers/doctorScheduleController.js'

const doctorScheduleRouter = Router()

doctorScheduleRouter.get('/:doctorId', getDoctorSchedule)
doctorScheduleRouter.post('/:doctorId/available-slots', addAvailableSlot)
doctorScheduleRouter.post('/:doctorId/blocked-slots', addBlockedSlot)
doctorScheduleRouter.put('/:doctorId/clinic-hours', updateClinicHours)
doctorScheduleRouter.delete('/:doctorId/:slotType/:slotId', deleteScheduleSlot)

export { doctorScheduleRouter }

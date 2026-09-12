import { Appointment } from '../models/Appointment.js'
import { getPetDatabaseConnection } from '../config/petDb.js'
import { doctorScheduleSchema } from '../models/DoctorSchedule.js'
import { getActorFromRequest, recordActivityLog } from '../lib/activityLog.js'

function normalizeText(value) {
  return String(value || '').trim()
}

const ACTIVE_BOOKING_STATUSES = ['Pending', 'Confirmed']
const APPOINTMENT_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled']

function serializeAppointment(appointment) {
  return {
    id: appointment.id,
    ownerId: appointment.ownerId,
    ownerName: appointment.ownerName,
    petName: appointment.petName,
    doctorName: appointment.doctorName,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    reason: appointment.reason,
    status: appointment.status,
    createdAt: appointment.createdAt,
  }
}

function parseTimeToMinutes(value) {
  const raw = normalizeText(value)
  if (!raw) {
    return null
  }

  const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1])
    const minute = Number(twentyFourHourMatch[2])
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null
    }
    return hour * 60 + minute
  }

  const meridiemMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1])
    const minute = Number(meridiemMatch[2])
    const meridiem = meridiemMatch[3].toUpperCase()
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return null
    }
    if (hour === 12) {
      hour = 0
    }
    if (meridiem === 'PM') {
      hour += 12
    }
    return hour * 60 + minute
  }

  return null
}

function parseTimeRange(value) {
  const raw = normalizeText(value)
  if (!raw || /^closed$/i.test(raw)) {
    return null
  }

  const parts = raw.split('-').map((part) => normalizeText(part))
  if (parts.length !== 2) {
    return null
  }

  const start = parseTimeToMinutes(parts[0])
  const end = parseTimeToMinutes(parts[1])
  if (start === null || end === null || start >= end) {
    return null
  }
  return { start, end }
}

function isTimeWithinRange(timeMinutes, range) {
  return range && timeMinutes >= range.start && timeMinutes < range.end
}

function getDayKey(dateString) {
  const date = new Date(`${normalizeText(dateString)}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const day = date.getDay()
  if (day === 0) {
    return 'sunday'
  }
  if (day === 6) {
    return 'saturday'
  }
  return 'mondayFriday'
}

function getDoctorScheduleModel(connection) {
  return connection.models.DoctorSchedule || connection.model('DoctorSchedule', doctorScheduleSchema)
}

async function validateDoctorAvailability({
  doctorName,
  appointmentDate,
  appointmentTime,
  excludeAppointmentId = '',
}) {
  const normalizedDoctorName = normalizeText(doctorName)
  const normalizedDate = normalizeText(appointmentDate)
  const normalizedTime = normalizeText(appointmentTime)

  const requestedMinutes = parseTimeToMinutes(normalizedTime)
  if (requestedMinutes === null) {
    return { ok: false, message: 'Appointment time must be a valid time.' }
  }

  const conflictQuery = {
    doctorName: normalizedDoctorName,
    appointmentDate: normalizedDate,
    appointmentTime: normalizedTime,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  }
  if (excludeAppointmentId) {
    conflictQuery._id = { $ne: excludeAppointmentId }
  }

  const existingConflict = await Appointment.findOne(conflictQuery).lean()
  if (existingConflict) {
    return { ok: false, message: 'This doctor time slot is already booked.' }
  }

  const connection = await getPetDatabaseConnection()
  const DoctorSchedule = getDoctorScheduleModel(connection)
  const schedule = await DoctorSchedule.findOne({ doctorName: normalizedDoctorName }).lean()
  if (!schedule) {
    // No doctor schedule configured yet; only double-booking check can be enforced.
    return { ok: true }
  }

  const dayKey = getDayKey(normalizedDate)
  if (!dayKey) {
    return { ok: false, message: 'Appointment date must be valid.' }
  }

  const clinicHoursText = normalizeText(schedule.clinicHours?.[dayKey])
  if (!clinicHoursText || /^closed$/i.test(clinicHoursText)) {
    return { ok: false, message: 'Doctor is not available on the selected day.' }
  }

  const clinicRange = parseTimeRange(clinicHoursText)
  if (!clinicRange) {
    return { ok: false, message: 'Doctor clinic hours are not configured correctly.' }
  }
  if (!isTimeWithinRange(requestedMinutes, clinicRange)) {
    return { ok: false, message: 'Appointment time is outside doctor clinic hours.' }
  }

  const blockedSlots = Array.isArray(schedule.blockedSlots) ? schedule.blockedSlots : []
  const blockedMatch = blockedSlots.some((slot) => {
    if (normalizeText(slot.date) !== normalizedDate) {
      return false
    }
    const slotRange = {
      start: parseTimeToMinutes(slot.startTime),
      end: parseTimeToMinutes(slot.endTime),
    }
    if (slotRange.start === null || slotRange.end === null || slotRange.start >= slotRange.end) {
      return false
    }
    return isTimeWithinRange(requestedMinutes, slotRange)
  })
  if (blockedMatch) {
    return { ok: false, message: 'Selected time is blocked for this doctor.' }
  }

  const availableSlots = Array.isArray(schedule.availableSlots) ? schedule.availableSlots : []
  const availableForDate = availableSlots.filter((slot) => normalizeText(slot.date) === normalizedDate)
  if (availableForDate.length > 0) {
    const withinAvailableSlot = availableForDate.some((slot) => {
      const slotRange = {
        start: parseTimeToMinutes(slot.startTime),
        end: parseTimeToMinutes(slot.endTime),
      }
      if (slotRange.start === null || slotRange.end === null || slotRange.start >= slotRange.end) {
        return false
      }
      return isTimeWithinRange(requestedMinutes, slotRange)
    })
    if (!withinAvailableSlot) {
      return { ok: false, message: 'Selected time is not in the doctor available slots.' }
    }
  }

  return { ok: true }
}

function canTransitionStatus(currentStatus, nextStatus, { isRescheduleReset } = {}) {
  if (currentStatus === nextStatus) {
    return true
  }

  if (isRescheduleReset && currentStatus === 'Confirmed' && nextStatus === 'Pending') {
    return true
  }

  const allowedTransitions = {
    Pending: ['Confirmed', 'Cancelled'],
    Confirmed: ['Completed', 'Cancelled'],
    Completed: [],
    Cancelled: [],
  }

  return (allowedTransitions[currentStatus] || []).includes(nextStatus)
}

export async function createAppointment(req, res) {
  const { ownerId, ownerName, petName, doctorName, appointmentDate, appointmentTime, reason } = req.body

  if (!petName || !doctorName || !appointmentDate || !appointmentTime || !reason) {
    return res.status(400).json({
      message: 'Pet, doctor, date, time, and reason are required.',
    })
  }

  const availability = await validateDoctorAvailability({
    doctorName: String(doctorName).trim(),
    appointmentDate: String(appointmentDate).trim(),
    appointmentTime: String(appointmentTime).trim(),
  })
  if (!availability.ok) {
    return res.status(409).json({ message: availability.message })
  }

  const appointment = await Appointment.create({
    ownerId: normalizeText(ownerId),
    ownerName: normalizeText(ownerName),
    petName: String(petName).trim(),
    doctorName: String(doctorName).trim(),
    appointmentDate: String(appointmentDate).trim(),
    appointmentTime: String(appointmentTime).trim(),
    reason: String(reason).trim(),
  })

  return res.status(201).json({
    appointment: serializeAppointment(appointment),
  })
}

export async function listAppointments(req, res) {
  const ownerId = normalizeText(req.query.userId)
  const doctorName = normalizeText(req.query.doctorName)
  const conditions = []

  if (ownerId) {
    conditions.push({ ownerId })
  }
  if (doctorName) {
    conditions.push({ doctorName })
  }

  const query = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions }

  const appointments = await Appointment.find(query).sort({ createdAt: -1 }).limit(100)

  return res.status(200).json({
    appointments: appointments.map(serializeAppointment),
  })
}

export async function updateAppointment(req, res) {
  const { appointmentId } = req.params
  const { ownerName, doctorName, appointmentDate, appointmentTime, status } = req.body
  const existingAppointment = await Appointment.findById(appointmentId)

  if (!existingAppointment) {
    return res.status(404).json({ message: 'Appointment not found.' })
  }

  const updates = {}
  if (ownerName !== undefined) {
    updates.ownerName = String(ownerName || '').trim()
  }
  if (doctorName !== undefined) {
    updates.doctorName = String(doctorName || '').trim()
  }
  if (appointmentDate !== undefined) {
    updates.appointmentDate = String(appointmentDate || '').trim()
  }
  if (appointmentTime !== undefined) {
    updates.appointmentTime = String(appointmentTime || '').trim()
  }
  if (status !== undefined) {
    const normalizedStatus = normalizeText(status)
    if (!APPOINTMENT_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({ message: 'Invalid appointment status.' })
    }

    const isRescheduleReset =
      normalizedStatus === 'Pending' &&
      ((appointmentDate !== undefined && normalizeText(appointmentDate) !== normalizeText(existingAppointment.appointmentDate)) ||
        (appointmentTime !== undefined && normalizeText(appointmentTime) !== normalizeText(existingAppointment.appointmentTime)) ||
        (doctorName !== undefined && normalizeText(doctorName) !== normalizeText(existingAppointment.doctorName)))

    if (!canTransitionStatus(existingAppointment.status, normalizedStatus, { isRescheduleReset })) {
      return res.status(400).json({
        message: `Invalid status transition from ${existingAppointment.status} to ${normalizedStatus}.`,
      })
    }
    updates.status = normalizedStatus
  }

  const nextDoctorName =
    doctorName !== undefined ? normalizeText(doctorName) : normalizeText(existingAppointment.doctorName)
  const nextDate =
    appointmentDate !== undefined ? normalizeText(appointmentDate) : normalizeText(existingAppointment.appointmentDate)
  const nextTime =
    appointmentTime !== undefined ? normalizeText(appointmentTime) : normalizeText(existingAppointment.appointmentTime)
  const nextStatus = updates.status || existingAppointment.status

  const changesScheduleFields =
    doctorName !== undefined || appointmentDate !== undefined || appointmentTime !== undefined
  const activatesSlot = ACTIVE_BOOKING_STATUSES.includes(nextStatus)

  if (changesScheduleFields && activatesSlot) {
    if (!nextDoctorName || !nextDate || !nextTime) {
      return res.status(400).json({ message: 'Doctor, date, and time are required.' })
    }
    const availability = await validateDoctorAvailability({
      doctorName: nextDoctorName,
      appointmentDate: nextDate,
      appointmentTime: nextTime,
      excludeAppointmentId: appointmentId,
    })
    if (!availability.ok) {
      return res.status(409).json({ message: availability.message })
    }
  } else if (status !== undefined && ACTIVE_BOOKING_STATUSES.includes(nextStatus)) {
    // Example: Cancelled -> Pending or Pending -> Confirmed should re-validate slot occupancy.
    const availability = await validateDoctorAvailability({
      doctorName: nextDoctorName,
      appointmentDate: nextDate,
      appointmentTime: nextTime,
      excludeAppointmentId: appointmentId,
    })
    if (!availability.ok) {
      return res.status(409).json({ message: availability.message })
    }
  }

  const appointment = await Appointment.findByIdAndUpdate(appointmentId, updates, {
    new: true,
    runValidators: true,
  })

  if (appointment) {
    const previousStatus = normalizeText(existingAppointment.status)
    const nextStatusApplied = normalizeText(appointment.status)
    if (previousStatus !== nextStatusApplied) {
      await recordActivityLog({
        action: 'appointment.status_changed',
        category: 'appointments',
        description: `Appointment status changed from ${previousStatus || '-'} to ${nextStatusApplied || '-'}.`,
        actor: getActorFromRequest(req, {
          id: existingAppointment.ownerId,
          name: existingAppointment.ownerName || 'Unknown User',
          role: 'unknown',
        }),
        entity: {
          type: 'appointment',
          id: appointment.id,
          label: `${appointment.petName} | ${appointment.doctorName} | ${appointment.appointmentDate} ${appointment.appointmentTime}`,
        },
        metadata: {
          fromStatus: previousStatus,
          toStatus: nextStatusApplied,
        },
      })
    }
  }

  return res.status(200).json({
    appointment: serializeAppointment(appointment),
  })
}

export async function deleteAppointment(req, res) {
  const { appointmentId } = req.params
  const ownerId = normalizeText(req.query.userId)

  const deleted = ownerId
    ? await Appointment.findOneAndDelete({ _id: appointmentId, ownerId })
    : await Appointment.findByIdAndDelete(appointmentId)

  if (!deleted) {
    return res.status(404).json({ message: 'Appointment not found.' })
  }

  return res.status(200).json({ message: 'Appointment deleted successfully.' })
}

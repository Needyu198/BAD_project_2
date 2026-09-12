import { getPetDatabaseConnection } from '../config/petDb.js'
import { doctorScheduleSchema } from '../models/DoctorSchedule.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function getDoctorScheduleModel(connection) {
  return connection.models.DoctorSchedule || connection.model('DoctorSchedule', doctorScheduleSchema)
}

function defaultClinicHours() {
  return {
    mondayFriday: '09:00 AM - 05:00 PM',
    saturday: '10:00 AM - 02:00 PM',
    sunday: 'Closed',
  }
}

function serializeSchedule(schedule) {
  return {
    id: schedule.id,
    doctorId: schedule.doctorId,
    doctorName: schedule.doctorName || '',
    clinicHours: {
      mondayFriday: schedule.clinicHours?.mondayFriday || '09:00 AM - 05:00 PM',
      saturday: schedule.clinicHours?.saturday || '10:00 AM - 02:00 PM',
      sunday: schedule.clinicHours?.sunday || 'Closed',
    },
    availableSlots: Array.isArray(schedule.availableSlots)
      ? schedule.availableSlots.map((slot) => ({
          id: String(slot._id),
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotType: slot.slotType || 'regular',
        }))
      : [],
    blockedSlots: Array.isArray(schedule.blockedSlots)
      ? schedule.blockedSlots.map((slot) => ({
          id: String(slot._id),
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          reason: slot.reason || '',
        }))
      : [],
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  }
}

async function findOrCreateSchedule(DoctorSchedule, doctorId, doctorName) {
  let schedule = await DoctorSchedule.findOne({ doctorId })
  if (!schedule) {
    schedule = await DoctorSchedule.create({
      doctorId,
      doctorName: normalizeText(doctorName),
      clinicHours: defaultClinicHours(),
      availableSlots: [],
      blockedSlots: [],
    })
  } else if (doctorName && !schedule.doctorName) {
    schedule.doctorName = normalizeText(doctorName)
    await schedule.save()
  }
  return schedule
}

export async function getDoctorSchedule(req, res) {
  const doctorId = normalizeText(req.params.doctorId)
  const doctorName = normalizeText(req.query.doctorName)
  if (!doctorId) {
    return res.status(400).json({ message: 'Doctor account is required.' })
  }

  const connection = await getPetDatabaseConnection()
  const DoctorSchedule = getDoctorScheduleModel(connection)
  const schedule = await findOrCreateSchedule(DoctorSchedule, doctorId, doctorName)

  return res.status(200).json({ schedule: serializeSchedule(schedule) })
}

export async function addAvailableSlot(req, res) {
  const doctorId = normalizeText(req.params.doctorId)
  const doctorName = normalizeText(req.body.doctorName)
  const date = normalizeText(req.body.date)
  const startTime = normalizeText(req.body.startTime)
  const endTime = normalizeText(req.body.endTime)
  const slotType = normalizeText(req.body.slotType) || 'regular'

  if (!doctorId || !date || !startTime || !endTime) {
    return res.status(400).json({ message: 'Doctor, date, start time, and end time are required.' })
  }
  if (slotType !== 'regular' && slotType !== 'emergency') {
    return res.status(400).json({ message: 'Slot type must be regular or emergency.' })
  }

  const connection = await getPetDatabaseConnection()
  const DoctorSchedule = getDoctorScheduleModel(connection)
  const schedule = await findOrCreateSchedule(DoctorSchedule, doctorId, doctorName)
  schedule.availableSlots.push({ date, startTime, endTime, slotType })
  await schedule.save()

  return res.status(201).json({ schedule: serializeSchedule(schedule) })
}

export async function addBlockedSlot(req, res) {
  const doctorId = normalizeText(req.params.doctorId)
  const doctorName = normalizeText(req.body.doctorName)
  const date = normalizeText(req.body.date)
  const startTime = normalizeText(req.body.startTime)
  const endTime = normalizeText(req.body.endTime)
  const reason = normalizeText(req.body.reason)

  if (!doctorId || !date || !startTime || !endTime) {
    return res.status(400).json({ message: 'Doctor, date, start time, and end time are required.' })
  }

  const connection = await getPetDatabaseConnection()
  const DoctorSchedule = getDoctorScheduleModel(connection)
  const schedule = await findOrCreateSchedule(DoctorSchedule, doctorId, doctorName)
  schedule.blockedSlots.push({ date, startTime, endTime, reason })
  await schedule.save()

  return res.status(201).json({ schedule: serializeSchedule(schedule) })
}

export async function updateClinicHours(req, res) {
  const doctorId = normalizeText(req.params.doctorId)
  const doctorName = normalizeText(req.body.doctorName)
  const mondayFriday = normalizeText(req.body.mondayFriday)
  const saturday = normalizeText(req.body.saturday)
  const sunday = normalizeText(req.body.sunday)

  if (!doctorId) {
    return res.status(400).json({ message: 'Doctor account is required.' })
  }

  const connection = await getPetDatabaseConnection()
  const DoctorSchedule = getDoctorScheduleModel(connection)
  const schedule = await findOrCreateSchedule(DoctorSchedule, doctorId, doctorName)
  schedule.clinicHours = {
    mondayFriday: mondayFriday || schedule.clinicHours?.mondayFriday || '09:00 AM - 05:00 PM',
    saturday: saturday || schedule.clinicHours?.saturday || '10:00 AM - 02:00 PM',
    sunday: sunday || schedule.clinicHours?.sunday || 'Closed',
  }
  await schedule.save()

  return res.status(200).json({ schedule: serializeSchedule(schedule) })
}

export async function deleteScheduleSlot(req, res) {
  const doctorId = normalizeText(req.params.doctorId)
  const slotType = normalizeText(req.params.slotType)
  const slotId = normalizeText(req.params.slotId)
  if (!doctorId || !slotId) {
    return res.status(400).json({ message: 'Doctor and slot are required.' })
  }
  if (slotType !== 'available' && slotType !== 'blocked') {
    return res.status(400).json({ message: 'Slot type must be available or blocked.' })
  }

  const connection = await getPetDatabaseConnection()
  const DoctorSchedule = getDoctorScheduleModel(connection)
  const schedule = await DoctorSchedule.findOne({ doctorId })
  if (!schedule) {
    return res.status(404).json({ message: 'Schedule not found.' })
  }

  if (slotType === 'available') {
    schedule.availableSlots = schedule.availableSlots.filter((slot) => String(slot._id) !== slotId)
  } else {
    schedule.blockedSlots = schedule.blockedSlots.filter((slot) => String(slot._id) !== slotId)
  }
  await schedule.save()

  return res.status(200).json({ schedule: serializeSchedule(schedule) })
}

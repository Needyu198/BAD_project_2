import { createPostgresModel } from '../lib/postgresModel.js'

/* const availableSlotSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    slotType: {
      type: String,
      enum: ['regular', 'emergency'],
      default: 'regular',
    },
  },
  { _id: true }
)

const blockedSlotSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
)

export const doctorScheduleSchema = new mongoose.Schema(
  {
    doctorId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    doctorName: {
      type: String,
      trim: true,
      default: '',
    },
    clinicHours: {
      mondayFriday: {
        type: String,
        trim: true,
        default: '09:00 AM - 05:00 PM',
      },
      saturday: {
        type: String,
        trim: true,
        default: '10:00 AM - 02:00 PM',
      },
      sunday: {
        type: String,
        trim: true,
        default: 'Closed',
      },
    },
    availableSlots: {
      type: [availableSlotSchema],
      default: [],
    },
    blockedSlots: {
      type: [blockedSlotSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'doctor_schedule_data',
  }
) */

export const DoctorSchedule = createPostgresModel('doctor_schedules')
export const doctorScheduleSchema = null

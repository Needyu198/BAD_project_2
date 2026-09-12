import { createPostgresModel } from '../lib/postgresModel.js'

/* const appointmentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      trim: true,
      default: '',
    },
    ownerName: {
      type: String,
      trim: true,
      default: '',
    },
    petName: {
      type: String,
      required: true,
      trim: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    appointmentDate: {
      type: String,
      required: true,
      trim: true,
    },
    appointmentTime: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
    collection: 'appointmentdata',
  }
) */

export const Appointment = createPostgresModel('appointments')
export const appointmentSchema = null

import { createPostgresModel } from '../lib/postgresModel.js'

/* const consultationSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: String,
      required: true,
      trim: true,
    },
    doctorId: {
      type: String,
      trim: true,
      default: '',
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
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
    appointmentDate: {
      type: String,
      trim: true,
      default: '',
    },
    appointmentTime: {
      type: String,
      trim: true,
      default: '',
    },
    symptoms: {
      type: String,
      trim: true,
      default: '',
    },
    temperature: {
      type: String,
      trim: true,
      default: '',
    },
    weight: {
      type: String,
      trim: true,
      default: '',
    },
    heartRate: {
      type: String,
      trim: true,
      default: '',
    },
    respiratoryRate: {
      type: String,
      trim: true,
      default: '',
    },
    clinicalFindings: {
      type: String,
      trim: true,
      default: '',
    },
    diagnosis: {
      type: String,
      required: true,
      trim: true,
    },
    treatmentPlan: {
      type: String,
      required: true,
      trim: true,
    },
    prescription: {
      type: String,
      required: true,
      trim: true,
    },
    followUpDate: {
      type: String,
      trim: true,
      default: '',
    },
    outcome: {
      type: String,
      trim: true,
      default: 'Completed',
    },
  },
  {
    timestamps: true,
    collection: 'consultation_data',
  }
) */

export const Consultation = createPostgresModel('consultations')
export const consultationSchema = null

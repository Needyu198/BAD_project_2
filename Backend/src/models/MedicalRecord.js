import { createPostgresModel } from '../lib/postgresModel.js'

/* export const medicalRecordSchema = new mongoose.Schema(
  {
    petId: {
      type: String,
      required: true,
      trim: true,
    },
    petName: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
      default: '',
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
    diagnosis: {
      type: String,
      required: true,
      trim: true,
    },
    prescription: {
      type: String,
      required: true,
      trim: true,
    },
    vaccine: {
      type: String,
      trim: true,
      default: '',
    },
    nextDueDate: {
      type: String,
      trim: true,
      default: '',
    },
    labResult: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    recordDate: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'medical_record_data',
  }
) */

export const MedicalRecord = createPostgresModel('medical_records')
export const medicalRecordSchema = null

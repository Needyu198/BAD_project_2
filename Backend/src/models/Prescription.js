import { createPostgresModel } from '../lib/postgresModel.js'

/* export const prescriptionSchema = new mongoose.Schema(
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
    medicine: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'Prescription_data',
  }
) */

export const Prescription = createPostgresModel('prescriptions')
export const prescriptionSchema = null

import { createPostgresModel } from '../lib/postgresModel.js'

/* export const petSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      required: true,
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    breed: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: String,
      required: true,
      trim: true,
    },
    weight: {
      type: String,
      required: true,
      trim: true,
    },
    vaccinationStatus: {
      type: String,
      required: true,
      trim: true,
    },
    petPhoto: {
      type: String,
      default: '',
    },
    lastPrescriptionSummary: {
      type: String,
      trim: true,
      default: '',
    },
    lastPrescriptionAt: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'pet_data',
  }
 ) */

export const Pet = createPostgresModel('pets')
export const petSchema = null

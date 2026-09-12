import { createPostgresModel } from '../lib/postgresModel.js'

/* export const billingRecordSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    appointmentId: {
      type: String,
      trim: true,
      default: '',
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
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
    consultationFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    serviceCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    medicineCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    labCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    subTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: '',
    },
    paymentDate: {
      type: String,
      trim: true,
      default: '',
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Partial', 'Unpaid', 'Pending', 'Failed'],
      default: 'Unpaid',
    },
  },
  {
    timestamps: true,
    collection: 'billing_payment_data',
  }
) */

export const BillingRecord = createPostgresModel('billing_records')
export const billingRecordSchema = null

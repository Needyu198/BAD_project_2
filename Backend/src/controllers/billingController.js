import { getPetDatabaseConnection } from '../config/petDb.js'
import { billingRecordSchema } from '../models/BillingRecord.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeMoney(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) {
    return 0
  }
  return Math.round(num * 100) / 100
}

function toMoneyString(value) {
  const amount = normalizeMoney(value)
  return `฿${amount.toFixed(2)}`
}

function getBillingModel(connection) {
  return connection.models.BillingRecord || connection.model('BillingRecord', billingRecordSchema)
}

function calculateSubTotal(charges) {
  return normalizeMoney(charges.consultationFee) +
    normalizeMoney(charges.serviceCharges) +
    normalizeMoney(charges.medicineCharges) +
    normalizeMoney(charges.labCharges)
}

function calculateTotal(charges) {
  const subTotal = calculateSubTotal(charges)
  const taxAmount = normalizeMoney(charges.taxAmount)
  const discountAmount = normalizeMoney(charges.discountAmount)
  return normalizeMoney(Math.max(0, subTotal + taxAmount - discountAmount))
}

function derivePaymentStatus(totalAmount, amountPaid, preferredStatus = '') {
  const normalizedPreferred = normalizeText(preferredStatus)
  if (normalizedPreferred === 'Failed') {
    return 'Failed'
  }

  const total = normalizeMoney(totalAmount)
  const paid = normalizeMoney(amountPaid)

  if (total <= 0 || paid >= total) {
    return 'Paid'
  }
  if (paid > 0) {
    return 'Partial'
  }
  if (normalizedPreferred === 'Pending') {
    return 'Pending'
  }
  return 'Unpaid'
}

function serializeBillingRecord(item) {
  const invoiceNumber = item.invoiceNumber || item.invoiceId
  const subTotal = normalizeMoney(item.subTotal ?? calculateSubTotal(item))
  const taxAmount = normalizeMoney(item.taxAmount)
  const discountAmount = normalizeMoney(item.discountAmount)
  const totalAmount = normalizeMoney(item.totalAmount)
  const amountPaid = normalizeMoney(item.amountPaid)
  const balanceDue = normalizeMoney(item.balanceDue ?? Math.max(0, totalAmount - amountPaid))
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    invoiceNumber,
    appointmentId: item.appointmentId || '',
    ownerName: item.ownerName,
    petName: item.petName,
    doctorName: item.doctorName || '',
    consultationFee: normalizeMoney(item.consultationFee),
    serviceCharges: normalizeMoney(item.serviceCharges),
    medicineCharges: normalizeMoney(item.medicineCharges),
    labCharges: normalizeMoney(item.labCharges),
    taxAmount,
    discountAmount,
    subTotal,
    subTotalDisplay: toMoneyString(subTotal),
    totalAmount,
    totalAmountDisplay: toMoneyString(totalAmount),
    amountPaid,
    amountPaidDisplay: toMoneyString(amountPaid),
    balanceDue,
    balanceDueDisplay: toMoneyString(balanceDue),
    paymentMethod: item.paymentMethod || '',
    paymentDate: item.paymentDate || '',
    referenceNumber: item.referenceNumber || '',
    paymentStatus: item.paymentStatus || 'Unpaid',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function buildInvoiceId() {
  const now = new Date()
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  const stamp = Date.now().toString().slice(-5)
  return `INV-${datePart}-${stamp}`
}

export async function listBillingRecords(req, res) {
  const connection = await getPetDatabaseConnection()
  const BillingRecord = getBillingModel(connection)

  const status = normalizeText(req.query.status)
  const query = status ? { paymentStatus: status } : {}
  const records = await BillingRecord.find(query).sort({ createdAt: -1 }).limit(500)

  return res.status(200).json({
    records: records.map(serializeBillingRecord),
  })
}

export async function createBillingRecord(req, res) {
  const connection = await getPetDatabaseConnection()
  const BillingRecord = getBillingModel(connection)

  const invoiceId = normalizeText(req.body.invoiceId) || buildInvoiceId()
  const appointmentId = normalizeText(req.body.appointmentId)
  const ownerName = normalizeText(req.body.ownerName)
  const petName = normalizeText(req.body.petName)
  const doctorName = normalizeText(req.body.doctorName)
  const consultationFee = normalizeMoney(req.body.consultationFee)
  const serviceCharges = normalizeMoney(req.body.serviceCharges)
  const medicineCharges = normalizeMoney(req.body.medicineCharges)
  const labCharges = normalizeMoney(req.body.labCharges)
  const taxAmount = normalizeMoney(req.body.taxAmount)
  const discountAmount = normalizeMoney(req.body.discountAmount)

  if (!ownerName || !petName || !doctorName) {
    return res.status(400).json({ message: 'Owner name, pet name, and doctor are required.' })
  }

  const subTotal = calculateSubTotal({ consultationFee, serviceCharges, medicineCharges, labCharges })
  const totalAmount = calculateTotal({ consultationFee, serviceCharges, medicineCharges, labCharges, taxAmount, discountAmount })
  const existing = await BillingRecord.findOne({ invoiceId })
  if (existing) {
    return res.status(409).json({ message: 'Invoice ID already exists.' })
  }

  const record = await BillingRecord.create({
    invoiceId,
    appointmentId,
    ownerName,
    petName,
    doctorName,
    consultationFee,
    serviceCharges,
    medicineCharges,
    labCharges,
    taxAmount,
    discountAmount,
    subTotal,
    totalAmount,
    amountPaid: 0,
    balanceDue: totalAmount,
    invoiceNumber: invoiceId,
    paymentStatus: totalAmount > 0 ? 'Unpaid' : 'Paid',
  })

  return res.status(201).json({ record: serializeBillingRecord(record) })
}

export async function updateBillingCharges(req, res) {
  const connection = await getPetDatabaseConnection()
  const BillingRecord = getBillingModel(connection)
  const { billingId } = req.params

  const updates = {}
  if (req.body.consultationFee !== undefined) {
    updates.consultationFee = normalizeMoney(req.body.consultationFee)
  }
  if (req.body.serviceCharges !== undefined) {
    updates.serviceCharges = normalizeMoney(req.body.serviceCharges)
  }
  if (req.body.medicineCharges !== undefined) {
    updates.medicineCharges = normalizeMoney(req.body.medicineCharges)
  }
  if (req.body.labCharges !== undefined) {
    updates.labCharges = normalizeMoney(req.body.labCharges)
  }
  if (req.body.taxAmount !== undefined) {
    updates.taxAmount = normalizeMoney(req.body.taxAmount)
  }
  if (req.body.discountAmount !== undefined) {
    updates.discountAmount = normalizeMoney(req.body.discountAmount)
  }

  const existing = await BillingRecord.findById(billingId)
  if (!existing) {
    return res.status(404).json({ message: 'Billing record not found.' })
  }

  const consultationFee = updates.consultationFee ?? existing.consultationFee
  const serviceCharges = updates.serviceCharges ?? existing.serviceCharges
  const medicineCharges = updates.medicineCharges ?? existing.medicineCharges
  const labCharges = updates.labCharges ?? existing.labCharges
  const taxAmount = updates.taxAmount ?? existing.taxAmount
  const discountAmount = updates.discountAmount ?? existing.discountAmount
  updates.subTotal = calculateSubTotal({ consultationFee, serviceCharges, medicineCharges, labCharges })
  updates.totalAmount = calculateTotal({ consultationFee, serviceCharges, medicineCharges, labCharges, taxAmount, discountAmount })

  const existingPaid = normalizeMoney(existing.amountPaid)
  const nextAmountPaid = Math.min(existingPaid, updates.totalAmount)
  updates.amountPaid = nextAmountPaid
  updates.balanceDue = normalizeMoney(Math.max(0, updates.totalAmount - nextAmountPaid))
  updates.paymentStatus = derivePaymentStatus(updates.totalAmount, nextAmountPaid, existing.paymentStatus)

  const record = await BillingRecord.findByIdAndUpdate(billingId, updates, { new: true, runValidators: true })

  return res.status(200).json({ record: serializeBillingRecord(record) })
}

export async function recordBillingPayment(req, res) {
  const connection = await getPetDatabaseConnection()
  const BillingRecord = getBillingModel(connection)
  const { billingId } = req.params

  const updates = {}
  if (req.body.paymentMethod !== undefined) {
    updates.paymentMethod = normalizeText(req.body.paymentMethod)
  }
  if (req.body.paymentDate !== undefined) {
    updates.paymentDate = normalizeText(req.body.paymentDate)
  }
  if (req.body.referenceNumber !== undefined) {
    updates.referenceNumber = normalizeText(req.body.referenceNumber)
  }
  const paymentAmount = req.body.paymentAmount !== undefined ? normalizeMoney(req.body.paymentAmount) : null
  const amountPaidOverride = req.body.amountPaid !== undefined ? normalizeMoney(req.body.amountPaid) : null
  if (req.body.paymentStatus !== undefined) {
    updates.paymentStatus = normalizeText(req.body.paymentStatus)
  }

  const existing = await BillingRecord.findById(billingId)
  if (!existing) {
    return res.status(404).json({ message: 'Billing record not found.' })
  }

  const totalAmount = normalizeMoney(existing.totalAmount)
  let amountPaid = normalizeMoney(existing.amountPaid)
  if (amountPaidOverride !== null) {
    amountPaid = amountPaidOverride
  } else if (paymentAmount !== null) {
    amountPaid = normalizeMoney(amountPaid + paymentAmount)
  }
  amountPaid = normalizeMoney(Math.min(Math.max(amountPaid, 0), totalAmount))
  updates.amountPaid = amountPaid
  updates.balanceDue = normalizeMoney(Math.max(0, totalAmount - amountPaid))
  updates.paymentStatus = derivePaymentStatus(totalAmount, amountPaid, updates.paymentStatus || existing.paymentStatus)

  const record = await BillingRecord.findByIdAndUpdate(billingId, updates, { new: true, runValidators: true })
  return res.status(200).json({ record: serializeBillingRecord(record) })
}

export async function getBillingReceipt(req, res) {
  const connection = await getPetDatabaseConnection()
  const BillingRecord = getBillingModel(connection)
  const { billingId } = req.params
  const record = await BillingRecord.findById(billingId)
  if (!record) {
    return res.status(404).json({ message: 'Billing record not found.' })
  }

  return res.status(200).json({
    receipt: {
      billingId: record.id,
      invoiceId: record.invoiceId,
      invoiceNumber: record.invoiceNumber || record.invoiceId,
      ownerName: record.ownerName,
      petName: record.petName,
      doctorName: record.doctorName || '-',
      appointmentId: record.appointmentId || '',
      consultationFee: normalizeMoney(record.consultationFee),
      consultationFeeDisplay: toMoneyString(record.consultationFee),
      serviceCharges: normalizeMoney(record.serviceCharges),
      serviceChargesDisplay: toMoneyString(record.serviceCharges),
      medicineCharges: normalizeMoney(record.medicineCharges),
      medicineChargesDisplay: toMoneyString(record.medicineCharges),
      labCharges: normalizeMoney(record.labCharges),
      labChargesDisplay: toMoneyString(record.labCharges),
      taxAmount: normalizeMoney(record.taxAmount),
      taxAmountDisplay: toMoneyString(record.taxAmount),
      discountAmount: normalizeMoney(record.discountAmount),
      discountAmountDisplay: toMoneyString(record.discountAmount),
      subTotal: normalizeMoney(record.subTotal ?? calculateSubTotal(record)),
      subTotalDisplay: toMoneyString(record.subTotal ?? calculateSubTotal(record)),
      totalAmount: normalizeMoney(record.totalAmount),
      totalAmountDisplay: toMoneyString(record.totalAmount),
      amountPaid: normalizeMoney(record.amountPaid),
      amountPaidDisplay: toMoneyString(record.amountPaid),
      balanceDue: normalizeMoney(record.balanceDue ?? Math.max(0, normalizeMoney(record.totalAmount) - normalizeMoney(record.amountPaid))),
      balanceDueDisplay: toMoneyString(record.balanceDue ?? Math.max(0, normalizeMoney(record.totalAmount) - normalizeMoney(record.amountPaid))),
      paymentMethod: record.paymentMethod || '-',
      paymentDate: record.paymentDate || '-',
      referenceNumber: record.referenceNumber || '-',
      paymentStatus: record.paymentStatus || 'Unpaid',
      generatedAt: new Date().toISOString(),
    },
  })
}

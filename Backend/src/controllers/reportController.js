import { Appointment } from '../models/Appointment.js'
import { Consultation } from '../models/Consultation.js'
import { billingRecordSchema } from '../models/BillingRecord.js'
import { getPetDatabaseConnection } from '../config/petDb.js'
import { reportAnalyticsSnapshotSchema } from '../models/ReportAnalyticsSnapshot.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function formatBaht(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return '฿0.00'
  }
  return `฿${amount.toFixed(2)}`
}

function toDateOnlyString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateOnly(value) {
  const raw = normalizeText(value)
  if (!raw) {
    return null
  }
  const asDate = new Date(raw.length > 10 ? raw : `${raw}T00:00:00`)
  if (Number.isNaN(asDate.getTime())) {
    return null
  }
  return new Date(asDate.getFullYear(), asDate.getMonth(), asDate.getDate())
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function subtractDays(date, count) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() - count)
  return copy
}

function resolveRangeDates(range, fromDate, toDate) {
  const today = parseDateOnly(new Date().toISOString()) || new Date()
  if (range === 'custom') {
    const from = parseDateOnly(fromDate)
    const to = parseDateOnly(toDate)
    if (from && to && from <= to) {
      return { from, to }
    }
  }
  if (range === 'this-week') {
    return { from: subtractDays(today, 6), to: today }
  }
  if (range === 'last-month') {
    const previousMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return { from: startOfMonth(previousMonthDate), to: endOfMonth(previousMonthDate) }
  }
  return { from: startOfMonth(today), to: endOfMonth(today) }
}

function inRange(dateValue, from, to) {
  const parsed = parseDateOnly(dateValue)
  if (!parsed) {
    return false
  }
  return parsed >= from && parsed <= to
}

function groupCountBy(items, keySelector) {
  const counts = new Map()
  items.forEach((item) => {
    const key = keySelector(item)
    if (!key) {
      return
    }
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
}

function getMostFrequent(map, fallback = '-') {
  let topKey = fallback
  let topValue = 0
  map.forEach((value, key) => {
    if (value > topValue) {
      topKey = key
      topValue = value
    }
  })
  return topKey
}

function getBillingModel(connection) {
  return connection.models.BillingRecord || connection.model('BillingRecord', billingRecordSchema)
}

function getReportSnapshotModel(connection) {
  return connection.models.ReportAnalyticsSnapshot || connection.model('ReportAnalyticsSnapshot', reportAnalyticsSnapshotSchema)
}

async function loadAnalyticsData() {
  const connection = await getPetDatabaseConnection()
  const BillingRecord = getBillingModel(connection)
  const [appointments, consultations, billingRecords] = await Promise.all([
    Appointment.find({}).sort({ createdAt: -1 }).limit(5000),
    Consultation.find({}).sort({ createdAt: -1 }).limit(5000),
    BillingRecord.find({}).sort({ createdAt: -1 }).limit(5000),
  ])
  return { appointments, consultations, billingRecords }
}

function calculateAnalytics({ appointments, consultations, billingRecords, range, fromDate, toDate, doctorName, reportType }) {
  const normalizedDoctorName = normalizeText(doctorName)
  const activeDoctor = !normalizedDoctorName || normalizedDoctorName === 'All' ? '' : normalizedDoctorName
  const { from, to } = resolveRangeDates(range, fromDate, toDate)
  const today = parseDateOnly(new Date().toISOString()) || new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const doctorAppointments = activeDoctor
    ? appointments.filter((item) => normalizeText(item.doctorName) === activeDoctor)
    : appointments
  const filteredAppointments = doctorAppointments.filter((item) => inRange(item.appointmentDate, from, to))
  const appointmentIdSet = new Set(filteredAppointments.map((item) => String(item.id)))

  const doctorConsultations = activeDoctor
    ? consultations.filter((item) => normalizeText(item.doctorName) === activeDoctor)
    : consultations
  const filteredConsultations = doctorConsultations.filter((item) =>
    inRange(item.appointmentDate || item.createdAt, from, to)
  )

  const doctorBillingRecords = activeDoctor
    ? billingRecords.filter((item) => {
        const byDoctorName = normalizeText(item.doctorName) === activeDoctor
        const byAppointment = item.appointmentId && appointmentIdSet.has(String(item.appointmentId))
        return byDoctorName || byAppointment
      })
    : billingRecords
  const filteredBillingRecords = doctorBillingRecords.filter((item) => inRange(item.paymentDate || item.createdAt, from, to))
  const paidBillingRecords = doctorBillingRecords.filter((item) => normalizeText(item.paymentStatus) === 'Paid')
  const pendingBillingRecords = doctorBillingRecords.filter((item) => normalizeText(item.paymentStatus) === 'Pending')
  const failedBillingRecords = doctorBillingRecords.filter((item) => normalizeText(item.paymentStatus) === 'Failed')

  const dailyIncome = paidBillingRecords
    .filter((item) => inRange(item.paymentDate || item.createdAt, today, today))
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
  const monthlyIncome = paidBillingRecords
    .filter((item) => inRange(item.paymentDate || item.createdAt, monthStart, monthEnd))
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
  const totalPendingAmount = pendingBillingRecords
    .filter((item) => inRange(item.paymentDate || item.createdAt, monthStart, monthEnd))
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
  const totalAppointmentsPerMonth = doctorAppointments.filter((item) => inRange(item.appointmentDate, monthStart, monthEnd)).length

  const topDoctor = getMostFrequent(groupCountBy(filteredAppointments, (item) => normalizeText(item.doctorName)))
  const topIllness = getMostFrequent(
    groupCountBy(filteredConsultations, (item) => normalizeText(item.diagnosis).split(/[.,;|]/)[0]),
    'No diagnosis data'
  )

  const metrics = [
    { title: 'Daily Income', value: formatBaht(dailyIncome), note: 'Today collected amount' },
    { title: 'Monthly Income', value: formatBaht(monthlyIncome), note: 'Current month total' },
    { title: 'Most Visited Doctor', value: topDoctor, note: 'Highest appointment count' },
    { title: 'Most Common Pet Illness', value: topIllness, note: 'Top diagnosis trend' },
    { title: 'Total Appointments Per Month', value: String(totalAppointmentsPerMonth), note: 'Appointments this month' },
  ]

  const trendRows = []
  let cursor = new Date(from)
  let index = 1
  while (cursor <= to && index <= 8) {
    const bucketStart = new Date(cursor)
    const bucketEnd = new Date(cursor)
    bucketEnd.setDate(bucketEnd.getDate() + 6)
    if (bucketEnd > to) {
      bucketEnd.setTime(to.getTime())
    }

    const bucketAppointments = filteredAppointments.filter((item) => inRange(item.appointmentDate, bucketStart, bucketEnd))
    const bucketIncome = filteredBillingRecords
      .filter((item) => normalizeText(item.paymentStatus) === 'Paid' && inRange(item.paymentDate || item.createdAt, bucketStart, bucketEnd))
      .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
    const bucketTopDoctor = getMostFrequent(groupCountBy(bucketAppointments, (item) => normalizeText(item.doctorName)))

    trendRows.push({
      period: `Week ${index}`,
      income: formatBaht(bucketIncome),
      appointments: bucketAppointments.length,
      topDoctor: bucketTopDoctor,
    })

    cursor.setDate(cursor.getDate() + 7)
    index += 1
  }

  const insights = [
    {
      title: 'Most Visited Doctor',
      text: topDoctor === '-'
        ? 'No doctor visit data found for this filter.'
        : `${topDoctor} has the highest visit count in the selected range.`,
    },
    {
      title: 'Most Common Pet Illness',
      text: topIllness === 'No diagnosis data'
        ? 'No diagnosis records found for this filter.'
        : `${topIllness} appears most frequently in consultation records.`,
    },
    {
      title: 'Report Scope',
      text: `Range: ${toDateOnlyString(from)} to ${toDateOnlyString(to)} | Doctor: ${activeDoctor || 'All'} | Type: ${
        reportType || 'Financial + Operational'
      }`,
    },
    {
      title: 'Payment Summary',
      text: `Paid invoices: ${paidBillingRecords.length}, Pending invoices: ${pendingBillingRecords.length}, Failed invoices: ${failedBillingRecords.length}, Pending amount: ${formatBaht(
        totalPendingAmount
      )}.`,
    },
  ]

  return {
    filters: {
      range: range || 'this-month',
      fromDate: toDateOnlyString(from),
      toDate: toDateOnlyString(to),
      doctorName: activeDoctor || 'All',
      reportType: reportType || 'Financial + Operational',
    },
    metrics,
    trendRows,
    insights,
  }
}

export async function getReportsAnalytics(req, res) {
  const range = normalizeText(req.query.range) || 'this-month'
  const fromDate = normalizeText(req.query.fromDate)
  const toDate = normalizeText(req.query.toDate)
  const doctorName = normalizeText(req.query.doctorName) || 'All'
  const reportType = normalizeText(req.query.reportType) || 'Financial + Operational'

  const data = await loadAnalyticsData()
  const report = calculateAnalytics({ ...data, range, fromDate, toDate, doctorName, reportType })
  return res.status(200).json({ report })
}

export async function createReportsSnapshot(req, res) {
  const range = normalizeText(req.body.range) || 'this-month'
  const fromDate = normalizeText(req.body.fromDate)
  const toDate = normalizeText(req.body.toDate)
  const doctorName = normalizeText(req.body.doctorName) || 'All'
  const reportType = normalizeText(req.body.reportType) || 'Financial + Operational'

  const data = await loadAnalyticsData()
  const report = calculateAnalytics({ ...data, range, fromDate, toDate, doctorName, reportType })

  const connection = await getPetDatabaseConnection()
  const ReportSnapshot = getReportSnapshotModel(connection)
  const snapshot = await ReportSnapshot.create({
    range: report.filters.range,
    fromDate: report.filters.fromDate,
    toDate: report.filters.toDate,
    doctorName: report.filters.doctorName,
    reportType: report.filters.reportType,
    metrics: report.metrics,
    trendRows: report.trendRows,
    insights: report.insights,
  })

  return res.status(201).json({
    snapshot: {
      id: snapshot.id,
      range: snapshot.range,
      fromDate: snapshot.fromDate,
      toDate: snapshot.toDate,
      doctorName: snapshot.doctorName,
      reportType: snapshot.reportType,
      createdAt: snapshot.createdAt,
    },
  })
}

export async function listReportsSnapshots(req, res) {
  const connection = await getPetDatabaseConnection()
  const ReportSnapshot = getReportSnapshotModel(connection)
  const snapshots = await ReportSnapshot.find({}).sort({ createdAt: -1 }).limit(200)

  return res.status(200).json({
    snapshots: snapshots.map((item) => ({
      id: item.id,
      range: item.range,
      fromDate: item.fromDate,
      toDate: item.toDate,
      doctorName: item.doctorName,
      reportType: item.reportType,
      createdAt: item.createdAt,
    })),
  })
}

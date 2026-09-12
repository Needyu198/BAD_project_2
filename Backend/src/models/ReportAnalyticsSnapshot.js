import { createPostgresModel } from '../lib/postgresModel.js'

/* export const reportAnalyticsSnapshotSchema = new mongoose.Schema(
  {
    range: {
      type: String,
      trim: true,
      default: 'this-month',
    },
    fromDate: {
      type: String,
      trim: true,
      default: '',
    },
    toDate: {
      type: String,
      trim: true,
      default: '',
    },
    doctorName: {
      type: String,
      trim: true,
      default: 'All',
    },
    reportType: {
      type: String,
      trim: true,
      default: 'Financial + Operational',
    },
    metrics: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    trendRows: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    insights: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'report_analytics_snapshots',
  }
) */

export const ReportAnalyticsSnapshot = createPostgresModel('report_analytics_snapshots')
export const reportAnalyticsSnapshotSchema = null

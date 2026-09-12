import { createPostgresModel } from '../lib/postgresModel.js'

/* const actorSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: '' },
  },
  { _id: false }
)

const entitySchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    id: { type: String, trim: true, default: '' },
    label: { type: String, trim: true, default: '' },
  },
  { _id: false }
)

export const activityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    actor: { type: actorSchema, required: true, default: () => ({}) },
    entity: { type: entitySchema, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'activity_logs',
  }
)

) */

export const ActivityLog = createPostgresModel('activity_logs')
export const activityLogSchema = null

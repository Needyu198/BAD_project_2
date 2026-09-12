import { ActivityLog } from '../models/ActivityLog.js'

function normalizeText(value) {
  return String(value || '').trim()
}

function serializeActivityLog(item) {
  return {
    id: item.id,
    action: item.action,
    category: item.category,
    description: item.description || '',
    actor: {
      id: item.actor?.id || '',
      name: item.actor?.name || 'Unknown User',
      role: item.actor?.role || 'unknown',
    },
    entity: {
      type: item.entity?.type || '',
      id: item.entity?.id || '',
      label: item.entity?.label || '',
    },
    metadata: item.metadata || {},
    createdAt: item.createdAt,
  }
}

export async function listActivityLogs(req, res) {
  const category = normalizeText(req.query.category)
  const actorRole = normalizeText(req.query.actorRole)
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500)

  const query = {}
  if (category) {
    query.category = category
  }
  if (actorRole) {
    query['actor.role'] = actorRole
  }

  const logs = await ActivityLog.find(query).sort({ createdAt: -1 }).limit(limit)
  return res.status(200).json({ activityLogs: logs.map(serializeActivityLog) })
}

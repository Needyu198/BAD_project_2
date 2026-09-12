import { ActivityLog } from '../models/ActivityLog.js'

function normalizeText(value) {
  return String(value || '').trim()
}

export function getActorFromRequest(req, fallback = {}) {
  const body = req?.body && typeof req.body === 'object' ? req.body : {}
  const query = req?.query && typeof req.query === 'object' ? req.query : {}

  return {
    id:
      normalizeText(body.auditActorId) ||
      normalizeText(query.auditActorId) ||
      normalizeText(req?.headers?.['x-actor-id']) ||
      normalizeText(fallback.id),
    name:
      normalizeText(body.auditActorName) ||
      normalizeText(query.auditActorName) ||
      normalizeText(req?.headers?.['x-actor-name']) ||
      normalizeText(fallback.name) ||
      'Unknown User',
    role:
      normalizeText(body.auditActorRole) ||
      normalizeText(query.auditActorRole) ||
      normalizeText(req?.headers?.['x-actor-role']) ||
      normalizeText(fallback.role) ||
      'unknown',
  }
}

export async function recordActivityLog(entry) {
  try {
    await ActivityLog.create({
      action: normalizeText(entry.action),
      category: normalizeText(entry.category),
      description: normalizeText(entry.description),
      actor: {
        id: normalizeText(entry.actor?.id),
        name: normalizeText(entry.actor?.name) || 'Unknown User',
        role: normalizeText(entry.actor?.role) || 'unknown',
      },
      entity: {
        type: normalizeText(entry.entity?.type),
        id: normalizeText(entry.entity?.id),
        label: normalizeText(entry.entity?.label),
      },
      metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
    })
  } catch (error) {
    console.error('Failed to write activity log', error)
  }
}

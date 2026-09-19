import { Queue } from '../models/Queue.js'
import { User } from '../models/User.js'
import { emitQueueUpdated } from '../realtime/queueSocket.js'

// Matches the existing userId-based API convention; this is not session authentication.
export async function queueActor(req, res, next) {
  const userId = String(req.query.userId || '').trim()
  if (!userId) return res.status(400).json({ message: 'userId is required.' })
  const user = await User.findById(userId)
  if (!user || !['staff', 'pet-owner'].includes(user.role)) {
    return res.status(403).json({ message: 'A staff or pet-owner account is required.' })
  }
  req.queueActor = user
  next()
}

const ownerScope = (req) => req.queueActor.role === 'staff' ? null : req.queueActor.id

export async function checkIn(req, res) {
  const petId = typeof req.body?.petId === 'string' ? req.body.petId.trim() : ''
  if (!petId) return res.status(400).json({ message: 'petId is required.' })
  if (req.queueActor.role !== 'pet-owner') return res.status(403).json({ message: 'Check in using a pet-owner account.' })
  const id = await Queue.checkIn(req.queueActor.id, petId)
  emitQueueUpdated('checked-in', id)
  const data = await Queue.snapshot(req.queueActor.id, id)
  return res.status(201).json({ entry: data.queue[0] })
}

export async function listQueue(req, res) {
  const data = await Queue.snapshot(ownerScope(req))
  // Owners only need the public serving number, not another owner's details.
  if (req.queueActor.role !== 'staff') data.current = data.current ? { queueNumber: data.current.queueNumber } : null
  return res.json(data)
}

export async function currentQueue(req, res) {
  const { current } = await Queue.snapshot()
  return res.json({ current: current ? { queueNumber: current.queueNumber } : null })
}

export async function getQueue(req, res) {
  const data = await Queue.snapshot(ownerScope(req), req.params.id)
  if (!data.queue.length) return res.status(404).json({ message: 'Queue entry not found.' })
  return res.json({ entry: data.queue[0], current: data.current ? { queueNumber: data.current.queueNumber } : null })
}

export async function nextPatient(req, res) {
  if (req.queueActor.role !== 'staff') return res.status(403).json({ message: 'Staff access is required.' })
  const id = await Queue.next()
  emitQueueUpdated('next-called', id)
  if (!id) return res.json({ message: 'No patients waiting' })
  const data = await Queue.snapshot(null, id)
  return res.json({ entry: data.queue[0] })
}

export async function cancelQueue(req, res) {
  const id = await Queue.cancel(req.params.id, ownerScope(req))
  emitQueueUpdated('cancelled', id)
  const data = await Queue.snapshot(ownerScope(req), id)
  return res.json({ entry: data.queue[0] })
}

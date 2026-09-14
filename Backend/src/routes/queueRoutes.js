import { Router } from 'express'
import { queueActor, checkIn, listQueue, currentQueue, getQueue, nextPatient, cancelQueue } from '../controllers/queueController.js'

const queueRouter = Router()
queueRouter.use(queueActor)
queueRouter.post('/check-in', checkIn)
queueRouter.get('/', listQueue)
queueRouter.get('/current', currentQueue)
queueRouter.post('/next', nextPatient)
queueRouter.get('/:id', getQueue)
queueRouter.patch('/:id/cancel', cancelQueue)

export { queueRouter }

import { Router } from 'express'
import { listActivityLogs } from '../controllers/activityLogController.js'

const activityLogRouter = Router()

activityLogRouter.get('/', listActivityLogs)

export { activityLogRouter }

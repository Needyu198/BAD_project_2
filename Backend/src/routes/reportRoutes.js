import { Router } from 'express'
import { createReportsSnapshot, getReportsAnalytics, listReportsSnapshots } from '../controllers/reportController.js'

const reportRouter = Router()

reportRouter.get('/analytics', getReportsAnalytics)
reportRouter.get('/snapshots', listReportsSnapshots)
reportRouter.post('/snapshots', createReportsSnapshot)

export { reportRouter }

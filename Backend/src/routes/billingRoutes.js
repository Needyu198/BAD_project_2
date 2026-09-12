import { Router } from 'express'
import {
  createBillingRecord,
  getBillingReceipt,
  listBillingRecords,
  recordBillingPayment,
  updateBillingCharges,
} from '../controllers/billingController.js'

const billingRouter = Router()

billingRouter.get('/', listBillingRecords)
billingRouter.post('/', createBillingRecord)
billingRouter.put('/:billingId/charges', updateBillingCharges)
billingRouter.put('/:billingId/payment', recordBillingPayment)
billingRouter.get('/:billingId/receipt', getBillingReceipt)

export { billingRouter }

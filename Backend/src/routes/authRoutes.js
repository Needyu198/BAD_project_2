import { Router } from 'express'
import { login, register, requestPasswordReset, resetPassword } from '../controllers/authController.js'

const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.post('/forgot-password', requestPasswordReset)
authRouter.post('/reset-password', resetPassword)

export { authRouter }

import { useState } from 'react'
import '../css/login.css'
import { requestPasswordReset, resetPasswordWithToken } from '../../../lib/api'

export default function ForgotPassword({ onBackToLogin }) {
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [resetTokenPreview, setResetTokenPreview] = useState('')
  const [isRequestingReset, setIsRequestingReset] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const handleRequestReset = async (event) => {
    event.preventDefault()
    if (isRequestingReset) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('forgot-email') || '').trim()

    try {
      setError('')
      setStatus('')
      setIsRequestingReset(true)
      const response = await requestPasswordReset({ email })
      setResetTokenPreview(String(response?.resetToken || ''))
      setStatus(
        response?.resetToken
          ? 'Reset token generated. Use the token below to set a new password.'
          : 'Password reset request submitted.'
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsRequestingReset(false)
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (isResettingPassword) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('reset-email') || '').trim()
    const token = String(formData.get('reset-token') || '').trim()
    const newPassword = String(formData.get('reset-new-password') || '')

    try {
      setError('')
      setStatus('')
      setIsResettingPassword(true)
      await resetPasswordWithToken({ email, token, newPassword })
      setStatus('Password reset successfully. You can now go back and log in.')
      setResetTokenPreview('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <main className="login-form-screen">
      <section className="login-form-card">
        <div className="login-form-logo" role="img" aria-label="PawEver logo">
          PawEver
        </div>
        <h1 className="login-form-title">Forgot Password</h1>
        <p className="login-form-subtitle">
          Reset password using a temporary token (local demo flow).
        </p>

        <form className="login-form" onSubmit={handleRequestReset}>
          <label className="login-form-label" htmlFor="forgot-email">
            Email
          </label>
          <input
            className="login-form-input"
            id="forgot-email"
            name="forgot-email"
            type="email"
            placeholder="you@example.com"
            required
          />
          <button className="login-submit-btn" type="submit" disabled={isRequestingReset}>
            {isRequestingReset ? 'Generating token...' : 'Get Reset Token'}
          </button>
        </form>

        {resetTokenPreview ? (
          <p className="login-form-note" style={{ wordBreak: 'break-all' }}>
            Reset token: <strong>{resetTokenPreview}</strong>
          </p>
        ) : null}

        <form className="login-form" onSubmit={handleResetPassword}>
          <label className="login-form-label" htmlFor="reset-email">
            Email
          </label>
          <input
            className="login-form-input"
            id="reset-email"
            name="reset-email"
            type="email"
            placeholder="you@example.com"
            required
          />

          <label className="login-form-label" htmlFor="reset-token">
            Reset Token
          </label>
          <input
            className="login-form-input"
            id="reset-token"
            name="reset-token"
            type="text"
            placeholder="Paste reset token"
            required
          />

          <label className="login-form-label" htmlFor="reset-new-password">
            New Password
          </label>
          <input
            className="login-form-input"
            id="reset-new-password"
            name="reset-new-password"
            type="password"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />

          <button className="login-submit-btn" type="submit" disabled={isResettingPassword}>
            {isResettingPassword ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        {error ? <p className="form-status-error">{error}</p> : null}
        {status ? <p className="login-form-note">{status}</p> : null}

        <button className="login-back-btn" type="button" onClick={onBackToLogin}>
          Back to login
        </button>
      </section>
    </main>
  )
}

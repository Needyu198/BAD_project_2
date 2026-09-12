import { useState } from 'react'
import '../css/login.css'
import { loginUser } from '../../../lib/api'
import logo from '../../../images/Web_Logo.png'
 
export default function Login({ onBack, onContinue, onForgotPassword }) {
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
 
  const handleSubmit = async (event) => {
    event.preventDefault()
 
    if (isSubmitting) {
      return
    }
 
    const formData = new FormData(event.currentTarget)
    const role = formData.get('login-role')
    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
 
    try {
      setError('')
      setIsSubmitting(true)
 
      const response = await loginUser({ email, password, role })
      onContinue(response?.user || { role })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-form-screen">
      <section className="login-form-card">
        <img className="login-form-logo" src={logo} alt="PawEver logo" />
        <h1 className="login-form-title">Log In</h1>
        <p className="login-form-subtitle">Welcome back. Enter your account details.</p>
 
        <form className="login-form" onSubmit={handleSubmit}>
          <fieldset className="login-role-group">
            <legend className="login-form-label">I am a</legend>
            <div className="login-role-options">
              <label className="login-role-option">
                <input defaultChecked name="login-role" type="radio" value="pet-owner" />
                <span>Pet Owner</span>
              </label>
              <label className="login-role-option">
                <input name="login-role" type="radio" value="doctor" />
                <span>Doctor</span>
              </label>
              <label className="login-role-option">
                <input name="login-role" type="radio" value="staff" />
                <span>Staff</span>
              </label>
            </div>
          </fieldset>
 
          <label className="login-form-label" htmlFor="email">
            Email
          </label>
          <input
            className="login-form-input"
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
 
          <label className="login-form-label" htmlFor="password">
            Password
          </label>
          <input
            className="login-form-input"
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
 
          <div className="login-form-meta">
            <label className="remember-me">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <button
              className="forgot-link-btn"
              type="button"
              onClick={onForgotPassword}
            >
              Forgot password?
            </button>
          </div>
 
          <button className="login-submit-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Continue'}
          </button>
          {error ? <p className="form-status-error">{error}</p> : null}
          <p className="login-form-note">Secure login protected with encrypted sessions.</p>
        </form>

        <button className="login-back-btn" type="button" onClick={onBack}>
          Back to options
        </button>
      </section>
    </main>
  )
}
 
 

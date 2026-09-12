import '../../styles/Login/loginoption.css'
import logo from '../../images/Web_Logo.png'

export default function LoginOption({ onLoginClick, onCreateAccountClick }) {
  return (
    <main className="login-screen">
      <section className="login-card">
        <img className="login-logo-icon" src={logo} alt="PawEver logo" />
        <p className="login-greeting">Welcome to PawEver</p>
        <p className="login-subtitle">Manage profiles, appointments, records, and reminders in one place.</p>
        <ul className="login-benefits" aria-label="App benefits">
          <li>Track all pets in one account</li>
          <li>Book doctors in minutes</li>
          <li>Get vaccine reminders on time</li>
        </ul>

        <div className="login-actions">
          <button
            className="register-btn"
            type="button"
            aria-label="Create a new account"
            onClick={onCreateAccountClick}
          >
            <span className="register-btn-label">Create Account</span>
            <span className="register-btn-arrow" aria-hidden="true">
              ›
            </span>
          </button>

          <button
            className="login-link-btn"
            type="button"
            aria-label="Log in to your account"
            onClick={onLoginClick}
          >
            I already have an account
          </button>
        </div>
      </section>
    </main>
  )
}

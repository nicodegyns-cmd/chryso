import * as authService from '../services/authService'

export default function GoogleLoginButton() {
  return (
    <button className="google-btn" onClick={() => authService.signInWithGoogle()}>
      <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1-1.3 3-5.1 3-3 0-5.5-2.5-5.5-5.6s2.5-5.6 5.5-5.6c1.7 0 2.8.7 3.4 1.3l2.3-2.2C17 3 15.1 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.7 0 9.5-4 9.5-9.6 0-.7-.1-1.2-.2-1.7H12z" />
      </svg>
      Se connecter avec Google
    </button>
  )
}

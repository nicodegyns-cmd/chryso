import LogoHeader from '../components/LogoHeader'
import LoginForm from '../components/LoginForm'
import GoogleLoginButton from '../components/GoogleLoginButton'

export default function LoginPage() {
  return (
    <div className="page-root">
      <div className="login-card">
        <LogoHeader />
        <LoginForm />
        <div className="divider">ou</div>
        <GoogleLoginButton />
      </div>
    </div>
  )
}

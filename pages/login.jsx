import LogoHeader from '../components/LogoHeader'
import LoginForm from '../components/LoginForm'

export default function LoginPage() {
  return (
    <div className="page-root login-page">
      <div className="login-card">
        <LogoHeader />
        <LoginForm />
      </div>
    </div>
  )
}

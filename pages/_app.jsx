import '../styles/globals.css'
import '../pages/admin/rib-validation.module.css'
import '../pages/documents.module.css'
import Image from 'next/image'

function DevFooter() {
  return (
    <footer style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: '10px 20px',
      background: '#1a1a2e',
      borderTop: '1px solid #2d2d4e',
      marginTop: 'auto',
    }}>
      <span style={{ color: '#9ca3af', fontSize: 12 }}>Développé par</span>
      <Image
        src="/nexio-seven-logo.png"
        alt="Nexio Seven"
        width={90}
        height={36}
        style={{ objectFit: 'contain' }}
        priority={false}
      />
    </footer>
  )
}

export default function App({ Component, pageProps }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Component {...pageProps} />
      <DevFooter />
    </div>
  )
}

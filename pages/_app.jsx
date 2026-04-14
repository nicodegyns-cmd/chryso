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
      gap: 4,
      padding: '4px 20px',
      background: '#1a1a2e',
      borderTop: '1px solid #2d2d4e',
      marginTop: 'auto',
      height: 56,
    }}>
      <span style={{ color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>Développé par</span>
      <Image
        src="/nexio-seven-logo.png"
        alt="Nexio Seven"
        width={200}
        height={48}
        style={{ objectFit: 'contain', display: 'block' }}
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

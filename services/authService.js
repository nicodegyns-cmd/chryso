export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })

  // Try to parse JSON, but handle non-JSON responses (HTML error pages)
  const contentType = res.headers.get('content-type') || ''
  let data
  if (contentType.includes('application/json')) {
    data = await res.json()
  } else {
    // read text for debugging and throw
    const text = await res.text()
    throw new Error(`Unexpected response from server: ${text.slice(0, 200)}`)
  }

  if (!res.ok) throw new Error(data?.error || 'Erreur serveur')
  if (data.token) localStorage.setItem('token', data.token)
  return data
}

export function signInWithGoogle() {
  // Simple redirect to backend OAuth bootstrap endpoint.
  // Backend should redirect user to Google and then back with a code/token.
  window.location.href = '/api/auth/google'
}

export async function requestPasswordReset(email) {
  const res = await fetch('/api/auth/forgot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Erreur serveur')
  return data
}

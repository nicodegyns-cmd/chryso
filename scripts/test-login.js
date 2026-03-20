(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nicodegyns@gmail.com', password: '1234' }),
      // set a 10s timeout if available via AbortController
    })
    console.log('STATUS', res.status)
    const text = await res.text()
    console.log('BODY:', text)
  } catch (err) {
    console.error('ERROR', err)
  }
})()

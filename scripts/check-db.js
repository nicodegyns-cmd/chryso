(async () => {
  try {
    const mysql = require('mysql2/promise')
    const conn = await mysql.createConnection({ host: '127.0.0.1', user: 'root', database: 'chryso', connectTimeout: 5000 })
    const [rows] = await conn.query('SELECT 1 AS ok')
    console.log('DB OK:', rows)
    await conn.end()
  } catch (err) {
    console.error('DB ERROR:', err.message || err)
    process.exit(1)
  }
})()

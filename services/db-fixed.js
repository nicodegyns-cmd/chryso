const { Pool: PgPool } = require('pg')
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

// Always load .env, even in production - with explicit path
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') })
// Also try loading from app root if not found above
if (!process.env.DB_HOST) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
}

let poolInstance = null

// MySQL native pool wrapper
class MySQLPoolAdapter {
  constructor(pool) {
    this.pool = pool
  }

  async query(sql, params = []) {
    try {
      const [rows, fields] = await this.pool.query(sql, params)
      return { rows, fields }
    } catch (err) {
      console.error('MySQL Query Error:', err.message)
      throw err
    }
  }

  async execute(sql, params = []) {
    try {
      const [result] = await this.pool.execute(sql, params)
      return [
        { insertId: result.insertId, affectedRows: result.affectedRows },
        null
      ]
    } catch (err) {
      console.error('MySQL Execute Error:', err.message)
      throw err
    }
  }

  async getConnection() {
    const connection = await this.pool.getConnection()
    return new MySQLConnectionAdapter(connection)
  }

  async end() {
    await this.pool.end()
  }
}

class MySQLConnectionAdapter {
  constructor(connection) {
    this.connection = connection
  }

  async query(sql, params = []) {
    const [rows, fields] = await this.connection.query(sql, params)
    return { rows, fields }
  }

  async release() {
    return this.connection.release()
  }
}

// PostgreSQL pool wrapper - converts MySQL syntax to PostgreSQL
class PostgreSQLPoolAdapter {
  constructor(pool) {
    this.pool = pool
  }

  convertQuery(sql, params = []) {
    let paramIndex = 1
    const convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`)
    return { sql: convertedSql, params }
  }

  async query(sql, params = []) {
    try {
      const { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
      console.log('[DB SQL]', convertedSql, convertedParams)
      const result = await this.pool.query(convertedSql, convertedParams)
      const arr = [result.rows, result.fields]
      arr.rows = result.rows
      arr.fields = result.fields
      return arr
    } catch (err) {
      try {
        const { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
        console.error('[DB ERROR SQL] QUERY', convertedSql, convertedParams)
      } catch (e) {
        // ignore
      }
      console.error('PostgreSQL Query Error:', err && err.stack ? err.stack : err)
      throw err
    }
  }

  async execute(sql, params = []) {
    try {
      let { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
      console.log('[DB EXEC]', convertedSql, convertedParams)
      
      if (convertedSql.trim().toUpperCase().startsWith('INSERT') && !convertedSql.toUpperCase().includes('RETURNING')) {
        convertedSql = convertedSql.trim().replace(/;?\s*$/, ' RETURNING id')
      }
      
      const result = await this.pool.query(convertedSql, convertedParams)
      return [{
        insertId: result.rows[0]?.id || null,
        affectedRows: result.rowCount || 0
      }, null]
    } catch (err) {
      try {
        const { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
        console.error('[DB ERROR SQL] EXECUTE', convertedSql, convertedParams)
      } catch (e) {
        // ignore
      }
      console.error('PostgreSQL Execute Error:', err && err.stack ? err.stack : err)
      throw err
    }
  }

  async getConnection() {
    const connection = await this.pool.connect()
    return new PostgreSQLConnectionAdapter(connection)
  }

  async end() {
    await this.pool.end()
  }
}

class PostgreSQLConnectionAdapter {
  constructor(connection) {
    this.connection = connection
  }

  convertQuery(sql, params = []) {
    let paramIndex = 1
    const convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`)
    return { sql: convertedSql, params }
  }

  async query(sql, params = []) {
    try {
      const { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
      console.log('[DB CONN SQL]', convertedSql, convertedParams)
      const result = await this.connection.query(convertedSql, convertedParams)
      const arr = [result.rows, result.fields]
      arr.rows = result.rows
      arr.fields = result.fields
      return arr
    } catch (err) {
      try {
        const { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
        console.error('[DB ERROR SQL] CONN QUERY', convertedSql, convertedParams)
      } catch (e) {
        // ignore
      }
      console.error('PostgreSQL Connection Query Error:', err && err.stack ? err.stack : err)
      throw err
    }
  }

  async release() {
    return this.connection.release()
  }
}

// Create and configure the pool
function createPool() {
  console.log('[DB INIT] NODE_ENV:', process.env.NODE_ENV)
  console.log('[DB INIT] DATABASE_URL from env:', (process.env.DATABASE_URL || 'NOT SET'))
  console.log('[DB INIT] DB_HOST from env:', process.env.DB_HOST || 'NOT SET')
  console.log('[DB INIT] DB_PORT from env:', process.env.DB_PORT || 'NOT SET')
  console.log('[DB INIT] DB_NAME from env:', process.env.DB_NAME || 'NOT SET')
  console.log('[DB INIT] DB_USER from env:', process.env.DB_USER || 'NOT SET')
  
  let DATABASE_URL = process.env.DATABASE_URL || ''
  
  if (!DATABASE_URL) {
    const user = process.env.DB_USER || 'fenix'
    const password = process.env.DB_PASSWORD || 'Toulouse94'
    const host = process.env.DB_HOST || 'ay177071-001.eu.clouddb.ovh.net'
    const port = process.env.DB_PORT || '35230'
    const dbname = process.env.DB_NAME || 'fenix'
    
    if (password) {
      DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${dbname}`
    } else {
      DATABASE_URL = `postgresql://${user}@${host}:${port}/${dbname}`
    }
    console.log('[DB INIT] Using OVH PostgreSQL with:', { host, port, dbname, user: user + '***' })
  }
  
  console.log('[DB INIT] FINAL DATABASE_URL:', DATABASE_URL.substring(0, 80))
  const DB_CLIENT = (process.env.DB_CLIENT || '').toLowerCase()

  let isMySQL
  if (DB_CLIENT === 'mysql') {
    isMySQL = true
  } else if (DB_CLIENT === 'pg' || DB_CLIENT === 'postgres' || DB_CLIENT === 'postgresql') {
    isMySQL = false
  } else {
    isMySQL = DATABASE_URL.startsWith('mysql://')
  }

  if (isMySQL) {
    console.log('[DB] Using MySQL (by DB_CLIENT/DATABASE_URL):', DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown')
    const url = new URL(DATABASE_URL)
    const mysqlPool = mysql.createPool({
      host: url.hostname,
      user: url.username || 'root',
      password: url.password || '',
      database: url.pathname.slice(1),
      port: url.port || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })
    return new MySQLPoolAdapter(mysqlPool)
  }

  console.log('[DB] Using PostgreSQL (by DB_CLIENT/DATABASE_URL):', DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown')

  const pgOptions = { connectionString: DATABASE_URL }
  try {
    const caPath = '/etc/ssl/ovh/ovh-ca.pem'
    if (fs.existsSync(caPath)) {
      try {
        const ca = fs.readFileSync(caPath, 'utf8')
        pgOptions.ssl = { ca, rejectUnauthorized: true }
        console.log('[DB] Using custom OVH CA for Postgres TLS verification')
      } catch (readErr) {
        console.warn('[DB] Unable to read custom OVH CA file, using system defaults:', readErr.message)
        pgOptions.ssl = { rejectUnauthorized: true }
      }
    } else {
      pgOptions.ssl = { rejectUnauthorized: true }
      console.log('[DB] Using system CA bundle for Postgres TLS verification')
    }
  } catch (e) {
    console.warn('[DB] Error while configuring Postgres TLS:', e && e.message ? e.message : e)
    pgOptions.ssl = { rejectUnauthorized: false }
  }

  const pgPool = new PgPool(pgOptions)
  return new PostgreSQLPoolAdapter(pgPool)
}

function getPool() {
  if (!poolInstance) {
    poolInstance = createPool()
  }
  return poolInstance
}

async function query(sql, params = []) {
  const pool = getPool()
  try {
    console.log('[DB CALL] named query', sql, params)
    const result = await pool.query(sql, params)
    const rows = result.rows || result[0]
    const fields = result.fields || result[1]
    const arr = [rows, fields]
    arr.rows = rows
    arr.fields = fields
    return arr
  } catch (err) {
    try {
      if (pool && typeof pool.convertQuery === 'function') {
        const c = pool.convertQuery(sql, params)
        console.error('[DB ERROR SQL] named query', c.sql, c.params)
      } else {
        console.error('[DB ERROR SQL] named query (raw)', sql, params)
      }
    } catch (e) {}
    console.error('named query error', err && err.stack ? err.stack : err)
    throw err
  }
}

module.exports = {
  getPool,
  query,
  executeQuery: query,
  executeNamedQuery: query,
  closePool: async () => {
    if (poolInstance) {
      await poolInstance.end()
      poolInstance = null
    }
  }
}

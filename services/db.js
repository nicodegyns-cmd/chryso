const { Pool: PgPool } = require('pg')
const mysql = require('mysql2/promise')
const fs = require('fs')

// Always load .env, even in production - environment variables should be available
require('dotenv').config()

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
      // Always emit the converted SQL and params so PM2 captures it for debugging
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
      // Always emit execute SQL for debugging
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
      // Always emit connection-level SQL for debugging
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
  let DATABASE_URL = process.env.DATABASE_URL || ''
  
  // If DATABASE_URL not provided, construct from individual DB_* variables
  if (!DATABASE_URL && process.env.DB_HOST) {
    const user = process.env.DB_USER || ''
    const password = process.env.DB_PASSWORD || ''
    const host = process.env.DB_HOST
    const port = process.env.DB_PORT || 5432
    const dbname = process.env.DB_NAME || 'postgres'
    
    if (password) {
      DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${dbname}`
    } else {
      DATABASE_URL = `postgresql://${user}@${host}:${port}/${dbname}`
    }
    console.log('[DB] Constructed DATABASE_URL from DB_* variables:', DATABASE_URL.replace(/:[^:/@]*@/, ':***@'))
  }
  
  const DB_CLIENT = (process.env.DB_CLIENT || '').toLowerCase()

  // Prefer explicit DB_CLIENT env if provided, otherwise detect from DATABASE_URL
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

  // Fallback to PostgreSQL
  console.log('[DB] Using PostgreSQL (by DB_CLIENT/DATABASE_URL):', DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown')

  const pgOptions = { connectionString: DATABASE_URL }
  try {
    const fs = require('fs')
    // For OVH CloudDB or standard deployments, try custom CA first, then fall back to system defaults
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
      // No custom CA file - let Node.js use system CA bundle (standard for OVH CloudDB)
      pgOptions.ssl = { rejectUnauthorized: true }
      console.log('[DB] Using system CA bundle for Postgres TLS verification')
    }
    
    // Allow override if explicitly disabled
    if (process.env.PG_INSECURE_TLS === '1') {
      pgOptions.ssl = { rejectUnauthorized: false }
      console.warn('[DB] PG_INSECURE_TLS=1 enabled — Postgres TLS verification DISABLED')
    }
  } catch (e) {
    console.warn('[DB] Error while configuring Postgres TLS:', e && e.message ? e.message : e)
    pgOptions.ssl = { rejectUnauthorized: false }
  }

  // Log TLS debug info to help diagnose DEPTH_ZERO_SELF_SIGNED_CERT issues
  try {
    if (pgOptions.ssl) {
      try {
        const crypto = require('crypto')
        const ca = pgOptions.ssl.ca || ''
        const fingerprint = ca ? crypto.createHash('sha1').update(ca, 'utf8').digest('hex').toUpperCase().match(/.{2}/g).join(':') : 'none'
        console.log('[DB] pgOptions.ssl present: true, rejectUnauthorized:', !!pgOptions.ssl.rejectUnauthorized, 'CA fingerprint(SHA1):', fingerprint)
      } catch (e) {
        console.warn('[DB] Failed to compute CA fingerprint:', e && e.message)
      }
    } else {
      console.log('[DB] pgOptions.ssl not present — no CA configured')
    }
  } catch (e) {
    console.warn('[DB] Error logging pgOptions.ssl info:', e && e.message)
  }
  // Ensure TLS `servername` matches the certificate's altname when possible.
  // Some OVH CloudDB certificates use a short hostname (e.g. "ay177071-001")
  // while the connection host is a longer FQDN. Set `ssl.servername` to the
  // short label (or an explicit env `PG_SSL_SERVERNAME`) so Node's
  // checkServerIdentity sees the expected name and avoids
  // ERR_TLS_CERT_ALTNAME_INVALID.
  try {
    if (!pgOptions.ssl) pgOptions.ssl = {}
    const explicit = process.env.PG_SSL_SERVERNAME
    if (explicit) {
      pgOptions.ssl.servername = explicit
    } else if (process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL)
        const shortName = (url.hostname || '').split('.')[0]
        if (shortName) pgOptions.ssl.servername = shortName
      } catch (e) {
        // ignore URL parse errors
      }
    }
    if (pgOptions.ssl.servername) console.log('[DB] pgOptions.ssl.servername:', pgOptions.ssl.servername)
  } catch (e) {
    /* no-op */
  }

  // If the certificate uses a short SAN (e.g. "ay177071-001") while the
  // connection uses a FQDN (e.g. "ay177071-001.eu.clouddb.ovh.net"), Node's
  // default hostname verification will fail. Add a targeted `checkServerIdentity`
  // that accepts the certificate when its SAN contains the expected short name.
  try {
    const tls = require('tls')
    let expectedName = (pgOptions.ssl && pgOptions.ssl.servername) || process.env.PG_SSL_SERVERNAME
    if (!expectedName && process.env.DATABASE_URL) {
      try {
        const u = new URL(process.env.DATABASE_URL)
        expectedName = (u.hostname || '').split('.')[0]
      } catch (e) {
        expectedName = null
      }
    }

    if (expectedName) {
      pgOptions.ssl = pgOptions.ssl || {}
      pgOptions.ssl.checkServerIdentity = (servername, cert) => {
        try {
          const san = cert && cert.subjectaltname ? cert.subjectaltname : ''
          if (san && san.includes(`DNS:${expectedName}`)) return undefined
        } catch (e) {
          // fall through to default check
        }
        return tls.checkServerIdentity(servername, cert)
      }
      console.log('[DB] pgOptions.ssl.checkServerIdentity set to accept SAN containing:', expectedName)
    }
  } catch (e) {
    /* ignore; best-effort only */
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
    // Always log named queries so we can capture SQL/params in PM2 logs
    console.log('[DB CALL] named query', sql, params)
    const result = await pool.query(sql, params)
    // Ensure we return an array-like result compatible with both
    // destructuring (const [rows, fields] = ...) and property access (res.rows)
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
    } catch (e) { /* ignore */ }
    console.error('named query error', err && err.stack ? err.stack : err)
    throw err
  }
}

// Ensure compiled bundles that expect a default callable export work.
function dbFactory() {
  return defaultExport()
}

// Attach common interop shapes so compiled bundles and ESM interop work:
// - `require('./services/db')` is a callable function
// - `require('./services/db').default` is the callable factory
// - named exports like `.getPool` and `.query` are available
dbFactory.default = dbFactory
dbFactory.getPool = getPool
dbFactory.query = query
dbFactory.__esModule = true

module.exports = dbFactory

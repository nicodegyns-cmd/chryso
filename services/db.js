const { Pool: PgPool } = require('pg')
const path = require('path')
const fs = require('fs')

// CRITICAL: Load .env file directly and FORCE process.env to ensure PostgreSQL connection
// Do this BEFORE any other code that might have set process.env.DATABASE_URL to old MySQL value
function loadEnv() {
  try {
    // Try multiple paths - relative and absolute
    // In production with __dirname, it may point to .next/server/chunks, not project root
    const possiblePaths = [
      // Try relative from likely compiled location
      path.resolve(__dirname, '..', '..', '..', '.env'),  // From .next/server/chunks
      path.resolve(__dirname, '..', '.env'),                // From .next/server
      // Try absolute path based on NODE_ENV
      '/home/ubuntu/chryso/.env',                           // Production VPS path
      '/var/www/chryso/.env',                               // Alternative production
      process.cwd() + '/.env'                               // From working directory
    ]
    
    for (const envFile of possiblePaths) {
      if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8')
        const lines = envContent.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=')
            const value = valueParts.join('=').trim()
            if (key && value) {
              // FORCE override - directly set process.env
              process.env[key] = value
            }
          }
        }
        console.log('[DB] ✓ .env loaded from:', envFile)
        console.log('[DB] DATABASE_URL is now:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 60) + '...' : 'NOT SET')
        return  // Success, exit
      }
    }
    console.warn('[DB] WARNING: .env not found in any expected location')
  } catch (err) {
    console.error('[DB] Error loading .env file:', err.message)
  }
}

// Load .env IMMEDIATELY, before anything else runs
loadEnv()

let poolInstance = null

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


function createPool() {
  // Debug: log environment variables at startup
  console.log('[DB INIT] NODE_ENV:', process.env.NODE_ENV)
  console.log('[DB INIT] DATABASE_URL from env:', (process.env.DATABASE_URL || 'NOT SET'))
  console.log('[DB INIT] DB_HOST from env:', process.env.DB_HOST || 'NOT SET')
  console.log('[DB INIT] DB_PORT from env:', process.env.DB_PORT || 'NOT SET')
  console.log('[DB INIT] DB_NAME from env:', process.env.DB_NAME || 'NOT SET')
  console.log('[DB INIT] DB_USER from env:', process.env.DB_USER || 'NOT SET')
  
  let DATABASE_URL = process.env.DATABASE_URL || ''
  
  // Fix short hostname to FQDN if necessary
  if (DATABASE_URL && DATABASE_URL.includes('@ay177071-001:') && !DATABASE_URL.includes('ay177071-001.')) {
    DATABASE_URL = DATABASE_URL.replace('@ay177071-001:', '@ay177071-001.eu.clouddb.ovh.net:')
    console.log('[DB INIT] Fixed short hostname to FQDN')
  }
  
  // If DATABASE_URL not provided, construct from individual DB_* variables or use OVH defaults
  if (!DATABASE_URL) {
    const user = process.env.DB_USER || 'fenix'
    const password = process.env.DB_PASSWORD || 'Toulouse94'
    const host = process.env.DB_HOST || 'ay177071-001.eu.clouddb.ovh.net'
    const port = process.env.DB_PORT || '35230'
    const dbname = process.env.DB_NAME || 'fenix'
    
    DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${dbname}`
    console.log('[DB INIT] HARDCODED OVH PostgreSQL - host:', host, 'port:', port)
  }
  
  console.log('[DB INIT] FINAL DATABASE_URL:', DATABASE_URL.substring(0, 80))
  console.log('[DB INIT] DATABASE_URL includes ?:', DATABASE_URL.includes('?'))
  
  // Strip sslmode query param if present (causes routing issues)
  if (DATABASE_URL.includes('?sslmode=disable')) {
    DATABASE_URL = DATABASE_URL.replace('?sslmode=disable', '')
    console.log('[DB INIT] Removed sslmode=disable query param')
  }
  
  // Fallback to PostgreSQL
  console.log('[DB] Using PostgreSQL:', DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown')

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
    console.log('[DB CALL] query', sql, params)
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
        console.error('[DB ERROR SQL] query', c.sql, c.params)
      } else {
        console.error('[DB ERROR SQL] query (raw)', sql, params)
      }
    } catch (e) { /* ignore */ }
    console.error('query error', err && err.stack ? err.stack : err)
    throw err
  }
}

async function closePool() {
  if (poolInstance) {
    await poolInstance.end()
    poolInstance = null
  }
}

// Export both CommonJS and ES6 style for compatibility
const dbExports = {
  getPool,
  query,
  executeQuery: query,
  executeNamedQuery: query,
  closePool
}

// Support ES6 default import
dbExports.default = dbExports

module.exports = dbExports


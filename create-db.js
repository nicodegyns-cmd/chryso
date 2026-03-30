const fs = require('fs');
const path = require('path');

const dbContent = `const { Pool: PgPool } = require('pg')
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') })
if (!process.env.DB_HOST) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
}

let poolInstance = null

class MySQLPoolAdapter {
  constructor(pool) { this.pool = pool }
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
      return [{ insertId: result.insertId, affectedRows: result.affectedRows }, null]
    } catch (err) {
      console.error('MySQL Execute Error:', err.message)
      throw err
    }
  }
  async getConnection() {
    const connection = await this.pool.getConnection()
    return new MySQLConnectionAdapter(connection)
  }
  async end() { await this.pool.end() }
}

class MySQLConnectionAdapter {
  constructor(connection) { this.connection = connection }
  async query(sql, params = []) {
    const [rows, fields] = await this.connection.query(sql, params)
    return { rows, fields }
  }
  async release() { return this.connection.release() }
}

class PostgreSQLPoolAdapter {
  constructor(pool) { this.pool = pool }
  convertQuery(sql, params = []) {
    let paramIndex = 1
    const convertedSql = sql.replace(/\\?/g, () => \`\\\$\${paramIndex++}\`)
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
      console.error('PostgreSQL Query Error:', err && err.stack ? err.stack : err)
      throw err
    }
  }
  async execute(sql, params = []) {
    try {
      let { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
      const result = await this.pool.query(convertedSql, convertedParams)
      return [{ insertId: result.rows[0] ? result.rows[0].id : null, affectedRows: result.rowCount || 0 }, null]
    } catch (err) {
      console.error('PostgreSQL Execute Error:', err && err.stack ? err.stack : err)
      throw err
    }
  }
  async getConnection() {
    const connection = await this.pool.connect()
    return new PostgreSQLConnectionAdapter(connection)
  }
  async end() { await this.pool.end() }
}

class PostgreSQLConnectionAdapter {
  constructor(connection) { this.connection = connection }
  convertQuery(sql, params = []) {
    let paramIndex = 1
    const convertedSql = sql.replace(/\\?/g, () => \`\\\$\${paramIndex++}\`)
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
      console.error('PostgreSQL Connection Query Error:', err)
      throw err
    }
  }
  async release() { return this.connection.release() }
}

function createPool() {
  console.log('[DB INIT] NODE_ENV:', process.env.NODE_ENV)
  console.log('[DB INIT] DATABASE_URL:', (process.env.DATABASE_URL || 'NOT SET').substring(0, 50))
  
  let DATABASE_URL = process.env.DATABASE_URL || ''
  
  if (!DATABASE_URL) {
    const user = process.env.DB_USER || 'fenix'
    const password = process.env.DB_PASSWORD || 'Toulouse94'
    const host = process.env.DB_HOST || 'ay177071-001.eu.clouddb.ovh.net'
    const port = process.env.DB_PORT || '35230'
    const dbname = process.env.DB_NAME || 'fenix'
    
    DATABASE_URL = \`postgresql://\${user}:\${password}@\${host}:\${port}/\${dbname}\`
    console.log('[DB INIT] Using OVH defaults with host:', host)
  }
  
  const DB_CLIENT = (process.env.DB_CLIENT || '').toLowerCase()
  let isMySQL = DB_CLIENT === 'mysql' || DATABASE_URL.startsWith('mysql://')

  if (isMySQL) {
    console.log('[DB] Using MySQL')
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

  console.log('[DB] Using PostgreSQL with host:', DATABASE_URL.split('@')[1].split(':')[0])
  const pgOptions = { connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }
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
    console.error('named query error', err)
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
}`;

const dbPath = '/home/ubuntu/chryso/services/db.js';
fs.writeFileSync(dbPath, dbContent, 'utf8');
console.log('SUCCESS: db.js created at ' + dbPath);
process.exit(0);

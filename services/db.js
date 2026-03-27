const { Pool: PgPool } = require('pg')
const mysql = require('mysql2/promise')
const fs = require('fs')

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

function normalize(res) {
  if (Array.isArray(res)) {
    if (res.length === 2) return { rows: res[0], fields: res[1] }
    return { rows: res }
  }
  if (res && typeof res === 'object') {
    if ('rows' in res) return res
    return { rows: res }
  }
  return { rows: res }
}

let poolInstance = null

function createPgPool(connectionString) {
  const sslOptions = {}
  try {
    const caPath = '/etc/ssl/ovh/ovh-ca.pem'
    if (fs.existsSync(caPath)) {
      sslOptions.ca = fs.readFileSync(caPath, 'utf8')
    } else {
      sslOptions.rejectUnauthorized = false
    }
  } catch (e) {
    sslOptions.rejectUnauthorized = false
  }
  return new PgPool({
    connectionString,
    ssl: Object.keys(sslOptions).length ? sslOptions : undefined
  })
}

function createPool() {
  const DATABASE_URL = process.env.DATABASE_URL || ''
  const DB_CLIENT = (process.env.DB_CLIENT || 'pg').toLowerCase()

  const isMySQL = DB_CLIENT === 'mysql' || DATABASE_URL.startsWith('mysql://')

  if (isMySQL) {
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
    return {
      query: async (sql, params = []) => {
        const [rows, fields] = await mysqlPool.query(sql, params)
        return { rows, fields }
      },
      execute: async (sql, params = []) => {
        const [result] = await mysqlPool.execute(sql, params)
        return [{ insertId: result.insertId, affectedRows: result.affectedRows }, null]
      },
      getConnection: async () => {
        const c = await mysqlPool.getConnection()
        return {
          query: async (s, p = []) => {
            const [rows, fields] = await c.query(s, p)
            return { rows, fields }
          },
          release: () => c.release()
        }
      },
      end: () => mysqlPool.end()
    }
  }

  const pgPool = createPgPool(DATABASE_URL)
  return {
    query: async (sql, params = []) => {
      const result = await pgPool.query(sql, params)
      return { rows: result.rows, fields: result.fields }
    },
    execute: async (sql, params = []) => {
      const result = await pgPool.query(sql, params)
      return [{ insertId: result.rows[0]?.id || null, affectedRows: result.rowCount || 0 }, null]
    },
    getConnection: async () => {
      const conn = await pgPool.connect()
      return {
        query: async (s, p = []) => {
          const r = await conn.query(s, p)
          return { rows: r.rows, fields: r.fields }
        },
        release: () => conn.release()
      }
    },
    end: () => pgPool.end()
  }
}

function getPool() {
  if (!poolInstance) poolInstance = createPool()
  return poolInstance
}

async function query(sql, params = []) {
  const pool = getPool()
  const r = await pool.query(sql, params)
  return normalize(r)
}

function defaultFactory() {
  const pool = getPool()
  return {
    query: async (sql, params = []) => normalize(await pool.query(sql, params)),
    execute: async (sql, params = []) => normalize(await pool.execute ? pool.execute(sql, params) : pool.query(sql, params)),
    getConnection: async () => {
      const c = await pool.getConnection()
      return { query: async (s,p=[]) => normalize(await c.query(s,p)), release: c.release ? c.release.bind(c) : () => {} }
    }
  }
}

const factory = function() { return defaultFactory() }
factory.default = factory
factory.getPool = getPool
factory.query = query
factory.__esModule = true

module.exports = factory

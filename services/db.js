const { Pool } = require('pg')

// Only load dotenv in development, not in production (Vercel sets env vars automatically)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const DATABASE_URL = process.env.DATABASE_URL

let pgPool

// Create the PostgreSQL connection pool
function createPgPool() {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  }
  return pgPool
}

// MySQL-compatible wrapper to make pg driver work with existing MySQL queries
class MySQLCompatiblePool {
  constructor(pgPool) {
    this.pgPool = pgPool
  }

  // Convert MySQL placeholder syntax (?) to PostgreSQL syntax ($1, $2, etc.)
  convertQuery(sql, params = []) {
    let paramIndex = 1
    const convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`)
    return { sql: convertedSql, params }
  }

  // Executes INSERT/UPDATE/DELETE statements (returns result with insertId if applicable)
  async execute(sql, params = []) {
    try {
      const { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
      const result = await this.pgPool.query(convertedSql, convertedParams)
      
      // Return in mysql2 format: [{ insertId, affectedRows }, fields]
      return [{
        insertId: result.rows[0]?.id || null,
        affectedRows: result.rowCount || 0
      }, null]
    } catch (err) {
      throw err
    }
  }

  // Executes SELECT statements (returns [rows, fields] similar to mysql2)
  async query(sql, params = []) {
    try {
      const { sql: convertedSql, params: convertedParams } = this.convertQuery(sql, params)
      const result = await this.pgPool.query(convertedSql, convertedParams)
      
      // Return in mysql2 format: [rows, fields]
      return [result.rows, result.fields]
    } catch (err) {
      throw err
    }
  }

  // Helper method for batch operations
  async getConnection() {
    return new MySQLCompatibleConnection(await this.pgPool.connect())
  }
}

// Wrapper for individual connections
class MySQLCompatibleConnection {
  constructor(pgConnection) {
    this.pgConnection = pgConnection
  }

  async query(sql, params = []) {
    try {
      let paramIndex = 1
      const convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`)
      const result = await this.pgConnection.query(convertedSql, params)
      return [result.rows, result.fields]
    } catch (err) {
      throw err
    }
  }

  async release() {
    return this.pgConnection.release()
  }
}

function getPool() {
  const pool = createPgPool()
  return new MySQLCompatiblePool(pool)
}

module.exports = { getPool }

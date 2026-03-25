// pages/api/admin/migrations/apply-011.js
// Apply migration 011: Add invitation and onboarding columns
// Protected endpoint - requires admin authentication

import fs from 'fs'
import path from 'path'
import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify admin token from query parameter (for testing) or Authorization header
  const adminToken = req.query.token || req.headers.authorization?.replace('Bearer ', '')
  const ADMIN_MIGRATION_TOKEN = process.env.ADMIN_MIGRATION_TOKEN

  if (!adminToken || adminToken !== ADMIN_MIGRATION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized - invalid migration token' })
  }

  const pool = getPool()

  try {
    console.log('🔄 Applying migration 011: Add invitation and onboarding columns...')

    // Read the migration file
    const sqlPath = path.join(process.cwd(), 'sql', '011_add_invitation_onboarding_columns.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0)
    const results = []

    for (const statement of statements) {
      try {
        const trimmed = statement.trim()
        // Convert MySQL syntax to PostgreSQL if needed (usually already PostgreSQL)
        await pool.query(trimmed)
        results.push({
          status: 'success',
          statement: trimmed.slice(0, 60) + '...'
        })
        console.log('✅ Applied:', trimmed.slice(0, 60))
      } catch (err) {
        if (
          err.message.includes('already exists') ||
          err.code === '42701' || // column already exists
          err.code === '42P07' // index already exists
        ) {
          results.push({
            status: 'skipped',
            statement: statement.trim().slice(0, 60) + '...',
            reason: 'already exists'
          })
          console.log('⚠️  Skipped (already exists):', statement.trim().slice(0, 60))
        } else {
          throw err
        }
      }
    }

    console.log('✅ Migration 011 completed successfully!')
    return res.status(200).json({
      success: true,
      message: 'Migration 011 applied successfully',
      results
    })
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    return res.status(500).json({
      error: 'Migration failed',
      details: err.message
    })
  }
}

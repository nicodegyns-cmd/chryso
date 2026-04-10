import { getPool } from '../../../services/db'

export default async function handler(req, res) {
  // Security: Only allow in development or with a migration token
  const token = req.query.token || req.body?.token
  const expectedToken = process.env.MIGRATE_TOKEN || 'run_migration_if_needed'
  
  if (token !== expectedToken && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const pool = getPool()
  const client = await pool.connect()

  try {
    console.log('[Migration] Starting: Make analytic_id nullable in prestations...')

    // Step 1: Drop existing FK constraint
    console.log('[Migration] Step 1: Dropping existing FK constraint...')
    try {
      await client.query('ALTER TABLE prestations DROP CONSTRAINT IF EXISTS fk_prestations_analytics')
      console.log('[Migration] ✓ Constraint dropped')
    } catch (e) {
      console.log('[Migration] Note: Constraint drop failed (may not exist):', e.message)
    }

    // Step 2: Make analytic_id nullable
    console.log('[Migration] Step 2: Making analytic_id nullable...')
    try {
      await client.query('ALTER TABLE prestations ALTER COLUMN analytic_id DROP NOT NULL')
      console.log('[Migration] ✓ Column is now nullable')
    } catch (e) {
      if (e.message.includes('already') || e.message.includes('nullable')) {
        console.log('[Migration] ✓ Column was already nullable')
      } else {
        throw e
      }
    }

    // Step 3: Re-add FK constraint with ON DELETE SET NULL
    console.log('[Migration] Step 3: Adding FK constraint with ON DELETE SET NULL...')
    await client.query(`
      ALTER TABLE prestations
      ADD CONSTRAINT fk_prestations_analytics
      FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL
    `)
    console.log('[Migration] ✓ FK constraint re-added')

    // Step 4: Verify
    const verifyRes = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'prestations' AND column_name = 'analytic_id'
    `)
    
    const col = verifyRes.rows[0]
    console.log('[Migration] ✓ Verification:')
    console.log('  - Column:', col.column_name)
    console.log('  - Data type:', col.data_type)
    console.log('  - Nullable:', col.is_nullable)

    await client.end()
    return res.status(200).json({
      success: true,
      message: 'Migration completed successfully',
      changes: {
        constraint_dropped: true,
        column_nullable: col.is_nullable === 'YES',
        constraint_readded: 'fk_prestations_analytics'
      }
    })

  } catch (error) {
    console.error('[Migration] Error:', error.message)
    await client.end()
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error
    })
  }
}

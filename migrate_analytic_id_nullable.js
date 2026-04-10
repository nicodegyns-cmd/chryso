const { Pool } = require('pg');

/**
 * Migration: Make analytic_id nullable in prestations table
 * This allows users to save prestations without selecting an analytics field
 * Fixes: "insert or update on table 'prestations' violates foreign key constraint 'fk_prestations_analytics'"
 */

const pool = new Pool({
  host: 'ay177071-001.eu.clouddb.ovh.net',
  port: 35230,
  user: 'fenix',
  password: 'Toulouse94',
  database: 'fenix'
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Starting migration: Make analytic_id nullable...\n');

    // Step 1: Drop the existing foreign key constraint
    console.log('Step 1: Dropping existing foreign key constraint...');
    try {
      await client.query('ALTER TABLE prestations DROP CONSTRAINT IF EXISTS fk_prestations_analytics');
      console.log('✓ Constraint dropped (or didn\'t exist)\n');
    } catch (e) {
      console.log('Note:', e.message);
    }

    // Step 2: Make analytic_id nullable
    console.log('Step 2: Making analytic_id column nullable...');
    try {
      await client.query('ALTER TABLE prestations ALTER COLUMN analytic_id DROP NOT NULL');
      console.log('✓ Column is now nullable\n');
    } catch (e) {
      if (e.message.includes('does not exist') || e.message.includes('SET NOT NULL')) {
        console.log('✓ Column is already nullable\n');
      } else {
        throw e;
      }
    }

    // Step 3: Re-add the foreign key constraint with ON DELETE SET NULL
    console.log('Step 3: Adding foreign key constraint with ON DELETE SET NULL...');
    await client.query(`
      ALTER TABLE prestations 
      ADD CONSTRAINT fk_prestations_analytics 
      FOREIGN KEY (analytic_id) REFERENCES analytics(id) ON DELETE SET NULL
    `);
    console.log('✓ Foreign key constraint added\n');

    // Step 4: Verify the change
    console.log('Step 4: Verifying the schema...');
    const result = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'prestations' AND column_name = 'analytic_id'
    `);
    
    if (result.rows.length > 0) {
      const col = result.rows[0];
      console.log(`✓ analytic_id column:
    - data_type: ${col.data_type}
    - is_nullable: ${col.is_nullable}
    - Foreign key: fk_prestations_analytics\n`);
    }

    console.log('✅ Migration completed successfully!');
    console.log('\nThis allows users to save prestations without selecting an analytic.');
    console.log('Foreign key constraint now allows NULL values with ON DELETE SET NULL.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

const { getPool } = require('../services/db')

async function insertTestActivities() {
  const pool = getPool()
  try {
    console.log('Inserting test activities...')

    // First, get or create a test analytics
    const [analytics] = await pool.query(
      `SELECT id FROM analytics WHERE code = 'TEST_ANALYTIC' LIMIT 1`
    )

    let analyticId = null
    if (analytics.length > 0) {
      analyticId = analytics[0].id
      console.log('Using existing analytic:', analyticId)
    } else {
      const [result] = await pool.execute(
        `INSERT INTO analytics (name, code, analytic_type) VALUES (?, ?, ?)`,
        ['Activité Test', 'TEST_ANALYTIC', 'PDF']
      )
      analyticId = result.insertId
      console.log('Created new analytic:', analyticId)
    }

    // Insert test activities for the next 7 days
    const today = new Date()
    const activities = []

    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      activities.push([
        analyticId,
        'Analytique Test ' + i,
        'TEST_ANALYTIC_' + i,
        'GARDE',
        dateStr,
        25.50,
        30.75
      ])
    }

    for (const activity of activities) {
      await pool.execute(
        `INSERT INTO activities (analytic_id, analytic_name, analytic_code, pay_type, date, remuneration_infi, remuneration_med) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        activity
      )
      console.log(`✓ Created activity for ${activity[4]}`)
    }

    console.log(`✓ Successfully inserted ${activities.length} test activities`)
    pool.end()
  } catch (err) {
    console.error('Error inserting test activities:', err)
    process.exit(1)
  }
}

insertTestActivities()

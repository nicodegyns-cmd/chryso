#!/usr/bin/env node

const http = require('http')

const options = {
  hostname: 'localhost',
  port: 8084,
  path: '/api/admin/deploy/cleanup-mappings',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    try {
      const result = JSON.parse(data)
      if (result.success) {
        console.log('\n✅ Cleanup successful!')
        console.log(`   Deleted: ${result.summary.deleted} entries`)
        console.log(`   Kept: ${result.summary.kept} entries`)
        console.log(`   Total: ${result.summary.total}`)
        
        if (result.deleted.length > 0) {
          console.log('\n📋 Deleted entries:')
          result.deleted.forEach(d => {
            console.log(`   - "${d.old_name}" (activity_id=${d.activity_id}) → code ${d.extracted_code}`)
          })
        }
        
        if (result.kept.length > 0) {
          console.log('\n✓ Kept code-only entries:')
          result.kept.forEach(k => {
            console.log(`   - ${k.code} (activity_id=${k.activity_id})`)
          })
        }
      } else {
        console.error('❌ Cleanup failed:', result.error)
      }
    } catch (e) {
      console.error('❌ Error parsing response:', e.message)
    }
  })
})

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message)
  console.log('   Make sure the server is running on port 8084')
})

console.log('Running cleanup of activity_ebrigade_mappings...\n')
req.end()

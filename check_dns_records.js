#!/usr/bin/env node

/**
 * Check DNS records for email authentication
 * Usage: node check_dns_records.js nexio7.be
 */

const dns = require('dns').promises
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)

async function checkDNS(domain) {
  console.log(`\n🔍 Checking DNS records for: ${domain}\n`)

  try {
    // 1. Check SPF
    console.log('1️⃣  SPF Record:')
    try {
      const spfRecords = await dns.resolveTxt(domain)
      const spf = spfRecords.find(r => r[0].startsWith('v=spf1'))
      if (spf) {
        console.log('   ✅ Found:', spf[0])
        if (spf[0].includes('o2switch')) {
          console.log('   ✅ O2Switch is authorized!')
        } else {
          console.log('   ⚠️  O2Switch NOT found in SPF - add: include:o2switch.net')
        }
      } else {
        console.log('   ❌ NO SPF record found!')
        console.log('   ⚠️  Add this TXT record:')
        console.log('      v=spf1 include:o2switch.net ~all')
      }
    } catch (err) {
      console.log('   ❌ Error checking SPF:', err.message)
    }

    // 2. Check DKIM
    console.log('\n2️⃣  DKIM Record (default selector):')
    const dkimDomain = `default._domainkey.${domain}`
    try {
      const dkimRecords = await dns.resolveTxt(dkimDomain)
      const dkim = dkimRecords.find(r => r[0].startsWith('v=DKIM1'))
      if (dkim) {
        console.log('   ✅ Found DKIM record')
        console.log('   Key fragment:', dkim[0].substring(0, 80) + '...')
      } else {
        console.log('   ⚠️  No DKIM found')
      }
    } catch (err) {
      console.log('   ❌ No DKIM configured')
      console.log('   💡 Contact O2Switch to get your DKIM key')
    }

    // 3. Check DMARC
    console.log('\n3️⃣  DMARC Record:')
    const dmarcDomain = `_dmarc.${domain}`
    try {
      const dmarcRecords = await dns.resolveTxt(dmarcDomain)
      const dmarc = dmarcRecords.find(r => r[0].startsWith('v=DMARC1'))
      if (dmarc) {
        console.log('   ✅ Found:', dmarc[0])
      } else {
        console.log('   ⚠️  DMARC not configured (optional)')
      }
    } catch (err) {
      console.log('   ⚠️  No DMARC configured (optional)')
      console.log('      v=DMARC1; p=none; rua=mailto:admin@' + domain)
    }

    // 4. Check MX
    console.log('\n4️⃣  MX Records:')
    try {
      const mxRecords = await dns.resolveMx(domain)
      if (mxRecords && mxRecords.length > 0) {
        console.log('   ✅ Found', mxRecords.length, 'MX record(s):')
        mxRecords.forEach(mx => {
          console.log(`      ${mx.exchange} (priority ${mx.priority})`)
        })
      } else {
        console.log('   ❌ No MX records found')
      }
    } catch (err) {
      console.log('   ❌ Error checking MX:', err.message)
    }

  } catch (err) {
    console.error('Error:', err)
  }

  console.log('\n📋 Summary:')
  console.log('   - SPF: Required for authentication')
  console.log('   - DKIM: Recommended for better delivery')
  console.log('   - DMARC: Optional but recommended')
  console.log('\n💡 For help, see: EMAIL_DELIVERABILITY.md\n')
}

const domain = process.argv[2] || 'nexio7.be'
checkDNS(domain)

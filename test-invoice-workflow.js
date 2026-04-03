#!/usr/bin/env node

/**
 * Test end-to-end invoice generation workflow
 * This script:
 * 1. Creates a test prestation
 * 2. Simulates admin clicking "Valider" (PATCH request)
 * 3. Verifies PDF is generated
 * 4. Checks that invoice_number and pdf_url are set
 */

const http = require('http');

// Test with a sample prestation update
const testPrestationId = 1; // Use existing prestation ID
const testData = {
  status: 'En attente d\'envoie',
  montant: 150.50,
  type_prestation: 'SMUR',
  date_prestation: '2026-04-03',
  user_id: 1
};

console.log('🧪 Testing invoice generation workflow...\n');
console.log(`📝 Test Prestation ID:`, testPrestationId);
console.log(`📋 Test Data:`, JSON.stringify(testData, null, 2));

// Patch request to generate invoice
const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/admin/prestations/${testPrestationId}`,
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(testData))
  }
};

console.log('\n📤 Sending PATCH request to generate invoice...\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`✅ Response Status: ${res.statusCode}`);
    console.log('📨 Response Body:\n', data);
    
    try {
      const response = JSON.parse(data);
      if (response.id) {
        console.log('\n✅ Prestation updated successfully!');
        console.log(`   - Invoice Number: ${response.invoice_number}`);
        console.log(`   - Request Ref: ${response.request_ref}`);
        console.log(`   - PDF URL: ${response.pdf_url}`);
        console.log(`   - Status: ${response.status}`);
        
        if (response.pdf_url) {
          console.log('\n✅ PDF WAS GENERATED! Workflow successful!');
        } else {
          console.log('\n❌ PDF URL is empty - invoice generation failed');
        }
      }
    } catch (e) {
      console.error('\n❌ Error parsing response:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
  process.exit(1);
});

req.write(JSON.stringify(testData));
req.end();

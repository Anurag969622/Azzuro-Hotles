#!/usr/bin/env node
/**
 * health-check.js
 * Quick connectivity check for all three services.
 * Usage: node scripts/health-check.js
 */

const http = require('http');

const SERVICES = [
  { name: 'Express Server', url: 'http://localhost:3001/api/v1/health' },
  { name: 'AI Worker',      url: 'http://localhost:8001/health' },
];

function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ ok: true, status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ ok: true, status: res.statusCode, body: data }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

(async () => {
  console.log('\n🔍 AZZURRO INSIGHTS — Health Check\n' + '─'.repeat(40));
  let allOk = true;
  for (const svc of SERVICES) {
    const result = await get(svc.url);
    if (result.ok && result.status === 200) {
      console.log(`✅ ${svc.name.padEnd(20)} OK  (${svc.url})`);
    } else {
      console.log(`❌ ${svc.name.padEnd(20)} FAIL — ${result.error || `HTTP ${result.status}`}`);
      allOk = false;
    }
  }
  console.log('─'.repeat(40));
  console.log(allOk ? '✅ All services healthy\n' : '⚠️  Some services are down — start them first\n');
  process.exit(allOk ? 0 : 1);
})();


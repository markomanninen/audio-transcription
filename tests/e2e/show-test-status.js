#!/usr/bin/env node
/**
 * Show current status of all test files
 */
const fs = require('fs');
const path = require('path');

const statusPath = path.join(__dirname, 'test-status.json');

if (!fs.existsSync(statusPath)) {
  console.error('❌ No test-status.json found. Run tests and update-test-status.js first.');
  process.exit(1);
}

const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
const files = Object.keys(status).sort();

console.log('\n📊 Current Test Status (All Files)\n');
console.log('─'.repeat(100));
console.log('File'.padEnd(40), 'Last Run'.padEnd(23), 'Passed', 'Failed', 'Skipped', 'Total', 'Status');
console.log('─'.repeat(100));

files.forEach(fileName => {
  const s = status[fileName];
  const statusIcon = s.status === 'PASSED' ? '✅' : 
                     s.status === 'FAILED' ? '❌' : 
                     '⏭️ ';
  
  console.log(
    `${statusIcon} ${fileName.padEnd(37)}`,
    s.lastRun.padEnd(23),
    s.passed.toString().padEnd(7),
    s.failed.toString().padEnd(7),
    s.skipped.toString().padEnd(8),
    s.total.toString().padEnd(6),
    s.status
  );
});

console.log('─'.repeat(100));

// Calculate totals
const totals = files.reduce((acc, fileName) => {
  const s = status[fileName];
  return {
    total: acc.total + s.total,
    passed: acc.passed + s.passed,
    failed: acc.failed + s.failed,
    skipped: acc.skipped + s.skipped
  };
}, { total: 0, passed: 0, failed: 0, skipped: 0 });

console.log(
  'TOTAL'.padEnd(40),
  ''.padEnd(23),
  totals.passed.toString().padEnd(7),
  totals.failed.toString().padEnd(7),
  totals.skipped.toString().padEnd(8),
  totals.total.toString()
);

console.log('\n');

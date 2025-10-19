#!/usr/bin/env node
/**
 * Show historical test results from test-history.jsonl
 */
const fs = require('fs');
const path = require('path');

const historyPath = path.join(__dirname, 'test-history.jsonl');

if (!fs.existsSync(historyPath)) {
  console.error('❌ No test history found. Run tests and record-test-run.js first.');
  process.exit(1);
}

const lines = fs.readFileSync(historyPath, 'utf8').trim().split('\n');
const runs = lines.map(line => JSON.parse(line));

// Get unique files across all runs
const allFiles = new Set();
runs.forEach(run => {
  Object.keys(run.files).forEach(file => allFiles.add(file));
});

const files = Array.from(allFiles).sort();

// Show mode: all runs or last N runs
const showLast = process.argv[2] ? parseInt(process.argv[2]) : 10;
const displayRuns = runs.slice(-showLast);

console.log('\n📜 Test History\n');
console.log(`Showing last ${displayRuns.length} of ${runs.length} total runs\n`);
console.log('─'.repeat(100));

// Table header
console.log(
  'Date & Time'.padEnd(22),
  'Duration'.padEnd(10),
  'Total'.padEnd(7),
  'Passed'.padEnd(8),
  'Failed'.padEnd(8),
  'Skipped'.padEnd(9),
  'Status'
);
console.log('─'.repeat(100));

// Show each run
displayRuns.forEach((run, idx) => {
  const t = run.totals;
  const status = t.failed > 0 ? '❌ FAILED' : 
                 t.skipped === t.total ? '⏭️  ALL SKIPPED' : 
                 '✅ PASSED';
  
  console.log(
    run.date.padEnd(22),
    `${run.duration_sec}s`.padEnd(10),
    t.total.toString().padEnd(7),
    t.passed.toString().padEnd(8),
    t.failed.toString().padEnd(8),
    t.skipped.toString().padEnd(9),
    status
  );
});

console.log('─'.repeat(100));

// Show per-file breakdown for last run
console.log('\n📂 Last Run File Breakdown\n');
console.log('─'.repeat(80));
console.log('File'.padEnd(40), 'Passed', 'Failed', 'Skipped', 'Total');
console.log('─'.repeat(80));

const lastRun = displayRuns[displayRuns.length - 1];
files.forEach(fileName => {
  const stats = lastRun.files[fileName];
  if (stats) {
    const status = stats.failed > 0 ? '❌' : stats.skipped === stats.total ? '⏭️ ' : '✅';
    console.log(
      `${status} ${fileName.padEnd(37)}`,
      stats.passed.toString().padEnd(7),
      stats.failed.toString().padEnd(7),
      stats.skipped.toString().padEnd(8),
      stats.total.toString()
    );
  }
});

console.log('─'.repeat(80));
console.log('\n💡 Usage: node show-test-history.js [N]  (show last N runs, default 10)\n');

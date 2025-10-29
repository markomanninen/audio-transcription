#!/usr/bin/env node
/**
 * Parse Playwright JSON results and show per-file summary
 */
const fs = require('fs');
const path = require('path');

// Accept results path as argument, default to test-results/results.json
const resultsPath = process.argv[2] || path.join(__dirname, 'test-results/results.json');

if (!fs.existsSync(resultsPath)) {
  console.error(`[ERROR] No results.json found at: ${resultsPath}`);
  console.error('Run tests first with JSON reporter enabled.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Group tests by file
const fileStats = {};

results.suites.forEach(suite => {
  suite.suites?.forEach(fileSuite => {
    const fileName = path.basename(fileSuite.file || 'unknown');
    
    if (!fileStats[fileName]) {
      fileStats[fileName] = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        timedOut: 0,
        file: fileSuite.file
      };
    }
    
    fileSuite.specs?.forEach(spec => {
      spec.tests?.forEach(test => {
        fileStats[fileName].total++;
        
        const status = test.results?.[0]?.status;
        if (status === 'passed') {
          fileStats[fileName].passed++;
        } else if (status === 'failed') {
          fileStats[fileName].failed++;
        } else if (status === 'skipped') {
          fileStats[fileName].skipped++;
        } else if (status === 'timedOut') {
          fileStats[fileName].timedOut++;
        }
      });
    });
  });
});

// Display summary
console.log('\n[STATS] Test Results Summary\n');
console.log('─'.repeat(80));
console.log('File'.padEnd(40), 'Passed', 'Failed', 'Skipped', 'Total');
console.log('─'.repeat(80));

Object.keys(fileStats).sort().forEach(fileName => {
  const stats = fileStats[fileName];
  const status = stats.failed > 0 ? '❌' : stats.skipped === stats.total ? '⏭️ ' : '✅';
  
  console.log(
    `${status} ${fileName.padEnd(37)}`,
    stats.passed.toString().padEnd(7),
    stats.failed.toString().padEnd(7),
    stats.skipped.toString().padEnd(8),
    stats.total.toString()
  );
});

console.log('─'.repeat(80));

// Overall summary
const totals = Object.values(fileStats).reduce((acc, stats) => ({
  passed: acc.passed + stats.passed,
  failed: acc.failed + stats.failed,
  skipped: acc.skipped + stats.skipped,
  total: acc.total + stats.total
}), { passed: 0, failed: 0, skipped: 0, total: 0 });

console.log(
  `${'TOTAL'.padEnd(40)}`,
  totals.passed.toString().padEnd(7),
  totals.failed.toString().padEnd(7),
  totals.skipped.toString().padEnd(8),
  totals.total.toString()
);

console.log('\n');

// Last run timestamp
const lastRun = new Date(results.stats?.startTime || Date.now());
console.log(`Last run: ${lastRun.toLocaleString()}`);
console.log(`Duration: ${((results.stats?.duration || 0) / 1000).toFixed(1)}s`);
console.log('');

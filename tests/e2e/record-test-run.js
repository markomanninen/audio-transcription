#!/usr/bin/env node
/**
 * Record test run results to historical log file
 * Appends each test run to test-history.jsonl (JSON Lines format)
 */
const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'test-results/results.json');
const historyPath = path.join(__dirname, 'test-history.jsonl'); // Store OUTSIDE test-results (Playwright clears that dir)

if (!fs.existsSync(resultsPath)) {
  console.error('❌ No results.json found. Run tests first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Build summary of this run
const runSummary = {
  timestamp: new Date().toISOString(),
  date: new Date().toLocaleString(),
  duration_sec: ((results.stats?.duration || 0) / 1000).toFixed(1),
  files: {}
};

// Group tests by file
results.suites.forEach(suite => {
  suite.suites?.forEach(fileSuite => {
    const fileName = path.basename(fileSuite.file || 'unknown');
    
    if (!runSummary.files[fileName]) {
      runSummary.files[fileName] = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        timedOut: 0
      };
    }
    
    fileSuite.specs?.forEach(spec => {
      spec.tests?.forEach(test => {
        runSummary.files[fileName].total++;
        
        const status = test.results?.[0]?.status;
        if (status === 'passed') runSummary.files[fileName].passed++;
        else if (status === 'failed') runSummary.files[fileName].failed++;
        else if (status === 'skipped') runSummary.files[fileName].skipped++;
        else if (status === 'timedOut') runSummary.files[fileName].timedOut++;
      });
    });
  });
});

// Calculate totals
runSummary.totals = Object.values(runSummary.files).reduce((acc, stats) => ({
  total: acc.total + stats.total,
  passed: acc.passed + stats.passed,
  failed: acc.failed + stats.failed,
  skipped: acc.skipped + stats.skipped,
  timedOut: acc.timedOut + stats.timedOut
}), { total: 0, passed: 0, failed: 0, skipped: 0, timedOut: 0 });

// Append to history file (JSONL format - one JSON object per line)
fs.appendFileSync(historyPath, JSON.stringify(runSummary) + '\n');

console.log('✅ Test run recorded to test-history.jsonl');
console.log(`📊 ${runSummary.totals.passed}/${runSummary.totals.total} passed, ${runSummary.totals.failed} failed, ${runSummary.totals.skipped} skipped`);

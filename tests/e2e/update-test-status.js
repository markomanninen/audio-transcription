#!/usr/bin/env node
/**
 * Update test-status.json with latest results for each test file
 * This file shows the CURRENT state of all test files based on their most recent run
 */
const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'test-results/results.json');
const statusPath = path.join(__dirname, 'test-status.json');

if (!fs.existsSync(resultsPath)) {
  console.error('❌ No results.json found. Run tests first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Load existing status or create new
let status = {};
if (fs.existsSync(statusPath)) {
  status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
}

// Update with new results
const timestamp = new Date().toISOString();
const date = new Date().toLocaleString();

results.suites.forEach(suite => {
  suite.suites?.forEach(fileSuite => {
    const fileName = path.basename(fileSuite.file || 'unknown');
    
    const fileStats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      timedOut: 0
    };
    
    fileSuite.specs?.forEach(spec => {
      spec.tests?.forEach(test => {
        fileStats.total++;
        const testStatus = test.results?.[0]?.status;
        if (testStatus === 'passed') fileStats.passed++;
        else if (testStatus === 'failed') fileStats.failed++;
        else if (testStatus === 'skipped') fileStats.skipped++;
        else if (testStatus === 'timedOut') fileStats.timedOut++;
      });
    });
    
    // Update status for this file
    status[fileName] = {
      ...fileStats,
      lastRun: date,
      lastRunTimestamp: timestamp,
      status: fileStats.failed > 0 ? 'FAILED' : 
              fileStats.skipped === fileStats.total ? 'ALL_SKIPPED' : 
              'PASSED'
    };
  });
});

// Write updated status
fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

const fileCount = Object.keys(status).length;
console.log(`✅ Updated test status for ${fileCount} file(s)`);
console.log(`📄 See test-status.json for current state of all test files`);

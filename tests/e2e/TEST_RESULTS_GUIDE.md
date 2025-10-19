# Test Results & History Guide

This directory includes tools for tracking test results over time.

## Files

- **`test-results/results.json`** - Latest test run results (JSON format, auto-generated)
- **`test-history.jsonl`** - Historical log of all test runs (JSONL format, accumulated)
- **`show-test-summary.js`** - Display summary of last test run
- **`show-test-history.js`** - Display historical test results
- **`record-test-run.js`** - Record current test run to history

## Quick Start

### Run Tests and Record Results

```bash
# Option 1: Run and auto-record (recommended)
npm run test:record

# Option 2: Manual workflow
npm test
node record-test-run.js
```

### View Results

```bash
# Show last run summary
npm run results
# or
node show-test-summary.js

# Show test history (last 10 runs)
npm run history
# or
node show-test-history.js

# Show all historical runs
npm run history:all
# or
node show-test-history.js 999

# Show last N runs
node show-test-history.js 5
```

## Output Examples

### Current Results (`npm run results`)

```
📊 Test Results Summary

────────────────────────────────────────────────────────────────────────────────
File                                     Passed Failed Skipped Total
────────────────────────────────────────────────────────────────────────────────
✅ ai-text-editor.spec.ts                44      0       0        44
✅ health.spec.ts                        2       0       0        2
⏭️  transcription-restart.spec.ts        0       0       4        4
────────────────────────────────────────────────────────────────────────────────
TOTAL                                    46      0       4        50

Last run: 10/19/2025, 8:24:00 AM
Duration: 150.2s
```

### Historical Results (`npm run history`)

```
📜 Test History

Showing last 5 of 10 total runs

────────────────────────────────────────────────────────────────────────────────
Date & Time            Duration   Total   Passed   Failed   Skipped   Status
────────────────────────────────────────────────────────────────────────────────
10/19/2025, 8:20:00 AM 32.5s      6       6        0        0         ✅ PASSED
10/19/2025, 8:21:00 AM 16.9s      6       6        0        0         ✅ PASSED
10/19/2025, 8:22:00 AM 125.3s     24      22       2        0         ❌ FAILED
10/19/2025, 8:23:00 AM 145.8s     44      38       0        6         ✅ PASSED
10/19/2025, 8:24:00 AM 150.2s     44      44       0        0         ✅ PASSED
────────────────────────────────────────────────────────────────────────────────

📂 Last Run File Breakdown
[Shows per-file breakdown of last run]
```

## How It Works

1. **Playwright Config** generates `test-results/results.json` after each run
2. **record-test-run.js** appends summary to `test-history.jsonl` (JSONL = JSON Lines)
3. **show-test-history.js** reads history file and displays formatted table

## File Format (JSONL)

Each line in `test-history.jsonl` is a JSON object:

```json
{
  "timestamp": "2025-10-19T05:24:00.000Z",
  "date": "10/19/2025, 8:24:00 AM",
  "duration_sec": "150.2",
  "files": {
    "ai-text-editor.spec.ts": {
      "total": 44,
      "passed": 44,
      "failed": 0,
      "skipped": 0,
      "timedOut": 0
    }
  },
  "totals": {
    "total": 44,
    "passed": 44,
    "failed": 0,
    "skipped": 0,
    "timedOut": 0
  }
}
```

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run tests (generates results.json) |
| `npm run test:record` | Run tests and record to history |
| `npm run results` | Show current run summary |
| `npm run history` | Show last 10 test runs |
| `npm run history:all` | Show all historical runs |
| `npm run report` | Open HTML report in browser |

## Tips

- **Tracking Trends**: Run `npm run test:record` regularly to build history
- **CI Integration**: Add `node record-test-run.js` to your CI pipeline
- **Debugging**: Use `npm run report` for detailed HTML report with traces
- **Filtering**: History file is plain text - use `grep`, `jq`, etc. for custom queries

## Example: Find All Failed Runs

```bash
grep '"failed":[1-9]' test-history.jsonl | \
  jq -r '[.date, .totals.failed] | @tsv'
```

## Maintenance

The history file grows over time. To keep only recent runs:

```bash
# Keep last 100 runs
tail -100 test-history.jsonl > test-history-new.jsonl
mv test-history-new.jsonl test-history.jsonl
```

Or simply delete it to start fresh:

```bash
rm test-history.jsonl
```

#!/usr/bin/env node
/**
 * Frontend smoke test - detects white page errors
 */
const http = require('http');

const FRONTEND_URL = 'http://localhost:5175';
const TIMEOUT = 5000;

function testFrontend() {
  return new Promise((resolve, reject) => {
    const req = http.get(FRONTEND_URL, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const result = {
          status: res.statusCode,
          hasRoot: data.includes('<div id="root">'),
          hasScript: data.includes('<script'),
          bodyLength: data.length,
          hasError: false,
          error: null
        };

        // Check for white page indicators
        if (result.bodyLength < 500) {
          result.hasError = true;
          result.error = 'Response too small - likely empty page';
        }

        if (!result.hasRoot) {
          result.hasError = true;
          result.error = 'Missing root div - page structure broken';
        }

        if (!result.hasScript) {
          result.hasError = true;
          result.error = 'Missing script tags - JS not loading';
        }

        resolve(result);
      });
    });

    req.on('error', (err) => {
      reject({ hasError: true, error: err.message });
    });

    req.setTimeout(TIMEOUT, () => {
      req.destroy();
      reject({ hasError: true, error: 'Request timeout' });
    });
  });
}

async function checkBrowserErrors() {
  // Launch puppeteer to check actual browser console
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.toString());
    });

    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 10000 });

    // Check if page is actually rendered
    const content = await page.content();
    const rootContent = await page.$eval('#root', el => el.innerHTML).catch(() => '');

    await browser.close();

    return {
      hasErrors: errors.length > 0,
      errors: errors,
      rootIsEmpty: rootContent.trim().length === 0,
      rootContent: rootContent.substring(0, 200)
    };
  } catch (err) {
    // Puppeteer not available, skip browser check
    return null;
  }
}

async function main() {
  console.log('[SEARCH] Testing frontend at', FRONTEND_URL);
  console.log('');

  try {
    const result = await testFrontend();

    console.log('HTTP Status:', result.status);
    console.log('Body length:', result.bodyLength, 'bytes');
    console.log('Has root div:', result.hasRoot ? '✓' : '✗');
    console.log('Has scripts:', result.hasScript ? '✓' : '✗');
    console.log('');

    // Try browser check
    console.log('Checking browser console...');
    const browserResult = await checkBrowserErrors();

    if (browserResult) {
      console.log('Root element empty:', browserResult.rootIsEmpty ? '✗ YES (WHITE PAGE!)' : '✓ No');

      if (browserResult.hasErrors) {
        console.log('\n[ERROR] BROWSER ERRORS DETECTED:');
        browserResult.errors.forEach((err, i) => {
          console.log(`  ${i + 1}. ${err}`);
        });
      }

      if (browserResult.rootIsEmpty) {
        console.log('\n[ERROR] WHITE PAGE DETECTED!');
        console.log('The page loads but #root is empty.');
        console.log('This usually means:');
        console.log('  - JavaScript error preventing React from rendering');
        console.log('  - Module import/export errors');
        console.log('  - Missing dependencies');
      }

      if (browserResult.hasErrors || browserResult.rootIsEmpty) {
        process.exit(1);
      }
    } else {
      console.log('⚠️  Puppeteer not available - install with: npm install puppeteer');
      console.log('Cannot detect white page without browser check.');
    }

    if (result.hasError) {
      console.log('\n[ERROR] FRONTEND TEST FAILED:');
      console.log('  ', result.error);
      process.exit(1);
    }

    console.log('\n[OK] Frontend appears to be working');
    process.exit(0);

  } catch (err) {
    console.error('\n[ERROR] TEST FAILED:');
    console.error('  ', err.error || err.message);
    process.exit(1);
  }
}

main();

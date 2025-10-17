/* eslint-disable no-console */
const { spawn } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')

const repoRoot = path.resolve(__dirname, '../../..')
const backendDir = path.join(repoRoot, 'backend')
const frontendDir = path.join(repoRoot, 'frontend')
const backendPort = process.env.LOCAL_BACKEND_PORT || '18200'
const frontendPort = process.env.LOCAL_FRONTEND_PORT || '18300'
const databasePath = process.env.LOCAL_DATABASE_PATH || path.join(backendDir, 'data', `e2e_local_${backendPort}.db`)

function resolvePythonBinary() {
  if (process.env.LOCAL_PYTHON) {
    return process.env.LOCAL_PYTHON
  }

  const candidates =
    process.platform === 'win32'
      ? [
          path.join(repoRoot, '.venv', 'Scripts', 'python.exe'),
          path.join(repoRoot, '.venv', 'Scripts', 'python3.exe'),
          'python.exe',
        ]
      : [
          path.join(repoRoot, '.venv', 'bin', 'python3'),
          path.join(repoRoot, '.venv', 'bin', 'python'),
          'python3',
        ]

  for (const candidate of candidates) {
    if (!candidate.includes('python') || fs.existsSync(candidate)) {
      return candidate
    }
  }
  return 'python3'
}

const PYTHON = resolvePythonBinary()
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function removeLocalDatabase() {
  try {
    if (fs.existsSync(databasePath)) {
      fs.rmSync(databasePath)
    }
  } catch (error) {
    console.warn('Failed to remove local e2e database:', error)
  }
}

function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now()

  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.resume()
          if (res.statusCode && res.statusCode < 500) {
            resolve()
          } else if (Date.now() - start > timeoutMs) {
            reject(new Error(`Timed out waiting for server at ${url}`))
          } else {
            setTimeout(check, 1000)
          }
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Timed out waiting for server at ${url}`))
          } else {
            setTimeout(check, 1000)
          }
        })
    }

    check()
  })
}

removeLocalDatabase()

const backendEnv = {
  ...process.env,
  DATABASE_URL: `sqlite:///./data/${path.basename(databasePath)}`,
  WHISPER_MODEL_SIZE: 'small',
  UVICORN_ACCESS_LOG: 'false',
}

const backendProc = spawn(
  PYTHON,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', backendPort],
  {
    cwd: backendDir,
    env: backendEnv,
    stdio: 'inherit',
  }
)

const frontendEnv = {
  ...process.env,
  VITE_API_BASE_URL: `http://127.0.0.1:${backendPort}`,
}

const frontendProc = spawn(
  NPM,
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', frontendPort],
  {
    cwd: frontendDir,
    env: frontendEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
)

function shutdown() {
  if (backendProc) {
    backendProc.kill('SIGTERM')
  }
  if (frontendProc) {
    frontendProc.kill('SIGTERM')
  }
  try {
    if (fs.existsSync(databasePath)) {
      fs.rmSync(databasePath)
    }
  } catch (error) {
    console.warn('Failed to clean up local e2e database:', error)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('exit', shutdown)

Promise.all([
  waitForServer(`http://127.0.0.1:${backendPort}/health`),
  waitForServer(`http://127.0.0.1:${frontendPort}`),
])
  .then(() => {
    console.log(
      `Local stack ready: frontend http://127.0.0.1:${frontendPort}, backend http://127.0.0.1:${backendPort}`
    )
  })
  .catch((error) => {
    console.error('Failed to start local test stack:', error)
    shutdown()
    process.exit(1)
  })

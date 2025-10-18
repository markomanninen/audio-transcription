/* eslint-disable no-console */
const { spawn, spawnSync } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')

const repoRoot = path.resolve(__dirname, '../../..')
const backendDir = path.join(repoRoot, 'backend')
const frontendDir = path.join(repoRoot, 'frontend')
const backendPort = process.env.LOCAL_BACKEND_PORT || '18200'
const frontendPort = process.env.LOCAL_FRONTEND_PORT || '18300'
const databasePath = process.env.LOCAL_DATABASE_PATH || path.join(backendDir, 'data', `e2e_local_${backendPort}.db`)
let databaseRemoved = false

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

function deleteDatabaseFile() {
  try {
    if (fs.existsSync(databasePath)) {
      fs.rmSync(databasePath)
    }
  } catch (error) {
    console.warn('Failed to remove local e2e database:', error)
  }
}

function removeLocalDatabase() {
  if (databaseRemoved) {
    return
  }
  try {
    deleteDatabaseFile()
    databaseRemoved = true
  } catch (error) {
    console.warn('Failed to remove local e2e database:', error)
  }
}

function sendSignal(pid, signal) {
  if (!pid) {
    return false
  }

  if (process.platform === 'win32') {
    const args = ['/T', '/PID', String(pid)]
    if (signal === 'SIGKILL') {
      args.push('/F')
    }

    try {
      const result = spawnSync('taskkill', args, { stdio: 'ignore' })
      return result.status === 0
    } catch (error) {
      console.warn(`Failed to send ${signal} to PID ${pid} via taskkill:`, error.message)
      return false
    }
  }

  try {
    process.kill(-pid, signal)
    return true
  } catch (error) {
    if (error.code !== 'ESRCH' && error.code !== 'EINVAL') {
      console.warn(`Failed to signal process group ${pid}:`, error.message)
    }
  }

  try {
    process.kill(pid, signal)
    return true
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.warn(`Failed to signal PID ${pid}:`, error.message)
    }
  }

  return false
}

function killProcessTree(proc, name) {
  if (!proc) {
    return
  }

  const pid = proc.pid
  if (!pid) {
    return
  }

  if (proc.exitCode !== null) {
    return
  }

  console.log(`Stopping ${name} (pid ${pid})...`)

  const escalateTimer = setTimeout(() => {
    if (proc.exitCode === null) {
      console.warn(`Force killing ${name} (pid ${pid})`)
      sendSignal(pid, 'SIGKILL')
    }
  }, 7000)

  if (typeof escalateTimer?.unref === 'function') {
    escalateTimer.unref()
  }

  proc.once('exit', (code, signal) => {
    clearTimeout(escalateTimer)
    console.log(`${name} exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`)
  })

  try {
    proc.kill('SIGTERM')
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.warn(`Failed to send SIGTERM to ${name} (pid ${pid}) via child.kill:`, error.message)
    }
  }

  const signaled = sendSignal(pid, 'SIGTERM')
  if (!signaled && proc.exitCode === null) {
    console.warn(`Falling back to force termination for ${name} (pid ${pid})`)
    clearTimeout(escalateTimer)
    sendSignal(pid, 'SIGKILL')
  }
}

let shuttingDown = false
let backendExited = false
let frontendExited = false
let deferredCleanupTimer = null
let keepAliveInterval = setInterval(() => {}, 60000)

function maybeCleanupDatabase() {
  if (databaseRemoved) {
    return
  }

  if ((backendExited || !backendProc) && (frontendExited || !frontendProc)) {
    removeLocalDatabase()
    if (deferredCleanupTimer) {
      clearTimeout(deferredCleanupTimer)
      deferredCleanupTimer = null
    }
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval)
      keepAliveInterval = null
    }
  }
}

function shutdown(reason = 'SIGTERM', options = {}) {
  const { immediateCleanup = false } = options

  if (shuttingDown) {
    if (immediateCleanup) {
      maybeCleanupDatabase()
    }
    return
  }
  shuttingDown = true

  console.log(`Shutting down local stack (${reason})...`)
  killProcessTree(frontendProc, 'frontend')
  killProcessTree(backendProc, 'backend')

  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }

  if (immediateCleanup) {
    maybeCleanupDatabase()
    return
  }

  deferredCleanupTimer = setTimeout(() => {
    maybeCleanupDatabase()
  }, 1000)

  if (typeof deferredCleanupTimer?.unref === 'function') {
    deferredCleanupTimer.unref()
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

deleteDatabaseFile()

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
    detached: process.platform !== 'win32',
  }
)

backendProc.on('exit', (code, signal) => {
  backendExited = true
  if (!shuttingDown && (code !== 0 || signal)) {
    console.warn(`Backend process exited unexpectedly (code ${code ?? 'null'}, signal ${signal ?? 'null'})`)
  }
  maybeCleanupDatabase()
})

backendProc.on('error', (error) => {
  console.error('Backend process error:', error)
  shutdown('backend-error')
})

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
    detached: process.platform !== 'win32',
  }
)

frontendProc.on('exit', (code, signal) => {
  frontendExited = true
  if (!shuttingDown && (code !== 0 || signal)) {
    console.warn(`Frontend process exited unexpectedly (code ${code ?? 'null'}, signal ${signal ?? 'null'})`)
  }
  maybeCleanupDatabase()
})

frontendProc.on('error', (error) => {
  console.error('Frontend process error:', error)
  shutdown('frontend-error')
})

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGHUP', () => shutdown('SIGHUP'))
process.once('SIGQUIT', () => shutdown('SIGQUIT'))

process.on('uncaughtException', (error) => {
  console.error('Unhandled exception in local stack script:', error)
  shutdown('uncaughtException', { immediateCleanup: true })
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in local stack script:', reason)
  shutdown('unhandledRejection', { immediateCleanup: true })
  process.exit(1)
})

process.on('exit', () => {
  shutdown('exit', { immediateCleanup: true })
})

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
    shutdown('startup-failed', { immediateCleanup: true })
    process.exit(1)
  })

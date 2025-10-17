# Development Environment Summary

## Updated Package Scripts

### Development Scripts
```bash
npm run dev              # Start both backend and frontend (smart runner)
npm run dev:backend      # Start only backend
npm run dev:frontend     # Start only frontend
npm run dev:restart      # Restart all services
npm run dev:stop         # Stop all services
npm run dev:check        # Check service status
npm run dev:logs         # Show live logs
```

### E2E Testing Scripts
```bash
npm run test:e2e         # Run full e2e tests with real Whisper transcription
npm run test:e2e:stub    # Run e2e tests with stub transcription (fast)
npm run test:e2e:local   # Original e2e test command
```

## Port and Database Separation

### Development Environment
- **Backend**: 8000+ (avoids e2e test ports 18200-18299)
- **Frontend**: 5173+ (avoids e2e test ports 18300-18399) 
- **Database**: `dev_transcriptions.db`
- **Environment**: `VITE_DEV_MODE=1`

### E2E Test Environment
- **Backend**: 18200+ (isolated range)
- **Frontend**: 18300+ (isolated range)
- **Database**: `e2e_local_{port}.db` (separate per test run)
- **Environment**: `VITE_E2E_MODE=1`

### Production Environment
- **Database**: `transcriptions.db`

## Smart Features

### Service Management
- Automatically starts and manages Redis (required)
- Automatically starts and manages Ollama (optional, for AI features)
- Downloads default Ollama model (llama3.2:1b) in background
- Graceful service shutdown and cleanup

### Port Management
- Automatically detects available ports
- Avoids conflicts between dev and test environments
- Shows clear warnings when using alternative ports

### Database Isolation
- Development uses separate database from production and tests
- E2E tests use unique databases per test run
- No data contamination between environments

### Process Management
- Tracks all spawned processes with PIDs
- Clean shutdown on Ctrl+C or SIGTERM
- Auto-restart failed services
- Health checking before reporting ready

### Environment Setup
- Auto-creates `.env` from example with local settings
- Configures correct Redis and Ollama URLs for local development
- Updates existing `.env` to use development database

## Usage Examples

### Start Development Environment
```bash
# Any of these work:
npm run dev
./dev
python3 dev_runner.py
```

### Run Tests Without Affecting Development
```bash
# Fast tests with stub transcription
npm run test:e2e:stub

# Full tests with real Whisper (slower)
npm run test:e2e
```

### Check What's Running
```bash
npm run dev:check
# Shows:
# [16:58:30] [MAIN] backend: RUNNING (or STOPPED)
# [16:58:30] [MAIN] frontend: STOPPED (or RUNNING)
```

### Monitor Development
```bash
npm run dev:logs    # Live logs from both services
npm run dev:restart # Force restart if something gets stuck
npm run dev:stop    # Clean shutdown
```

## Benefits

1. **No Conflicts**: Dev and test environments completely isolated
2. **Zero Configuration**: Just run `npm run dev` and everything works
3. **Smart Defaults**: Finds available ports, sets up databases automatically
4. **Easy Testing**: Can run tests while dev environment is running
5. **Clean Management**: Proper process tracking and shutdown
6. **Clear Status**: Always know what's running and on which ports

## Files Created/Modified

- `dev_runner.py` - Smart development runner
- `dev` - Simple bash alias
- `package.json` - Updated scripts
- `docs/development/ENVIRONMENT_GUIDE.md` - Comprehensive environment documentation
- `README.md` - Added local development section
- Backend `.env` - Auto-configured for local development
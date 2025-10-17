# Development Environment Guide

This guide explains how to correctly run the audio transcription application in different environments without conflicts.

## 🏗️ Environment Overview

The application supports **3 distinct environments** with **isolated ports and databases**:

| Environment | Ports | Database | Use Case |
|-------------|-------|----------|----------|
| **Local Dev** | 8000-8079 | `dev_transcriptions.db` | Active development |
| **Docker Dev** | 3000, 8080 | `transcriptions_dev.db` | Development testing |
| **Docker Prod** | 80, 8081 | `transcriptions_prod.db` | Production deployment |
| **E2E Tests** | 18200-18399 | `e2e_local_{port}.db` | Automated testing |

## 🚀 Environment Setup

### 1. Local Development (Recommended for Development)

**Best for**: Active development, debugging, hot-reload

**Ports**: 
- Backend: 8000+ (auto-detects available)
- Frontend: 5173+ (auto-detects available)

**Database**: `dev_transcriptions.db` (isolated from other environments)

**Setup**:
```bash
# Prerequisites
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# Start development environment
npm run dev
# OR
./dev
# OR 
python3 dev_runner.py
```

**Features**:
- ✅ Hot-reload for both backend and frontend
- ✅ Auto-starts Redis and Ollama services
- ✅ Isolated database and ports
- ✅ Process management and cleanup
- ✅ Health checks before reporting ready

**Access**:
- Frontend: http://localhost:5173 (or shown port)
- Backend API: http://localhost:8000 (or shown port)
- API Docs: http://localhost:8000/docs

### 2. Docker Development 

**Best for**: Testing containerized setup, CI/CD validation

**Ports**: 
- Frontend: 3000 (fixed)
- Backend: 8080 (fixed)

**Database**: `transcriptions_dev.db` (isolated from other environments)

**Setup**:
```bash
# Start all services
docker-compose up

# With hot-reload (development overlay)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Rebuild if dependencies changed
docker-compose up --build
```

**Access**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs

**✅ Note**: Uses isolated database - no data conflicts with other environments.

### 3. Docker Production

**Best for**: Production deployment, performance testing

**Ports**: 
- Frontend: 80 (via Nginx)
- Backend: 8081 (exposed)

**Database**: `transcriptions_prod.db` (isolated from other environments)

**Setup**:
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Or use convenience script
./run_prod.sh
```

**Access**:
- Frontend: http://localhost
- Backend API: http://localhost:8081
- API Docs: http://localhost:8081/docs

### 4. E2E Testing Environment

**Best for**: Automated testing, CI/CD

**Ports**: 
- Backend: 18200-18299 (auto-assigned)
- Frontend: 18300-18399 (auto-assigned)

**Database**: `e2e_local_{port}.db` (unique per test run)

**Setup**:
```bash
# Install E2E dependencies
cd tests/e2e
npm install
npx playwright install

# Run fast tests (stub transcription)
./scripts/run_local_e2e.sh

# Run Whisper tests (real transcription)
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"
```

## 🔄 Environment Switching

### Safe Switching Between Environments

**All environments can run simultaneously** without conflicts due to port and database isolation.

#### From Local Dev to Docker Dev:
```bash
# Stop local dev (Ctrl+C or)
npm run dev:stop

# Start Docker dev
docker-compose up
```

#### From Docker Dev to Docker Prod:
```bash
# Stop dev containers
docker-compose down

# Start production
docker-compose -f docker-compose.prod.yml up -d
```

#### Run E2E Tests While Dev Is Running:
```bash
# Local dev running on 8000+? No problem!
# E2E tests use 18200+ ports automatically
./scripts/run_local_e2e.sh
```

## ⚠️ Common Issues and Solutions

### Issue 1: Port Conflicts

**Symptom**: "Port already in use" errors

**Solution**: The local dev environment auto-detects available ports. Docker environments use fixed ports but are isolated from local dev.

```bash
# Check what's running on which ports
npm run dev:check
lsof -i :8000
lsof -i :5173
```

### Issue 2: Database Conflicts

**Symptom**: Wrong data appearing, transcription status inconsistencies

**Solution**: Different environments use different databases:
- Local dev: `dev_transcriptions.db`
- Docker: `transcriptions.db` 
- E2E: `e2e_local_{port}.db`

**Reset databases**:
```bash
# Reset local dev database
rm -f backend/dev_transcriptions.db

# Reset Docker database (stops containers first)
docker-compose down
docker volume rm transcribe_db_data
docker-compose up -d
```

### Issue 3: Service Dependencies

**Symptom**: "Redis not available", "Ollama not found"

**Solution**: 
- **Local dev**: Services started automatically by `dev_runner.py`
- **Docker**: Services defined in `docker-compose.yml`

```bash
# Local dev - check service status
npm run dev:check

# Docker - check container status
docker-compose ps
```

### Issue 4: Environment Variable Confusion

**Symptom**: Wrong API URLs, mixed configurations

**Solution**: Each environment has its own configuration:

```bash
# Local dev - uses port detection
VITE_API_BASE_URL=http://localhost:8000  # Auto-set by dev_runner.py

# Docker dev - fixed ports
VITE_API_BASE_URL=http://localhost:8000

# E2E tests - dynamic ports
VITE_API_BASE_URL=http://localhost:18200  # Auto-set by test runner
```

## 📋 Environment Commands Reference

### Local Development Commands
```bash
npm run dev              # Start dev environment
npm run dev:check        # Check service status  
npm run dev:stop         # Stop all services
npm run dev:restart      # Restart all services
npm run dev:logs         # Show live logs
./dev                    # Alternative startup script
python3 dev_runner.py    # Direct Python startup
```

### Docker Commands
```bash
# Development mode
docker-compose up                           # Start with logs
docker-compose up -d                        # Start in background
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up  # With dev overlay

# Production mode  
docker-compose -f docker-compose.prod.yml up -d    # Start production
./run_prod.sh                                      # Production script

# Management
docker-compose down                         # Stop containers
docker-compose logs -f [service]            # View logs
docker-compose restart [service]            # Restart service
docker-compose exec [service] bash          # Shell access
```

### E2E Test Commands
```bash
# Setup
cd tests/e2e && npm install && npx playwright install

# Fast tests (30-60 seconds)
./scripts/run_local_e2e.sh

# Whisper tests (40s-2min)  
USE_TRANSCRIPTION_STUB=0 ./scripts/run_local_e2e.sh --grep "@whisper-real"

# Debug mode
./scripts/run_local_e2e.sh --debug

# Specific tests
./scripts/run_local_e2e.sh --grep "Dashboard Ready"
```

## 🎯 Best Practices

### Development Workflow

1. **Use local dev** for daily development:
   ```bash
   npm run dev
   ```

2. **Test with Docker** before pushing:
   ```bash
   docker-compose up --build
   ```

3. **Run E2E tests** for validation:
   ```bash
   ./scripts/run_local_e2e.sh
   ```

4. **Deploy with production config**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Port Assignment Strategy

- **8000-8999**: Local development (auto-assigned)
- **5173-5199**: Local frontend (auto-assigned)  
- **18200-18299**: E2E backend (auto-assigned)
- **18300-18399**: E2E frontend (auto-assigned)
- **Fixed Docker ports**: No conflicts with auto-assigned ranges

### Database Strategy

- **Local dev**: Separate database for isolated development
- **Docker**: Shared database between dev/prod for consistency
- **E2E**: Unique database per test run for isolation

## 🔍 Troubleshooting Commands

### Check Environment Status
```bash
# Local dev
npm run dev:check
curl http://localhost:8000/health

# Docker
docker-compose ps
curl http://localhost:8000/health

# E2E (while running)
curl http://localhost:18200/health  # Check backend
```

### View Logs
```bash
# Local dev
npm run dev:logs

# Docker
docker-compose logs -f backend
docker-compose logs -f frontend

# E2E
# Logs shown during test execution
```

### Reset Environment
```bash
# Local dev
npm run dev:stop
rm -f backend/dev_transcriptions.db
npm run dev

# Docker dev
docker-compose down
docker-compose up --build

# Docker prod
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 📚 Related Documentation

- [DEVELOPMENT_SUMMARY.md](./DEVELOPMENT_SUMMARY.md) - Development scripts and features
- [PLAYWRIGHT_TEST_GUIDE.md](./PLAYWRIGHT_TEST_GUIDE.md) - E2E testing guide
- [../README.md](../../README.md) - Main project documentation
- [CLAUDE.md](../../CLAUDE.md) - Project overview and patterns

## 🆘 Quick Help

**Need to start developing quickly?**
```bash
npm run dev
```

**Need to test the app like a user?**
```bash
docker-compose up
```

**Need to run tests?**
```bash
./scripts/run_local_e2e.sh
```

**Need to deploy for production?**
```bash
./run_prod.sh
```

Each environment is fully isolated - choose the right tool for your task!
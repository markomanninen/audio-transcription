# Docker Validation Checklist

This checklist ensures Docker development and production setups work correctly before committing to GitHub.

## 🚀 Quick Validation

**Automated Script** (Recommended):
```bash
# Run full validation (development + production)
./scripts/docker-validation.sh

# Test only development setup
./scripts/docker-validation.sh --dev-only

# Test only production setup  
./scripts/docker-validation.sh --prod-only
```

## 📋 Manual Validation Steps

If you prefer manual testing or the automated script fails, follow these steps:

### Prerequisites ✅

- [ ] Docker Desktop installed and running
- [ ] Docker Compose available (`docker-compose --version`)
- [ ] Ports 3000, 8000, and 80 are available
- [ ] Local development servers stopped (to avoid conflicts)

### 1. Docker Development Setup

#### 1.1 Start Development Environment
```bash
# Clean start
docker-compose down -v --remove-orphans
docker-compose up -d --build
```

#### 1.2 Verify Services Started
```bash
# Check container status (all should be Up)
docker-compose ps

# Expected output:
# backend    Up    8000/tcp
# frontend   Up    3000/tcp  
# redis      Up    6379/tcp
# ollama     Up    11434/tcp
```

#### 1.3 Test Service Health
```bash
# Backend health (should return JSON with "status": "healthy")
curl http://localhost:8000/health

# Frontend serving (should return HTML)
curl http://localhost:3000

# API documentation (should contain "FastAPI")
curl http://localhost:8000/docs
```

#### 1.4 Test Internal Communication
```bash
# Backend can reach Redis
docker-compose exec backend ping -c 1 redis

# Backend can reach Ollama  
docker-compose exec backend ping -c 1 ollama
```

#### 1.5 Test Basic Functionality
- [ ] Open http://localhost:3000 in browser
- [ ] App loads without errors
- [ ] Create a test project
- [ ] Upload a small audio file (< 30 seconds)
- [ ] Start transcription (should work without errors)

#### 1.6 Cleanup Development
```bash
docker-compose down -v --remove-orphans
```

### 2. Docker Production Setup

#### 2.1 Start Production Environment
```bash
# Clean start
docker-compose -f docker-compose.prod.yml down -v --remove-orphans
docker-compose -f docker-compose.prod.yml up -d --build
```

#### 2.2 Verify Production Services
```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Expected output:
# backend    Up    8000/tcp
# frontend   Up    80/tcp (Nginx)
# redis      Up    6379/tcp  
# ollama     Up    11434/tcp
```

#### 2.3 Test Production Health
```bash
# Backend health
curl http://localhost:8000/health

# Frontend through Nginx (should return HTML)
curl http://localhost

# Check Nginx is serving (should show nginx in headers)
curl -I http://localhost
```

#### 2.4 Test Production Functionality
- [ ] Open http://localhost in browser (port 80)
- [ ] App loads without errors
- [ ] Create a test project
- [ ] Upload a small audio file
- [ ] Start transcription (should work without errors)

#### 2.5 Cleanup Production
```bash
docker-compose -f docker-compose.prod.yml down -v --remove-orphans
```

### 3. Environment Isolation Verification

#### 3.1 Port Isolation
- [ ] Local dev uses ports 8000+ (auto-assigned)
- [ ] Docker dev uses ports 3000, 8000 (fixed)
- [ ] Docker prod uses ports 80, 8000 (fixed)
- [ ] E2E tests use ports 18200+ (auto-assigned)

#### 3.2 Database Isolation
- [ ] Local dev: `backend/dev_transcriptions.db`
- [ ] Docker: Docker volume `db-data` → `transcriptions.db`
- [ ] E2E: `backend/e2e_local_{port}.db`

#### 3.3 Concurrent Environments
```bash
# Start local development
npm run dev &
LOCAL_PID=$!

# Wait for local dev to start
sleep 10

# Start Docker development (should not conflict)
docker-compose up -d

# Verify both running
curl http://localhost:5173  # Local frontend
curl http://localhost:3000  # Docker frontend
curl http://localhost:8000/health  # Could be either (local takes precedence)

# Cleanup
kill $LOCAL_PID
docker-compose down
```

## 🔍 Common Issues and Solutions

### Issue 1: Port Conflicts
**Symptoms**: "Port already in use" errors

**Solutions**:
```bash
# Check what's using ports
lsof -i :3000
lsof -i :8000
lsof -i :80

# Stop conflicting services
npm run dev:stop  # Stop local dev
docker-compose down  # Stop Docker dev
```

### Issue 2: Build Failures
**Symptoms**: Container build errors

**Solutions**:
```bash
# Force rebuild without cache
docker-compose build --no-cache

# Clean Docker system
docker system prune -f
docker volume prune -f
```

### Issue 3: Service Communication Issues
**Symptoms**: Backend can't reach Redis/Ollama

**Solutions**:
```bash
# Check network connectivity
docker-compose exec backend ping redis
docker-compose exec backend ping ollama

# Check container networks
docker network ls
docker network inspect transcribe_transcribe-network
```

### Issue 4: Frontend Not Loading
**Symptoms**: Browser shows connection errors

**Solutions**:
```bash
# Check frontend container logs
docker-compose logs frontend

# Verify frontend build
docker-compose exec frontend ls -la /app/dist  # Production
docker-compose exec frontend ls -la /app       # Development
```

### Issue 5: Database Issues
**Symptoms**: Transcription data not persisting

**Solutions**:
```bash
# Check database volume
docker volume inspect transcribe_db-data

# Check database file
docker-compose exec backend ls -la /app/data/

# Reset database if needed
docker-compose down -v
docker-compose up -d
```

## ✅ Validation Checklist Summary

Before committing to GitHub, ensure all items are checked:

### Docker Development Setup
- [ ] Containers start successfully
- [ ] Backend health endpoint returns 200
- [ ] Frontend serves HTML content on port 3000
- [ ] API documentation accessible
- [ ] Internal service communication works
- [ ] Basic transcription workflow functions
- [ ] Clean shutdown works

### Docker Production Setup  
- [ ] Production containers start successfully
- [ ] Backend health endpoint returns 200
- [ ] Frontend serves through Nginx on port 80
- [ ] Nginx headers present in responses
- [ ] Basic transcription workflow functions
- [ ] Clean shutdown works

### Environment Isolation
- [ ] Port ranges don't conflict
- [ ] Database files are isolated
- [ ] Local dev and Docker can run concurrently
- [ ] E2E tests can run alongside other environments

### Documentation
- [ ] README.md has correct Docker instructions
- [ ] ENVIRONMENT_GUIDE.md covers Docker setup
- [ ] Port numbers are consistent across docs
- [ ] No broken links to deleted files

## 🚀 Ready for Commit

Once all checklist items are verified:

```bash
# Final validation
./scripts/docker-validation.sh

# If all tests pass:
git add -A
git commit -m "Docker setup validated and ready for production

- ✅ Docker development setup tested and working
- ✅ Docker production setup tested and working  
- ✅ Environment isolation verified
- ✅ Port conflicts resolved
- ✅ Documentation updated and consistent

🐳 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin feat/production-docker-setup
```

## 📚 References

- [ENVIRONMENT_GUIDE.md](./ENVIRONMENT_GUIDE.md) - Complete environment setup guide
- [docker-compose.yml](../../docker-compose.yml) - Development configuration
- [docker-compose.prod.yml](../../docker-compose.prod.yml) - Production configuration
- [scripts/docker-validation.sh](../../scripts/docker-validation.sh) - Automated validation script
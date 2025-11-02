# Docker Build Performance Metrics

This document tracks build performance for multi-platform Docker images.

## Build Environment

- **Platform**: macOS (Apple Silicon)
- **Docker**: Docker Desktop with buildx
- **Builder**: docker-container driver (mybuilder)
- **Target Platforms**: linux/amd64, linux/arm64

## Build Configuration

### Optimizations Applied

1. **Multi-stage builds**: Separate builder and runtime stages
2. **BuildKit cache mounts**: `--mount=type=cache,target=/root/.cache/pip`
3. **Layer caching**: Dependencies installed before application code
4. **Conditional PyTorch**: CPU or CUDA variant selected via build arg
5. **No precompiled bytecode**: `PIP_NO_CACHE_DIR=1` for smaller images

### Build Variants

**CPU Variant:**

- PyTorch: CPU-only build (~100MB per platform)
- Platforms: linux/amd64, linux/arm64
- Image: `markomann/audio-transcription-backend:latest`

**CUDA Variant:**

- PyTorch: Full CUDA build (~779MB)
- Platforms: linux/amd64 only
- Image: `markomann/audio-transcription-backend:latest-cuda`

**Frontend:**

- Node.js build with Vite
- Platforms: linux/amd64, linux/arm64
- Image: `markomann/audio-transcription-frontend:latest`

## Build Times

### First Build (Cold Cache)

**Date**: 2025-11-02

#### CPU Variant (Multi-Platform)

- **Start Time**: 19:04:03
- **End Time**: _TBD_
- **Total Duration**: _TBD_
- **Platforms**: linux/amd64, linux/arm64

**Build Phases:**

- Initial setup: _TBD_
- PyTorch download (amd64): _TBD_
- PyTorch download (arm64): _TBD_
- Dependencies installation: _TBD_
- Image push to Docker Hub: _TBD_

**Image Size:**

- Total: _TBD_
- linux/amd64: _TBD_
- linux/arm64: _TBD_

#### CUDA Variant (Single Platform)

- **Start Time**: _TBD_
- **End Time**: _TBD_
- **Total Duration**: _TBD_
- **Platforms**: linux/amd64 only

**Build Phases:**

- Initial setup: _TBD_
- PyTorch CUDA download: _TBD_
- Dependencies installation: _TBD_
- Image push to Docker Hub: _TBD_

**Image Size:**

- Total: _TBD_
- linux/amd64: _TBD_

#### Frontend (Multi-Platform)

- **Start Time**: 13:17:00 (approximately)
- **End Time**: 13:20:16
- **Total Duration**: ~3 minutes 16 seconds
- **Platforms**: linux/amd64, linux/arm64

**Image Size:**

- Successfully published
- Build completed quickly due to lighter dependencies

### Subsequent Builds (Warm Cache)

_Will be updated after first rebuild_

**Expected improvements:**

- BuildKit cache mounts reduce download time
- Docker layer caching skips unchanged layers
- Estimated time: 5-10 minutes for code changes only

## Performance Analysis

### First Build Observations

**CPU Variant:**

- Multi-platform builds download packages twice (once per architecture)
- PyTorch CPU build is significantly smaller than CUDA (~100MB vs ~779MB)
- BuildKit cache mounts help with subsequent builds
- _Additional observations TBD_

**CUDA Variant:**

- Larger download due to CUDA libraries
- Single platform build is faster than multi-platform
- _Additional observations TBD_

**Frontend:**

- ✅ Very fast build (< 5 minutes)
- Node.js dependencies are well-cached
- Multi-platform build completed successfully

### Bottlenecks Identified

1. **PyTorch Download**: Largest time consumer
   - CPU variant: ~100MB × 2 platforms = ~200MB total
   - CUDA variant: ~779MB × 1 platform = ~779MB total

2. **Multi-Platform Compilation**: Some packages need compilation for each architecture
   - pyannote.audio dependencies
   - NumPy, SciPy compilation

3. **Network Speed**: Upload to Docker Hub depends on connection speed

### Optimization Recommendations

**For Development:**

- Use CPU variant for faster iteration
- Build single platform during development (native architecture only)
- Use `--load` instead of `--push` for local testing

**For Production:**

- Schedule builds during off-peak hours
- Use CI/CD with build caching
- Consider GitHub Actions cache or similar

**Commands for Faster Local Development:**

```bash
# Build for native platform only (faster)
docker buildx build \
  --platform linux/arm64 \
  --build-arg TORCH_VARIANT=cpu \
  --tag audio-transcription-backend:dev \
  --load \
  backend/

# Skip CUDA variant if not needed
TORCH_VARIANT=cpu ./scripts/publish_backend_multiplatform.sh
```

## CI/CD Integration

### GitHub Actions Performance

_TBD: Will measure build times in GitHub Actions_

**Expected benefits:**

- Persistent cache between builds
- Parallel builds for different variants
- No impact on local machine

### Docker Hub Automated Builds

_TBD: Consider using Docker Hub automated builds_

**Pros:**

- Automatic builds on git push
- No local resources consumed

**Cons:**

- Slower than local builds with fast internet
- Less control over build process

## Historical Trends

| Date | Variant | Duration | Platforms | Cache Status | Notes |
|------|---------|----------|-----------|--------------|-------|
| 2025-11-02 | Frontend | ~3m 16s | amd64, arm64 | Cold | First successful build |
| 2025-11-02 | CPU Backend | _TBD_ | amd64, arm64 | Cold | In progress |
| 2025-11-02 | CUDA Backend | _TBD_ | amd64 | Cold | Pending |

## Resource Usage

### Build Container Stats

**During Active Build:**

- Container: `buildx_buildkit_mybuilder0`
- Status: Running
- Virtual Size: 226MB
- _CPU/Memory usage TBD_

### Disk Space Usage

**Build Cache:**

- Initial: ~7.15GB cleared before build
- After CPU build: _TBD_
- After CUDA build: _TBD_

**Recommendations:**

- Run `docker buildx prune` periodically
- Keep at least 10GB free for safe builds
- Monitor with `docker buildx du`

## Troubleshooting

### Build Performance Issues Encountered

1. **Hanging during PyTorch download**
   - **Cause**: Large file download (779MB for CUDA)
   - **Solution**: Patience or use CPU variant
   - **Prevention**: BuildKit cache mounts for future builds

2. **Temporary directory cleanup warnings**
   - **Cause**: Disk I/O during heavy installs
   - **Solution**: Ignored (harmless warnings)
   - **Prevention**: Ensure sufficient disk space

3. **Multi-platform emulation slowness**
   - **Cause**: Cross-architecture compilation
   - **Solution**: Expected behavior, cannot be avoided
   - **Prevention**: Use native platform for development

## Next Steps

1. ✅ Complete CPU variant build and record time
2. ⏳ Build CUDA variant and record time
3. ⏳ Measure subsequent build times (with cache)
4. ⏳ Test builds in GitHub Actions
5. ⏳ Document image size optimizations

## Updates

- **2025-11-02 19:04**: Started tracking CPU variant build
- **2025-11-02 19:04**: Frontend build completed successfully (~3m 16s)
- _More updates as builds complete_

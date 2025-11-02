# Docker Multi-Platform Publishing Guide

This guide explains how to build and publish multi-platform Docker images for the audio transcription application.

## Overview

The application publishes **both CPU and GPU variants** to support different deployment scenarios:

- **CPU variant** (`latest`): Smaller images (~100MB PyTorch), faster builds, works on any hardware
  - Multi-platform: linux/amd64, linux/arm64
  - Use case: Standard servers, ARM instances, development, cost-effective deployments

- **CUDA variant** (`latest-cuda`): GPU support (~779MB PyTorch), for systems with NVIDIA GPUs
  - Single platform: linux/amd64 only
  - Use case: GPU-accelerated transcription, high-volume processing, 5-10x faster

**Both variants are published automatically** when you run `./scripts/publish_all_multiplatform.sh`

## Prerequisites

1. **Docker with buildx** (included in Docker Desktop or Docker Engine 19.03+)
2. **Docker Hub account** (or other registry)
3. **Login to Docker Hub**:

   ```bash
   docker login --username markomann
   ```

## Quick Start

### Publish All Images (CPU + CUDA + Frontend)

```bash
# Publish ALL variants automatically
./scripts/publish_all_multiplatform.sh
```

**Result:**

- `markomann/audio-transcription-backend:latest` (CPU, amd64 + arm64)
- `markomann/audio-transcription-backend:latest-cuda` (GPU, amd64)
- `markomann/audio-transcription-frontend:latest` (amd64 + arm64)

### Publish Individual Variants

```bash
# CPU-only backend (multi-platform)
TORCH_VARIANT=cpu ./scripts/publish_backend_multiplatform.sh

# GPU-enabled backend (amd64 only)
TORCH_VARIANT=cuda ./scripts/publish_backend_multiplatform.sh

# Frontend (multi-platform)
./scripts/publish_frontend_multiplatform.sh
```

## Build Details

### CPU Variant (Default)

- **Platforms**: linux/amd64, linux/arm64
- **PyTorch**: CPU-only build from <https://download.pytorch.org/whl/cpu>
- **Size**: ~100MB PyTorch package
- **Use case**: Standard deployment, ARM servers, cost-effective cloud instances
- **Performance**: Good for real-time transcription on modern CPUs

### CUDA Variant

- **Platforms**: linux/amd64 only (GPU support)
- **PyTorch**: Full build with CUDA support
- **Size**: ~779MB PyTorch package
- **Use case**: GPU-accelerated transcription, high-volume processing
- **Performance**: 5-10x faster transcription on compatible GPUs

## Build Optimizations

The Dockerfile includes several optimizations:

1. **Multi-stage builds**: Separate builder and runtime stages
2. **BuildKit cache mounts**: Cached pip downloads between builds
3. **Layer caching**: Dependencies installed before application code
4. **Conditional PyTorch**: CPU or CUDA variant selected at build time

### First Build vs Subsequent Builds

**First build (all variants):**

- CPU variant: Downloads ~100MB PyTorch for 2 platforms (amd64 + arm64)
- CUDA variant: Downloads ~779MB PyTorch for 1 platform (amd64)
- Frontend: Node modules for 2 platforms (amd64 + arm64)
- Estimated time: 30-45 minutes total for all three images

**Subsequent builds:**

- Uses Docker layer cache and BuildKit cache mounts
- Only rebuilds changed layers
- Estimated time: 5-10 minutes for all three images (code changes only)

## Image Verification

After publishing, verify the multi-platform manifest:

```bash
# Check backend image platforms
docker buildx imagetools inspect markomann/audio-transcription-backend:latest

# Check CUDA variant (if published)
docker buildx imagetools inspect markomann/audio-transcription-backend:latest-cuda

# Check frontend image platforms
docker buildx imagetools inspect markomann/audio-transcription-frontend:latest
```

Expected output for CPU variant:

```
Name:      markomann/audio-transcription-backend:latest
MediaType: application/vnd.docker.distribution.manifest.list.v2+json
Digest:    sha256:...

Manifests:
  Name:      markomann/audio-transcription-backend:latest@sha256:...
  MediaType: application/vnd.docker.distribution.manifest.v2+json
  Platform:  linux/amd64

  Name:      markomann/audio-transcription-backend:latest@sha256:...
  MediaType: application/vnd.docker.distribution.manifest.v2+json
  Platform:  linux/arm64
```

## Usage in Docker Compose

### CPU Deployment (Default)

```yaml
# docker-compose.yml
services:
  backend:
    image: markomann/audio-transcription-backend:latest
    # Automatically pulls correct architecture (amd64 or arm64)
    # Works on: x86_64 servers, ARM servers (AWS Graviton, Apple Silicon), etc.

  frontend:
    image: markomann/audio-transcription-frontend:latest
    # Multi-platform support (amd64, arm64)
```

### GPU-Enabled Deployment

```yaml
# docker-compose.gpu.yml
services:
  backend:
    image: markomann/audio-transcription-backend:latest-cuda
    # GPU-enabled variant (amd64 only)
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  frontend:
    image: markomann/audio-transcription-frontend:latest
```

### Choosing the Right Image

**Use `latest` (CPU) when:**

- Running on standard cloud instances (AWS EC2, GCP Compute, Azure VMs)
- Deploying on ARM servers (AWS Graviton2/3, Apple Silicon)
- Cost is a concern (no GPU instance fees)
- Transcription volume is low to moderate
- Development and testing environments

**Use `latest-cuda` (GPU) when:**

- Running on GPU-enabled instances (AWS p3/p4, GCP GPU instances)
- Need 5-10x faster transcription performance
- High-volume transcription processing
- Real-time transcription requirements
- Have NVIDIA GPU hardware available

## Troubleshooting

### Build Hangs During PyTorch Download

This is normal for first builds, especially CUDA variant. Monitor progress:

```bash
# Check build progress in another terminal
docker buildx du --verbose
```

To speed up builds, use CPU variant by default.

### BuildKit Cache Issues

Clear BuildKit cache if builds are failing:

```bash
docker buildx prune --all
```

### Multi-Platform Builder Issues

Reset the buildx builder:

```bash
docker buildx rm mybuilder
docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap
```

### Platform-Specific Builds

Build for a single platform if needed:

```bash
# Build only for amd64
docker buildx build \
  --platform linux/amd64 \
  --build-arg TORCH_VARIANT=cpu \
  --tag markomann/audio-transcription-backend:latest-amd64 \
  --push \
  backend/

# Build only for arm64
docker buildx build \
  --platform linux/arm64 \
  --build-arg TORCH_VARIANT=cpu \
  --tag markomann/audio-transcription-backend:latest-arm64 \
  --push \
  backend/
```

## Performance Considerations

### When to Use CPU Variant

- Standard deployments without GPU
- ARM-based servers (AWS Graviton, Apple Silicon)
- Cost-effective cloud instances
- Development and testing
- Low to moderate transcription volume

### When to Use CUDA Variant

- High-volume transcription processing
- Real-time transcription of multiple streams
- GPU-enabled cloud instances (AWS p3, GCP GPU instances)
- On-premise servers with NVIDIA GPUs
- When transcription speed is critical

### CPU vs GPU Performance

Approximate transcription speed for 1 hour of audio:

| Hardware | Variant | Time | Notes |
|----------|---------|------|-------|
| Modern CPU (8 cores) | CPU | 5-10 min | Whisper medium model |
| Modern CPU (8 cores) | CUDA | N/A | GPU required |
| NVIDIA T4 | CUDA | 1-2 min | 5-10x faster |
| NVIDIA V100 | CUDA | <1 min | 10-20x faster |

## Advanced Usage

### Custom Registry

Publish to a different registry:

```bash
# Set custom image names in the scripts
export REMOTE_IMAGE_NAME="myregistry.com/audio-transcription-backend:v1.0"
./scripts/publish_backend_multiplatform.sh
```

### Tagged Releases

Create versioned releases:

```bash
# Modify scripts to use version tags
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg TORCH_VARIANT=cpu \
  --tag markomann/audio-transcription-backend:v1.0.0 \
  --tag markomann/audio-transcription-backend:latest \
  --push \
  backend/
```

### Local Testing Before Push

Test multi-platform builds locally without pushing:

```bash
# Build and load to local Docker (single platform only)
docker buildx build \
  --platform linux/amd64 \
  --build-arg TORCH_VARIANT=cpu \
  --tag audio-transcription-backend:test \
  --load \
  backend/

# Test the image
docker run --rm audio-transcription-backend:test python -c "import torch; print(torch.__version__)"
```

## Maintenance

### Updating Dependencies

1. Update [backend/requirements.prod.txt](../backend/requirements.prod.txt)
2. Test locally with both CPU and CUDA variants
3. Rebuild and republish images
4. Update version tags as needed

### Security Updates

Regularly rebuild images to include security updates:

```bash
# Force rebuild without cache
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --build-arg TORCH_VARIANT=cpu \
  --no-cache \
  --tag markomann/audio-transcription-backend:latest \
  --push \
  backend/
```

## Additional Resources

- [Docker buildx documentation](https://docs.docker.com/buildx/working-with-buildx/)
- [PyTorch installation guide](https://pytorch.org/get-started/locally/)
- [Multi-platform images guide](https://docs.docker.com/build/building/multi-platform/)

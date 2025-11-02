# Publishing to Docker Hub

This document provides instructions for building the production Docker images and publishing them to Docker Hub.

## Prerequisites

- You have Docker and Docker Compose installed.
- You have a Docker Hub account.

## Steps to Publish

### 1. Log in to Docker Hub

Open your terminal and run the following command to log in to your Docker Hub account. You will be prompted for your username and password.

```bash
docker login
```

### 2. Build the Production Images

Use the `docker-compose.prod.yml` file to build the production-ready images for the backend and frontend services.

```bash
docker compose -f docker-compose.prod.yml build
```

This command will build the images using the `Dockerfile` in the `backend` directory and the `Dockerfile.prod` in the `frontend` directory.

> **Tip:** The backend Dockerfile now uses a multi-stage build and production-only requirements file (`backend/requirements.prod.txt`). If you modify backend dependencies, update that file so the production image stays slim.

### 3. Tag the Images for Docker Hub

Before you can push the images, you need to tag them with your Docker Hub username and the desired repository name.

Replace `<your-dockerhub-username>` with your actual Docker Hub username.

```bash
# Tag the backend image
docker tag audio-transcription-backend <your-dockerhub-username>/audio-transcription-backend:latest

# Tag the frontend image
docker tag audio-transcription-frontend <your-dockerhub-username>/audio-transcription-frontend:latest
```

### 4. Push the Images to Docker Hub

Once the images are tagged, you can push them to your Docker Hub repository.

```bash
# Push the backend image
docker push <your-dockerhub-username>/audio-transcription-backend:latest

# Push the frontend image
docker push <your-dockerhub-username>/audio-transcription-frontend:latest
```

After these steps are complete, the images will be available on your Docker Hub account and will be searchable in the Docker Desktop application.

### 5. Updating Images After the Initial Publish

You can overwrite an existing tag at any time—rebuild locally and push again using the same tag (for example `:latest`) or publish versioned tags like `:v1.0.1`. Docker Hub automatically serves the newest image layers associated with whatever tag you push.

Typical quick update flow:

```bash
# rebuild only the backend (or frontend) after code changes
docker compose -f docker-compose.prod.yml build backend

# retag and push
docker tag transcribe-backend:latest <your-dockerhub-username>/audio-transcription-backend:latest
docker push <your-dockerhub-username>/audio-transcription-backend:latest
```

### Troubleshooting Backend Push Size

The backend image can grow large (≈3 GB) because it includes Whisper models and build artifacts. If the push fails with a 400 error or times out:

- Use a multi-stage Docker build so the final image only contains runtime dependencies.
- Install the smaller Whisper model (e.g. set `WHISPER_MODEL_SIZE=base`) and download larger models at runtime if needed.
- Remove cached artifacts, build toolchains, and other temporary files before the final image layer is committed.

These changes bring the image size down significantly and make Docker Hub pushes more reliable, especially on slower or sandboxed networks.

After pushing, you can pull and run the production stack anywhere with:

```bash
docker pull <your-dockerhub-username>/audio-transcription-backend:latest
docker pull <your-dockerhub-username>/audio-transcription-frontend:latest
docker compose -f docker-compose.prod.yml up -d
```

Or use the helper script for an end-to-end startup (pull, health checks, model preload):

```bash
./run_prod.sh
```

The script ensures `backend/.env` exists (auto-copies the example on first run), checks for occupied ports, pulls images, starts the compose stack, pre-downloads the configured Whisper and Ollama models, and reports the URLs for the UI and API along with troubleshooting tips for Redis/Ollama.

### Quick Publish Scripts

To rebuild and push the backend image with one command:

```bash
./publish_backend.sh
```

The script wraps the compose build, tags the image as `markomann/audio-transcription-backend:latest`, and pushes it to Docker Hub.

Likewise for the frontend:

```bash
./publish_frontend.sh
```

For publishing both images in sequence:

```bash
./publish_all.sh

Notes about the helper scripts:

- The helper scripts (`publish_*`) prefer the modern `docker compose` command but will fall back to `docker-compose` if the newer CLI plugin is not available.
- They attempt to locate the image built by compose and tag it for pushing. If you run into tagging errors, build locally and tag explicitly using `docker image ls` to locate the image id.
- On Windows, run the bash publish scripts from WSL or Git Bash (they are regular bash scripts). PowerShell users can run `docker` and `docker-compose` commands directly or use WSL for the helper scripts.
```

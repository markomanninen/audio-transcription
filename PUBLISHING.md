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
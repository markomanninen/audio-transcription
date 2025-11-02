FROM python:3.11-slim AS builder

# Build argument to choose PyTorch variant (cpu or cuda)
ARG TORCH_VARIANT=cpu

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install build dependencies for wheels compiled in this stage
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only runtime Python dependencies into a clean prefix
COPY requirements.prod.txt .
# Use cache mount for pip downloads (speeds up rebuilds)
# Install PyTorch variant based on build arg, then install other dependencies
RUN --mount=type=cache,target=/root/.cache/pip \
    if [ "$TORCH_VARIANT" = "cpu" ]; then \
        pip install --no-compile --prefix=/install \
            torch==2.3.1 torchaudio==2.3.1 \
            --index-url https://download.pytorch.org/whl/cpu; \
    else \
        pip install --no-compile --prefix=/install \
            torch==2.3.1 torchaudio==2.3.1; \
    fi && \
    pip install --no-compile --prefix=/install -r requirements.prod.txt

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WHISPER_MODEL_SIZE=base

# Install runtime system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    libmagic1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pre-installed Python packages from the builder layer
COPY --from=builder /install /usr/local

# Copy application source code
COPY app ./app
COPY requirements.prod.txt ./requirements.prod.txt
COPY .env.example ./
COPY .env.external-ollama.example ./

# Prepare data directories used at runtime
RUN mkdir -p /app/data/audio

EXPOSE 8000

# Run the application (multi-worker for responsiveness under CPU load)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

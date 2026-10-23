# Strands Decider 2B — CPU reference image (local / optional).
# AWS production path uses Dockerfile.gpu via CodeBuild (`make build-image`).
#
# Build: docker build --platform linux/amd64 -t grid-dodger-decider-cpu deploy/decider

FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN pip install --upgrade pip \
    && pip install --index-url https://download.pytorch.org/whl/cpu torch \
    && pip install "strands-decider==0.1.0" \
    && pip install --force-reinstall --no-deps \
         --index-url https://download.pytorch.org/whl/cpu torch \
    && pip uninstall -y triton 2>/dev/null || true \
    && rm -rf /usr/local/lib/python3.12/site-packages/nvidia \
              /usr/local/lib/python3.12/site-packages/cuda \
              /usr/local/lib/python3.12/site-packages/pip \
              /usr/local/lib/python3.12/site-packages/setuptools \
              /usr/local/lib/python3.12/site-packages/wheel \
              /root/.cache

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DECIDER_MODEL=StrandsAgents/strands-decider-2B-hobson-v19 \
    PORT=8000 \
    HF_HOME=/models/hf

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.12/site-packages \
                    /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/strands-decider /usr/local/bin/strands-decider

WORKDIR /app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["sh", "-c", "strands-decider serve \"$DECIDER_MODEL\" --host 0.0.0.0 --port \"$PORT\" --device cpu"]

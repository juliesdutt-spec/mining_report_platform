# Backend image for hosts that build from a Dockerfile (Render).
#
# Railway builds this service with Nixpacks (see nixpacks.toml) and is not
# affected by this file: it lives under deploy/ precisely so that Railway,
# which switches to Docker when it finds a Dockerfile at the repository root,
# keeps building the way it always has.
#
# The image exists because of one dependency that pip cannot install.
# pytesseract is a wrapper around the tesseract binary, and the Hindi and
# Telugu language data are separate packages again. A native Python runtime
# would install the wrapper, OCR would fail page by page inside a caught
# exception, and scanned reports would be stored as empty documents.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tesseract-ocr tesseract-ocr-hin tesseract-ocr-tel \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a code change does not reinstall them.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Render supplies PORT; 8000 is for running the image locally.
CMD ["sh", "-c", "uvicorn backend.api:app --host 0.0.0.0 --port ${PORT:-8000}"]

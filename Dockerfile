# Kincaid IQ — portable container image.
# Stage 1 builds the React/Vite frontend (Node). Stage 2 is the Python/FastAPI
# runtime that serves both the API and the built static frontend on one port.
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ENV=production \
    PORT=5000

# System libraries required by WeasyPrint (PDF generation), Pillow, lxml and
# pdfplumber, plus CA certs and base fonts for correct PDF/text rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
        libcairo2 libffi8 libharfbuzz0b libfribidi0 \
        shared-mime-info fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies via uv. Export the locked dependency set from
# uv.lock to a pip-format requirements file (--no-emit-project skips the app
# itself, which has no build-system), then install it into the system env for
# an exact, reproducible build.
COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv \
    && uv export --frozen --no-dev --no-emit-project -o requirements.txt \
    && uv pip install --system --no-cache -r requirements.txt

# Application source (runtime only — no client/, attached_assets/, etc.).
COPY main.py ./
COPY backend ./backend
COPY compliance_engine ./compliance_engine

# Built frontend from local folder
COPY dist ./dist
# set DUCKDB_REMOTE_URL (e.g. an S3 object) and it is downloaded here on boot.
RUN mkdir -p data uploads

EXPOSE 5000

# Honor a platform-provided PORT (App Runner / ECS inject one) but default to 5000.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-5000} --h11-max-incomplete-event-size 209715200"]

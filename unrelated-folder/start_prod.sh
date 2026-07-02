#!/bin/bash
set -e

echo "=========================================="
echo "  Kincaid IQ — Production Server"
echo "  Gunicorn + Uvicorn Workers"
echo "=========================================="

exec .pythonlibs/bin/uvicorn main:app \
  --host 0.0.0.0 \
  --port 5000 \
  --workers 2 \
  --timeout-keep-alive 5 \
  --h11-max-incomplete-event-size 209715200 \
  --log-level info

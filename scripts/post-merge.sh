#!/bin/bash
set -e
npm install --no-audit --no-fund --prefer-offline
python3 -c "from backend.database import engine, Base; import backend.models; Base.metadata.create_all(engine); print('DB tables synced OK')"

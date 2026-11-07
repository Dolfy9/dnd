#!/usr/bin/env bash
# Spustí wiki Montelienu s editací na http://localhost:8000 (potřeba: pip install -r requirements.txt)
set -e
cd "$(dirname "$0")"
PY=python3; [ -x /usr/bin/python3 ] && PY=/usr/bin/python3
exec "$PY" server.py

#!/usr/bin/env bash
# Spustí wiki Montelienu na http://localhost:8000 (potřeba: pip install -r requirements.txt)
set -e
cd "$(dirname "$0")"
python3 build.py
exec mkdocs serve -f mkdocs.yml -a "${HOST:-127.0.0.1}:${PORT:-8000}"

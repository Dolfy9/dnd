# ---------- frontend build ----------
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY app/frontend/package.json app/frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY app/frontend/ ./
RUN npm run build

# ---------- backend ----------
FROM python:3.12-slim AS backend
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /srv

# závislosti (držet sync s app/backend/pyproject.toml)
RUN pip install --no-cache-dir \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "pydantic>=2.7" \
    "PyYAML>=6.0" "Markdown>=3.6" "argon2-cffi>=23.1" \
    "itsdangerous>=2.2" "watchdog>=4.0" "Pillow>=10.0" "python-multipart>=0.0.9"

COPY app/backend/ /srv/app/backend/
# sestavené SPA do statického adresáře backendu
COPY --from=frontend /fe/dist /srv/app/backend/app/static/

EXPOSE 8001
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--app-dir", "/srv/app/backend"]

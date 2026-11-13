#!/usr/bin/env bash
# Nahraje repozitář na Oracle VM a spustí bootstrap.
# Použití (Git Bash):  bash app/deploy/push.sh <IP_VM>
set -euo pipefail
IP="${1:?použití: bash app/deploy/push.sh <IP_VM>}"
KEY="${SSH_KEY:-$HOME/.ssh/montelien_oracle}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new ubuntu@$IP"

cd "$(dirname "$0")/../.."
echo "==> Balím repo (bez node_modules/.venv/dist/__pycache__)…"
tar --exclude='app/frontend/node_modules' \
    --exclude='app/frontend/dist' \
    --exclude='app/backend/.venv' \
    --exclude='*/__pycache__' \
    --exclude='.git' \
    -czf /tmp/montelien.tgz .

echo "==> Nahrávám na ubuntu@$IP…"
scp -i "$KEY" -o StrictHostKeyChecking=accept-new /tmp/montelien.tgz "ubuntu@$IP":~/montelien.tgz

echo "==> Rozbaluji + bootstrap…"
$SSH 'mkdir -p ~/montelien && tar -xzf ~/montelien.tgz -C ~/montelien && rm ~/montelien.tgz && bash ~/montelien/app/deploy/bootstrap.sh'

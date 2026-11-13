#!/usr/bin/env bash
# Bootstrap Montelienu na Oracle Cloud VM (Ubuntu 22.04, uživatel ubuntu).
# Spustí se automaticky z push.sh, nebo ručně: bash ~/montelien/app/deploy/bootstrap.sh
set -euo pipefail
cd ~/montelien

echo "==> 1/5 Docker"
sudo apt-get update -y
DEBIAN_FRONTEND=noninteractive sudo apt-get install -y docker.io docker-compose-v2 curl iptables-persistent
sudo usermod -aG docker "$USER" || true

echo "==> 2/5 Firewall (80/443 — Oracle Ubuntu má default REJECT pravidlo)"
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save >/dev/null 2>&1 || true

PUBIP="$(curl -s4 --max-time 8 ifconfig.me || true)"
[ -z "$PUBIP" ] && PUBIP="$(curl -s4 --max-time 8 icanhazip.com | tr -d ' ')"
echo "==> 3/5 .env (veřejná IP: ${PUBIP:-?})"
cd ~/montelien/app
if [ ! -f .env ]; then
  SECRET=$(head -c32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  printf 'MONT_SECRET=%s\nMONT_COOKIE_SECURE=1\n' "$SECRET" > .env
  chmod 600 .env
fi

echo "==> 4/5 Caddyfile (HTTPS přes sslip.io)"
cat > Caddyfile <<EOF
montelien.${PUBIP}.sslip.io {
    reverse_proxy app:8001
}
EOF

echo "==> 5/5 Build + start"
sudo docker compose up -d --build

echo ""
echo "======================================================"
echo "  Hotovo. Aplikace: https://montelien.${PUBIP}.sslip.io"
echo "  (certifikát se generuje ~1 min — nejdřív http, pak https)"
echo ""
echo "  Admin účet: sudo docker compose -f ~/montelien/app/docker-compose.yml logs app | grep 'admin'"
echo "  nebo: sudo docker compose -f ~/montelien/app/docker-compose.yml exec app cat /data/admin_password.txt"
echo "======================================================"

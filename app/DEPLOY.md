# Nasazení Montelienu — zdarma

Stack: FastAPI + SQLite + souborové repo + sestavené React SPA. Docker je hotový
(`app/Dockerfile`, `app/docker-compose.yml`, `app/Caddyfile`) — stačí ho někde spustit.

## Varianta A — Oracle Cloud Always Free (doporučeno, běží pořád)

Skutečný VPS zdarma napořád: ARM VM až 4 CPU / 24 GB RAM, stačí i 1 GB.
(Registrace chce kartu jen na ověření, Always Free se nikdy neúčtuje.)

1. **Vytvoř VM**: cloud.oracle.com → Compute → Instances → Create instance
   - Image: **Canonical Ubuntu 22.04** (aarch64 u ARM, x86 u AMD Micro)
   - Shape: **VM.Standard.A1.Flex** (1 OCPU / 4 GB stačí) — Always Free eligible
   - SSH klíč: vlož **public** klíč `~/.ssh/montelien_oracle.pub`
2. **Otevři porty v cloudu**: Instance detail → Subnet → Security List →
   Add Ingress Rules: `0.0.0.0/0` → TCP **80** a TCP **443**
   (firewall uvnitř VM řeší `bootstrap.sh`)
3. **Nasazení jedním příkazem** (z tvého počítače, Git Bash):
   ```bash
   bash app/deploy/push.sh <IP_VM>
   ```
   Nahraje repo přes SSH + `deploy/bootstrap.sh` nainstaluje Docker,
   otevře porty, vygeneruje `MONT_SECRET`, zapíše HTTPS `Caddyfile`
   (sslip.io z veřejné IP) a spustí compose.
4. **Přístup**: `https://montelien.<IP>.sslip.io` (certifikát ~1 min).
   Admin účet vytvoří seed automaticky — heslo:
   `docker compose logs app | grep "admin účet"` nebo
   `docker compose exec app cat /data/admin_password.txt`.
   Přihlas se jako DM a vytvoř účty hráčům v admin sekci.

### Zálohy (důležité — SQLite + md soubory = všechna data)
```bash
# cron 1× denně:
tar czf ~/montelien-$(date +%F).tgz /data ../../*.md --exclude node_modules
```

## Varianta B — Cloudflare Tunnel (okamžitě, bez VPS)

Když chceš online přístup **dnes** a stačí, že běží tvůj počítač:

1. `winget install cloudflare.cloudflared` (nebo stáhni z webu)
2. `cloudflared tunnel login` → otevře prohlížeč, vyber doménu ve CF účtu
   (free doména od Freenum/Namecheap ~1$/rok, nebo zkus `cloudflared tunnel --url http://localhost:8001`
   pro dočasnou `*.trycloudflare.com` adresu — ta je free a funguje hned)
3. Dočasná adresa: `cloudflared tunnel --url http://localhost:8001`
4. Trvalá: `cloudflared tunnel create montelien` + DNS route na tvou doménu
   + config `~/.cloudflared/config.yml` → `cloudflared service install`

## Čemu se vyhnout
- **Render/Railway/Fly free tier** — kontejnery usínají a mají ephemeral disk;
  SQLite (`data.db`) a Markdown soubory by se po restartu ztratily.
- Bez persistentního disku nenasaď — všechna data jsou v `/data` a `/repo`.

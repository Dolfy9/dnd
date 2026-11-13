"""Seed: schéma + plný import + první admin uživatel.

Spuštění: python -m app.seed  (z app/backend)
"""
import secrets
import sys

from . import config, db, security
from .ingest import importer, rules


def ensure_admin() -> str | None:
    con = db.connect()
    if con.execute("SELECT count(*) c FROM users WHERE role='admin'").fetchone()["c"]:
        return None
    password = config.ADMIN_PASSWORD or secrets.token_urlsafe(9)
    con.execute("INSERT INTO users(login,name,pass_hash,role,created_at) VALUES(?,?,?,?,?)",
                (config.ADMIN_LOGIN, "DM", security.hash_password(password), "admin", db.now()))
    con.commit()
    return password


def run() -> None:
    db.init_schema()
    con = db.connect()
    have = con.execute("SELECT count(*) c FROM pages").fetchone()["c"]
    if not have:
        print("Prázdná databáze – importuji repozitář…", flush=True)
        stats = importer.import_all()
        print("  stránky:", stats["pages"], "entity:", stats["entities"],
              "linky:", stats["links"], "zmínky:", stats["mentions"],
              f"({stats.get('seconds')}s)", flush=True)
        if stats["errors"]:
            print("  chyby:", stats["errors"][:10], flush=True)
        print("Knihovna pravidel:", rules.load(), flush=True)
    pw = ensure_admin()
    if pw:
        print(f"\n>>> Vytvořen admin účet: {config.ADMIN_LOGIN} / {pw}\n"
              f">>> Heslo si zapiš – po prvním přihlášení ho změň.\n", flush=True)
        (config.DATA_DIR / "admin_password.txt").write_text(
            f"{config.ADMIN_LOGIN} / {pw}\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(run())

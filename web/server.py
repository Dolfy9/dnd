#!/usr/bin/env python3
"""Lokální server wiki Montelienu s editací.

Servíruje web postavený MkDocs (web/site) a API pro úpravy souborů v repu.
Po každé změně se web přestaví (~2 s). Spuštění: web/serve.sh
"""
import json, os, subprocess, sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import yaml

WEB = Path(__file__).resolve().parent
ROOT = WEB.parent
SITE = WEB / "site"
BLOCKED = {"web", "tools", ".git", "_import", ".obsidian"}
LOCK = threading.Lock()


def safe_path(rel, allow_json=False):
    p = (ROOT / rel).resolve()
    if ROOT not in p.parents:
        raise ValueError("cesta mimo repozitář")
    parts = p.relative_to(ROOT).parts
    if parts[0] in BLOCKED:
        raise ValueError("do této složky nelze zapisovat")
    if p.suffix != ".md" and not (allow_json and p.suffix == ".json" and parts[0] == "11_Mapy"):
        raise ValueError("povolené jsou jen .md soubory (a .json v 11_Mapy)")
    return p


def rebuild(index=False, mapa=False):
    with LOCK:
        if mapa:
            subprocess.run([sys.executable, str(ROOT / "tools" / "mapa.py")], cwd=ROOT)
        if index:
            subprocess.run([sys.executable, str(ROOT / "tools" / "kontrola.py"), "--index"], cwd=ROOT)
        subprocess.run([sys.executable, str(WEB / "build.py")], cwd=WEB, check=True)
        r = subprocess.run([sys.executable, "-m", "mkdocs", "build", "-q", "-f", "mkdocs.yml"], cwd=WEB,
                           capture_output=True, text=True)
        if r.returncode:
            raise RuntimeError(r.stderr[-2000:])


def split_front(text):
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end > 0:
            return yaml.safe_load(text[4:end]) or {}, text[end + 5:]
    return {}, text


def join_front(meta, body):
    if not meta:
        return body
    return "---\n" + yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=120) + "---\n" + body


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(SITE), **kw)

    def log_message(self, fmt, *args):
        if args and "/api/" in str(args[0]):
            super().log_message(fmt, *args)

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")

    def api(self, method):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/api/soubor" and method == "GET":
                p = safe_path(q["cesta"], allow_json=True)
                return self.send_json({"cesta": q["cesta"], "obsah": p.read_text(encoding="utf-8")})
            if u.path == "/api/soubor" and method in ("PUT", "POST"):
                d = self.body()
                p = safe_path(d["cesta"], allow_json=True)
                if method == "POST" and p.exists():
                    return self.send_json({"chyba": "soubor už existuje"}, 409)
                if p.suffix == ".json":
                    json.loads(d["obsah"])
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(d["obsah"], encoding="utf-8")
                rebuild(index=method == "POST", mapa=d.get("prekreslit_mapu", False))
                return self.send_json({"ok": True, "cesta": d["cesta"]})
            if u.path == "/api/soubor" and method == "DELETE":
                p = safe_path(q["cesta"])
                p.unlink()
                rebuild(index=True)
                return self.send_json({"ok": True})
            if u.path == "/api/postava" and method == "POST":
                d = self.body()
                p = safe_path(d["cesta"])
                if p.exists():
                    return self.send_json({"error": "Soubor už existuje"}, 409)
                p.parent.mkdir(parents=True, exist_ok=True)
                body = d.get("telo") or ("\n# " + d["postava"].get("jmeno", "Postava") + "\n\n> **Stav:** návrh\n\n## Příběh\n\n## Pro DM (tajné)\n")
                p.write_text(join_front({"postava": d["postava"]}, body), encoding="utf-8")
                rebuild(index=True)
                return self.send_json({"ok": True})
            if u.path == "/api/postava" and method == "PUT":
                d = self.body()
                p = safe_path(d["cesta"])
                meta, body = split_front(p.read_text(encoding="utf-8"))
                meta["postava"] = d["postava"]
                p.write_text(join_front(meta, body), encoding="utf-8")
                rebuild()
                return self.send_json({"ok": True})
            if u.path == "/api/strom" and method == "GET":
                files = sorted(str(f.relative_to(ROOT)) for f in ROOT.rglob("*.md")
                               if f.relative_to(ROOT).parts[0] not in BLOCKED)
                dirs = sorted({str(Path(f).parent) for f in files if "/" in f})
                return self.send_json({"soubory": files, "slozky": dirs})
            return self.send_json({"chyba": "neznámý požadavek"}, 404)
        except (KeyError, ValueError, json.JSONDecodeError, FileNotFoundError) as e:
            return self.send_json({"chyba": str(e)}, 400)
        except RuntimeError as e:
            return self.send_json({"chyba": "Uloženo, ale web se nepodařilo přestavět: " + str(e)}, 500)

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.api("GET")
        return super().do_GET()

    def do_PUT(self):
        return self.api("PUT")

    def do_POST(self):
        return self.api("POST")

    def do_DELETE(self):
        return self.api("DELETE")


def main():
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    print("Stavím web…")
    rebuild(index=True)
    print(f"Wiki Montelienu: http://{host}:{port}/  (úpravy se ukládají do repozitáře)")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()

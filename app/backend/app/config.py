"""Konfigurace aplikace Montelien.

Všechna nastavení lze přepsat proměnnými prostředí (prefix MONT_).
ROOT = kořen repozitáře s Markdown obsahem (v kontejneru /repo, lokálně ../.. vůči app/backend).
"""
import os
import secrets
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def _root() -> Path:
    env = os.environ.get("MONT_ROOT")
    if env:
        return Path(env).resolve()
    return (BACKEND.parent.parent).resolve()  # repo root (app/backend -> app -> root)


ROOT = _root()
DATA_DIR = Path(os.environ.get("MONT_DATA", BACKEND.parent / "data")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(os.environ.get("MONT_DB", DATA_DIR / "montelien.db")).resolve()

# Tajný klíč pro podepisování cookie/csrf. V produkci nastav MONT_SECRET.
_secret_file = DATA_DIR / ".secret"
if os.environ.get("MONT_SECRET"):
    SECRET = os.environ["MONT_SECRET"]
else:
    if not _secret_file.exists():
        _secret_file.write_text(secrets.token_hex(32), encoding="ascii")
    SECRET = _secret_file.read_text(encoding="ascii").strip()

ADMIN_LOGIN = os.environ.get("MONT_ADMIN_LOGIN", "admin")
ADMIN_PASSWORD = os.environ.get("MONT_ADMIN_PASSWORD", "")
SESSION_DAYS = int(os.environ.get("MONT_SESSION_DAYS", "30"))
COOKIE_NAME = "montelien_session"
COOKIE_SECURE = os.environ.get("MONT_COOKIE_SECURE", "0") == "1"  # https na produkci

# Složky s obsahem (vše ostatní se ignoruje při indexaci)
CONTENT_DIRS = [
    "01_Svet", "02_Zeme", "03_Mesta", "04_Postavy", "05_Frakce",
    "06_Knihy_a_Dokumenty", "07_Kampane", "08_Questy", "09_Hadanky",
    "10_Sezeni", "11_Mapy", "12_Obchody", "13_Druhy", "14_Povolani", "15_Podtridy",
    "_Sablony",
]
ROOT_FILES = ["README.md", "Otevrene_otazky.md", "AGENTS.md"]

# Mapování složka → typ entity (souhrnný typ pro navigaci a vazby)
FOLDER_TYPES = {
    "01_Svet": "svet", "01_Svet/Mista": "misto",
    "02_Zeme": "zeme", "03_Mesta": "mesto",
    "04_Postavy": "postava", "05_Frakce": "frakce",
    "06_Knihy_a_Dokumenty": "kniha", "07_Kampane": "kampan",
    "08_Questy": "quest", "09_Hadanky": "hadanka", "10_Sezeni": "sezeni",
    "11_Mapy": "stranka", "12_Obchody": "obchod", "13_Druhy": "druh",
    "14_Povolani": "povolani", "15_Podtridy": "podtrida", "_Sablony": "sablona",
}
# Klíč YAML hlavičky pro typy se strukturovanými daty (typ → klíč frontmatteru)
ENTITY_KEY = {t: t for t in (
    "postava", "obchod", "druh", "mesto", "zeme", "frakce", "misto", "kniha",
    "kampan", "quest", "hadanka", "sezeni", "povolani", "podtrida", "svet",
)}

TYPE_LABELS = {
    "svet": "Svět", "misto": "Místo", "zeme": "Země", "mesto": "Město",
    "postava": "Postava", "frakce": "Frakce", "kniha": "Kniha / dokument",
    "kampan": "Kampaň", "quest": "Quest", "hadanka": "Hádanka", "sezeni": "Sezení",
    "stranka": "Stránka", "obchod": "Obchod", "druh": "Druh", "povolani": "Povolání",
    "podtrida": "Podtřída", "sablona": "Šablona",
}

ASSETS = Path(__file__).resolve().parent / "static"

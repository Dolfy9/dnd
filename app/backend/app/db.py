"""SQLite vrstva: připojení, schéma, jednoduché migrace.

Databáze je index + kanonický zdroj strukturovaných entit.
Prozaické texty (těla stránek) zůstávají v .md souborech — viz ingest/.
"""
import json
import sqlite3
import threading
import time
from pathlib import Path

from .config import DB_PATH

SCHEMA_VERSION = 1
_local = threading.local()

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS pages (
  path TEXT PRIMARY KEY,          -- relativní cesta v repu (02_Zeme/X.md)
  type TEXT NOT NULL DEFAULT 'stranka',
  folder TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  secret INTEGER NOT NULL DEFAULT 0,   -- tajne: true → jen admin/editor
  has_dm INTEGER NOT NULL DEFAULT 0,   -- obsahuje ## Pro DM
  plaintext TEXT NOT NULL DEFAULT '',
  toc TEXT NOT NULL DEFAULT '[]',      -- JSON [{level,title,slug}]
  meta TEXT NOT NULL DEFAULT '{}',     -- JSON frontmatter (mimo entitní klíč)
  mtime REAL NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pages_type ON pages(type);
CREATE INDEX IF NOT EXISTS idx_pages_folder ON pages(folder);

-- Fulltext nad hráčsky bezpečným textem (Pro DM sekce vynechané)
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(path UNINDEXED, title, text);
-- Fulltext jen nad Pro DM sekcemi (dotazuje se pouze admin/editor)
CREATE VIRTUAL TABLE IF NOT EXISTS dm_fts USING fts5(path UNINDEXED, title, text);

CREATE TABLE IF NOT EXISTS links (
  src TEXT NOT NULL,              -- path zdrojové stránky
  dst TEXT NOT NULL,              -- path cílové stránky
  kind TEXT NOT NULL DEFAULT 'link', -- link | fm | mention
  PRIMARY KEY (src, dst, kind)
);
CREATE INDEX IF NOT EXISTS idx_links_dst ON links(dst);
CREATE INDEX IF NOT EXISTS idx_links_src ON links(src);

CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,      -- zrcadlený .md soubor
  slug TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}',-- JSON (bývalá YAML hlavička)
  status TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(id UNINDEXED, type UNINDEXED, name, data_text);

CREATE TABLE IF NOT EXISTS relations (
  subj INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  pred TEXT NOT NULL,             -- vladce|majitel|sidlo|clen|clenka|…
  obj INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (subj, pred, obj)
);
CREATE INDEX IF NOT EXISTS idx_rel_obj ON relations(obj);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'priprava',
  kampan TEXT NOT NULL DEFAULT '',
  quest TEXT NOT NULL DEFAULT '',
  sezeni TEXT NOT NULL DEFAULT '',
  map_ref TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '{}',   -- kompletní JSON stavu boje
  version INTEGER NOT NULL DEFAULT 0,
  shared INTEGER NOT NULL DEFAULT 0,  -- živé sdílení hráčům
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS battle_maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  misto TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS map_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nazev TEXT NOT NULL,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  typ TEXT NOT NULL DEFAULT 'misto',
  jistota TEXT NOT NULL DEFAULT 'odhad',
  odkaz TEXT NOT NULL DEFAULT '',     -- path stránky
  pozn TEXT NOT NULL DEFAULT '',
  popisek TEXT NOT NULL DEFAULT '{}'  -- JSON {rot,box,styl}
);

CREATE TABLE IF NOT EXISTS map_geo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset TEXT NOT NULL,              -- svet | vodstvo | bojove_mapy
  key TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_map_geo_ds ON map_geo(dataset);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player', -- admin|editor|player
  created_at TEXT NOT NULL DEFAULT '',
  disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL DEFAULT '',
  expires REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  user TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts);

CREATE TABLE IF NOT EXISTS heraldry (
  entity TEXT PRIMARY KEY,       -- path stránky
  data TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS music_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  video_id TEXT NOT NULL DEFAULT '',
  list_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

-- Knihovna pravidel (SRD + pravidla2024 + kouzla): čtení pro katalogy a odkazy
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,            -- spell|monster|item|glossary|species|class|subclass|background|feat
  key TEXT NOT NULL,             -- unikátní klíč v rámci kind
  name TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  UNIQUE (kind, key)
);
CREATE INDEX IF NOT EXISTS idx_rules_kind ON rules(kind, name);

CREATE VIRTUAL TABLE IF NOT EXISTS rules_fts USING fts5(kind UNINDEXED, key UNINDEXED, name, text);

CREATE TABLE IF NOT EXISTS nav_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}'
);
"""


def connect() -> sqlite3.Connection:
    con = getattr(_local, "con", None)
    if con is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA foreign_keys=ON")
        con.execute("PRAGMA busy_timeout=5000")
        _local.con = con
    return con


def init_schema() -> None:
    con = connect()
    con.executescript(SCHEMA)
    row = con.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
    if not row:
        con.execute("INSERT INTO meta(key,value) VALUES('schema_version',?)", (str(SCHEMA_VERSION),))
    con.commit()


def tx():
    """Kontextový manager pro transakce."""
    con = connect()
    return con  # sqlite3.Connection už je context manager (commit/rollback)


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def jdump(v) -> str:
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


def jload(s, default=None):
    try:
        return json.loads(s) if s else (default if default is not None else {})
    except (ValueError, TypeError):
        return default if default is not None else {}


def audit(user: str, action: str, target: str = "", detail: str = "") -> None:
    con = connect()
    con.execute("INSERT INTO audit(ts,user,action,target,detail) VALUES(?,?,?,?,?)",
                (now(), user, action, target, detail))
    con.commit()

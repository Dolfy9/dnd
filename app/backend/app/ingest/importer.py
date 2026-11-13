"""Import repozitáře → SQLite index + kanonické entity.

Režimy:
  import_all()            – plný reimport (seed, reindexace)
  reingest(paths)         – přírůstkově po změně souborů (watcher)
Smazání souboru → delete_page(path).
Entity: stránky ve složkách s FOLDER_TYPES; typy s YAML klíčem (postava/obchod/druh)
mají data z frontmatteru a jsou v DB kanonické (zapisuje se přes mirror.py).
"""
import json
import re
import time
from pathlib import Path

from .. import db
from ..config import CONTENT_DIRS, ENTITY_KEY, FOLDER_TYPES, ROOT, ROOT_FILES
from . import links as L
from . import markdown as M

# složka → typ (nejspecifičtější prefix vyhrává)
SORTED_FOLDERS = sorted(FOLDER_TYPES.keys(), key=len, reverse=True)


def type_of(path: str) -> str:
    for folder in SORTED_FOLDERS:
        if path == folder or path.startswith(folder + "/"):
            return FOLDER_TYPES[folder]
    return "stranka"


def folder_of(path: str) -> str:
    return path.split("/", 1)[0] if "/" in path else ""


def iter_content() -> list[Path]:
    files = []
    for d in CONTENT_DIRS:
        base = ROOT / d
        if base.is_dir():
            files.extend(base.rglob("*.md"))
    for f in ROOT_FILES:
        p = ROOT / f
        if p.is_file():
            files.append(p)
    return files


def slug_of(path: str) -> str:
    stem = Path(path).stem
    return re.sub(r"^(Postava|Mesto|Město|Zeme|Quest|Hadanka|Sezeni|Kampan|Kniha|Obchod|Druh|Povolani|Podtrida|Sablona)_", "", stem)


class Importer:
    def __init__(self):
        self.con = db.connect()
        self.stats = {"pages": 0, "entities": 0, "links": 0, "mentions": 0, "removed": 0, "errors": []}

    # ---------- jednotlivé soubory ----------
    def ingest_file(self, rel: str) -> None:
        p = ROOT / rel
        text = p.read_text(encoding="utf-8")
        meta, body, _ = M.split_front(text)
        player, dm = M.strip_dm(body)
        typ = type_of(rel)
        title = M.title_of(rel, body, meta)
        status = M.status_of(body)
        secret = bool(meta.get("tajne"))
        toc = M.toc_of(player)
        plain = M.plaintext(player)
        dm_plain = M.plaintext(dm) if dm else ""
        mtime = p.stat().st_mtime
        entity_meta = {k: v for k, v in meta.items() if k not in ENTITY_KEY.values() and k != "hide"}

        self.con.execute(
            "REPLACE INTO pages(path,type,folder,title,status,secret,has_dm,plaintext,toc,meta,mtime,imported_at)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (rel, typ, folder_of(rel), title, status, int(secret), int(bool(dm)),
             plain, db.jdump(toc), db.jdump(entity_meta), mtime, db.now()))
        self.con.execute("DELETE FROM pages_fts WHERE path=?", (rel,))
        self.con.execute("INSERT INTO pages_fts(path,title,text) VALUES(?,?,?)", (rel, title, plain))
        self.con.execute("DELETE FROM dm_fts WHERE path=?", (rel,))
        if dm_plain:
            self.con.execute("INSERT INTO dm_fts(path,title,text) VALUES(?,?,?)", (rel, title, dm_plain))
        self.stats["pages"] += 1
        return {"meta": meta, "body": body, "player": player, "title": title,
                "status": status, "type": typ, "plain": plain}

    def upsert_entity(self, rel: str, info: dict) -> int | None:
        typ = info["type"]
        if typ in ("stranka", "sablona"):
            return None
        if Path(rel).stem.upper() == "README":
            return None  # index složky není entita
        key = ENTITY_KEY.get(typ)
        data = info["meta"].get(key) if key else None
        data = data if isinstance(data, dict) else ({} if key else {})
        name = str((data or {}).get("jmeno") or (data or {}).get("nazev") or info["title"])
        tags = (data or {}).get("stitky") or []
        tags = [t for t in tags if isinstance(t, str)] if isinstance(tags, list) else []
        self.con.execute(
            "INSERT INTO entities(type,path,slug,name,data,status,tags,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET"
            " type=excluded.type, slug=excluded.slug, name=excluded.name, data=excluded.data,"
            " status=excluded.status, tags=excluded.tags, updated_at=excluded.updated_at",
            (typ, rel, slug_of(rel), name, db.jdump(data), info["status"], db.jdump(tags),
             db.now(), db.now()))
        row = self.con.execute("SELECT id FROM entities WHERE path=?", (rel,)).fetchone()
        eid = row["id"]
        self.con.execute("DELETE FROM entities_fts WHERE id=?", (eid,))
        self.con.execute("INSERT INTO entities_fts(id,type,name,data_text) VALUES(?,?,?,?)",
                         (eid, typ, name, M.plaintext(json.dumps(data, ensure_ascii=False))))
        self.stats["entities"] += 1
        return eid

    # ---------- vazby ----------
    def rebuild_links(self, bodies: dict[str, str], known: set[str]) -> None:
        """Přepočítá kompletní graf: odkazy, frontmatter vazby, neodkazované zmínky."""
        self.con.execute("DELETE FROM links WHERE kind IN ('link','fm','mention')")
        src_links: dict[str, set[str]] = {}
        for src, body in bodies.items():
            for dst in L.page_links(src, body, known):
                self.con.execute("INSERT OR IGNORE INTO links(src,dst,kind) VALUES(?,?,'link')", (src, dst))
                src_links.setdefault(src, set()).add(dst)
                self.stats["links"] += 1
        # frontmatter vazby entit → relations + fm hrany
        rows = self.con.execute("SELECT id,path,name,data FROM entities").fetchall()
        path_id = {r["path"]: r["id"] for r in rows}
        self.con.execute("DELETE FROM relations")
        for r in rows:
            data = db.jload(r["data"])
            for pred, dst in L.fm_relations(data):
                obj = path_id.get(dst)
                if obj:
                    self.con.execute("INSERT OR IGNORE INTO relations(subj,pred,obj) VALUES(?,?,?)",
                                     (r["id"], pred, obj))
                    self.con.execute("INSERT OR IGNORE INTO links(src,dst,kind) VALUES(?,?,'fm')", (r["path"], dst))
                    src_links.setdefault(r["path"], set()).add(dst)
        # mentions: stránky obsahující jméno entity, ale bez odkazu na ni
        plains = {p["path"]: p["plaintext"] for p in self.con.execute("SELECT path,plaintext FROM pages")}
        for r in rows:
            name = (r["name"] or "").strip()
            if len(name) < 4:
                continue
            for src in L.find_mentions(name, plains, src_links):
                if src != r["path"]:
                    self.con.execute("INSERT OR IGNORE INTO links(src,dst,kind) VALUES(?,?,'mention')",
                                     (src, r["path"]))
                    self.stats["mentions"] += 1

    # ---------- datasety ----------
    def ingest_json_datasets(self) -> None:
        self._mista()
        self._geo("svet", ROOT / "11_Mapy" / "svet.json")
        self._geo("vodstvo", ROOT / "11_Mapy" / "vodstvo.json")
        self._battle_maps()
        self._battles()
        self._heraldry()
        self._music()

    def _mista(self) -> None:
        f = ROOT / "11_Mapy" / "mista.json"
        self.con.execute("DELETE FROM map_places")
        if not f.is_file():
            return
        data = json.loads(f.read_text(encoding="utf-8"))
        for m in data.get("mista", []):
            self.con.execute(
                "INSERT INTO map_places(nazev,x,y,typ,jistota,odkaz,pozn,popisek) VALUES(?,?,?,?,?,?,?,?)",
                (m.get("nazev", ""), m.get("x", 0), m.get("y", 0), m.get("typ", "misto"),
                 m.get("jistota", "odhad"), m.get("odkaz", ""), m.get("pozn", ""),
                 db.jdump(m.get("popisek") or {})))

    def _geo(self, dataset: str, f: Path) -> None:
        self.con.execute("DELETE FROM map_geo WHERE dataset=?", (dataset,))
        if not f.is_file():
            return
        data = json.loads(f.read_text(encoding="utf-8"))
        for key, value in data.items():
            if key.startswith("_") or key in ("sirka", "vyska"):
                continue
            rows = value if isinstance(value, list) else [value]
            for item in rows:
                self.con.execute("INSERT INTO map_geo(dataset,key,data) VALUES(?,?,?)",
                                 (dataset, key, db.jdump(item)))

    def _battle_maps(self) -> None:
        self.con.execute("DELETE FROM battle_maps")
        f = ROOT / "11_Mapy" / "bojove_mapy.json"
        if not f.is_file():
            return
        for m in json.loads(f.read_text(encoding="utf-8")).get("mapy", []):
            self.con.execute("INSERT INTO battle_maps(id,name,misto,data) VALUES(?,?,?,?)",
                             (m.get("id", ""), m.get("nazev", ""), m.get("misto", ""), db.jdump(m)))

    def _battles(self) -> None:
        d = ROOT / "11_Mapy" / "boje"
        if not d.is_dir():
            return
        for f in sorted(d.glob("*.json")):
            try:
                b = json.loads(f.read_text(encoding="utf-8"))
            except ValueError:
                continue
            bid = b.get("id") or f.stem
            self.con.execute(
                "INSERT INTO battles(id,name,status,kampan,quest,sezeni,map_ref,state,version,shared,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?,0,0,?,?) ON CONFLICT(id) DO UPDATE SET"
                " name=excluded.name,status=excluded.status,kampan=excluded.kampan,quest=excluded.quest,"
                " sezeni=excluded.sezeni,map_ref=excluded.map_ref,state=excluded.state,updated_at=excluded.updated_at"
                " WHERE battles.updated_at <= excluded.updated_at",
                (bid, b.get("nazev", ""), b.get("stav", "priprava"), b.get("kampan", ""),
                 b.get("quest", ""), b.get("sezeni", ""), b.get("mapa", ""),
                 db.jdump(b), b.get("vytvoreno", ""), b.get("upraveno", db.now())))

    def _heraldry(self) -> None:
        f = ROOT / "tools" / "heraldika.json"
        if not f.is_file():
            return
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            return
        items = data.items() if isinstance(data, dict) else []
        for key, value in items:
            if str(key).startswith("_"):
                continue
            self.con.execute("INSERT INTO heraldry(entity,data) VALUES(?,?) ON CONFLICT(entity) DO UPDATE SET data=excluded.data",
                             (str(key), db.jdump(value)))

    def _music(self) -> None:
        f = ROOT / "web" / "assets" / "hudba_presety.json"
        self.con.execute("DELETE FROM music_presets")
        if not f.is_file():
            return
        try:
            for p in json.loads(f.read_text(encoding="utf-8")):
                self.con.execute("INSERT OR REPLACE INTO music_presets(id,name,video_id,list_id,note) VALUES(?,?,?,?,?)",
                                 (p.get("id", ""), p.get("nazev", ""), p.get("videoId", ""),
                                  p.get("list", ""), p.get("popis", "")))
        except ValueError:
            pass

    def rebuild_links_incr(self, changed: set[str], bodies: dict[str, str]) -> None:
        """Přírůstkový přepočet hran grafu – jen změněné stránky/entity.

        Odchozí hrany (link/fm/mention) se přepočítají jen pro změněné stránky;
        příchozí mentions na změněné entity se přepočítají přes všechny stránky
        (jméno entity se mohlo změnit). Databázi drží konzistentní i při přejmenování.
        """
        ch = sorted(changed)
        ph = ",".join("?" * len(ch))
        self.con.execute(f"DELETE FROM links WHERE src IN ({ph})", ch)
        self.con.execute(f"DELETE FROM links WHERE dst IN ({ph}) AND kind='mention'", ch)
        eids = [r["id"] for r in self.con.execute(
            f"SELECT id FROM entities WHERE path IN ({ph})", ch)]
        if eids:
            eph = ",".join("?" * len(eids))
            self.con.execute(f"DELETE FROM relations WHERE subj IN ({eph})", eids)
        self.con.execute("DELETE FROM relations WHERE obj NOT IN (SELECT id FROM entities)")
        self.con.execute("DELETE FROM links WHERE dst NOT IN (SELECT path FROM pages)")
        # odkazy z těla změněných stránek
        known = {r["path"] for r in self.con.execute("SELECT path FROM pages")}
        for src in ch:
            body = bodies.get(src)
            if body is None:
                p = ROOT / src
                if not p.is_file():
                    continue
                body = M.split_front(p.read_text(encoding="utf-8"))[1]
            for dst in L.page_links(src, body, known):
                self.con.execute("INSERT OR IGNORE INTO links(src,dst,kind) VALUES(?,?,'link')", (src, dst))
                self.stats["links"] += 1
        # fm vazby změněných entit → relations + fm hrany
        path_id = {r["path"]: r["id"] for r in self.con.execute("SELECT id,path FROM entities")}
        for r in self.con.execute(f"SELECT id,path,data FROM entities WHERE path IN ({ph})", ch):
            for pred, dst in L.fm_relations(db.jload(r["data"])):
                obj = path_id.get(dst)
                if obj:
                    self.con.execute(
                        "INSERT OR IGNORE INTO relations(subj,pred,obj) VALUES(?,?,?)",
                        (r["id"], pred, obj))
                    self.con.execute(
                        "INSERT OR IGNORE INTO links(src,dst,kind) VALUES(?,?,'fm')",
                        (r["path"], dst))
        # mentions: regex pro každé entitní jméno (≥4 znaky), zkompilovaný jednou
        pats = {}
        for r in self.con.execute("SELECT path,name FROM entities"):
            name = (r["name"] or "").strip()
            if len(name) >= 4:
                pats[r["path"]] = re.compile(
                    r"(?<![\wěščřžýáíéúůóďťňĚŠČŘŽÝÁÍÉÚŮÓĎŤŇ])" + re.escape(name)
                    + r"(?![\wěščřžýáíéúůóďťňĚŠČŘŽÝÁÍÉÚŮÓĎŤŇ])", re.I)
        plains = {p["path"]: p["plaintext"]
                  for p in self.con.execute("SELECT path,plaintext FROM pages")}
        linked = {}
        for r in self.con.execute("SELECT src,dst FROM links"):
            linked.setdefault(r["src"], set()).add(r["dst"])

        def add_mention(src: str, dst: str) -> None:
            if src != dst and dst not in linked.get(src, ()):
                self.con.execute(
                    "INSERT OR IGNORE INTO links(src,dst,kind) VALUES(?,?,'mention')",
                    (src, dst))
                linked.setdefault(src, set()).add(dst)
                self.stats["mentions"] += 1

        for src in ch:
            text = plains.get(src) or ""
            for dst, pat in pats.items():
                if pat.search(text):
                    add_mention(src, dst)
        for dst in ch:
            pat = pats.get(dst)
            if pat:
                for src, text in plains.items():
                    if pat.search(text or ""):
                        add_mention(src, dst)

    def run(self, files: list[Path] | None = None) -> dict:
        started = time.time()
        files = iter_content() if files is None else files
        changed_bodies: dict[str, str] = {}
        for f in files:
            try:
                rel = f.relative_to(ROOT).as_posix()
            except ValueError:
                continue
            try:
                info = self.ingest_file(rel)
                if info:
                    changed_bodies[rel] = info["body"]
                    self.upsert_entity(rel, info)
            except Exception as e:  # noqa: BLE001 – indexace nesmí umřít kvůli jednomu souboru
                self.stats["errors"].append(f"{rel}: {e}")
        if changed_bodies:
            self.rebuild_links_incr(set(changed_bodies), changed_bodies)
        else:
            # Plný reimport – graf se přepočítá nad všemi stránkami
            all_bodies = {}
            for row in self.con.execute("SELECT path FROM pages"):
                try:
                    all_bodies[row["path"]] = M.split_front(
                        (ROOT / row["path"]).read_text(encoding="utf-8"))[1]
                except OSError:
                    pass
            self.rebuild_links(all_bodies, set(all_bodies.keys()))
        self.ingest_json_datasets()
        self.con.commit()
        self.stats["seconds"] = round(time.time() - started, 2)
        return self.stats


def import_all() -> dict:
    """Plný reimport – smaže a znovu naplní index."""
    imp = Importer()
    stats = imp.run(None)
    db.audit("system", "reindex", "", json.dumps(stats, ensure_ascii=False))
    return stats


def reingest(paths: list[str]) -> dict:
    """Přírůstkový reimport změněných souborů (watcher). Vazby přepočítá celé."""
    imp = Importer()
    files = [ROOT / p for p in paths if (ROOT / p).suffix == ".md" and (ROOT / p).is_file()]
    stats = imp.run(files)
    return stats


def delete_page(path: str) -> None:
    con = db.connect()
    con.execute("DELETE FROM pages WHERE path=?", (path,))
    con.execute("DELETE FROM pages_fts WHERE path=?", (path,))
    con.execute("DELETE FROM dm_fts WHERE path=?", (path,))
    con.execute("DELETE FROM links WHERE src=?", (path,))
    row = con.execute("SELECT id FROM entities WHERE path=?", (path,)).fetchone()
    if row:
        con.execute("DELETE FROM entities_fts WHERE id=?", (row["id"],))
        con.execute("DELETE FROM entities WHERE id=?", (row["id"],))
    con.commit()

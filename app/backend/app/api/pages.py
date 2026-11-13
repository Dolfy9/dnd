"""Stránky: navigace, detail (role-aware HTML), CRUD, linkify zmínek."""
import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import charsheet, db, render, security
from ..config import CONTENT_DIRS, ENTITY_KEY, ROOT, TYPE_LABELS
from ..ingest import importer, markdown as M
from ..ingest.links import FM_RELS

router = APIRouter(prefix="/api", tags=["pages"])

BLOCKED = {"web", "tools", "app", ".git", ".obsidian", "_import", "node_modules"}


def safe_path(rel: str, allow_json: bool = False) -> Path:
    rel = rel.replace("\\", "/").lstrip("/")
    p = (ROOT / rel).resolve()
    if p != ROOT and ROOT not in p.parents:
        raise HTTPException(400, "cesta mimo repozitář")
    parts = p.relative_to(ROOT).parts
    if parts[0] in BLOCKED:
        raise HTTPException(400, "do této složky nelze zapisovat")
    json_ok = allow_json and p.suffix == ".json"
    if p.suffix != ".md" and not json_ok:
        raise HTTPException(400, "povolené jsou jen .md soubory" + (" a .json" if allow_json else ""))
    return p


def _page_row(path: str):
    return db.connect().execute("SELECT * FROM pages WHERE path=?", (path,)).fetchone()


def _visible(u: dict | None, row) -> bool:
    return security.can_see(u, bool(row["secret"]))


def _backlinks(path: str, u: dict | None):
    con = db.connect()
    rows = con.execute(
        "SELECT l.src,l.kind,p.title,p.secret FROM links l JOIN pages p ON p.path=l.src"
        " WHERE l.dst=? ORDER BY l.kind,p.title", (path,)).fetchall()
    out = {"odkazy": [], "vazby": [], "zminky": []}
    for r in rows:
        if not _visible(u, r):
            continue
        item = {"path": r["src"], "title": r["title"], "url": render.page_url(r["src"])}
        out[{"link": "odkazy", "fm": "vazby", "mention": "zminky"}.get(r["kind"], "odkazy")].append(item)
    return out


def _entity_card(path: str, u: dict | None):
    con = db.connect()
    e = con.execute("SELECT * FROM entities WHERE path=?", (path,)).fetchone()
    if not e:
        return None
    data = db.jload(e["data"])
    rels = con.execute(
        "SELECT r.pred,r.note,e.id,e.name,e.path,e.type FROM relations r"
        " JOIN entities e ON e.id=r.obj WHERE r.subj=?", (e["id"],)).fetchall()
    rels2 = con.execute(
        "SELECT r.pred,r.note,e.id,e.name,e.path,e.type FROM relations r"
        " JOIN entities e ON e.id=r.subj WHERE r.obj=?", (e["id"],)).fetchall()
    portret = ""
    cand = ROOT / "04_Postavy" / "obrazky" / (Path(path).stem + ".webp")
    if e["type"] == "postava":
        override = data.get("portret")
        if override and (ROOT / str(override)).is_file():
            portret = str(override)
        elif cand.is_file():
            portret = f"04_Postavy/obrazky/{cand.name}"
    out = {
        "id": e["id"], "type": e["type"], "type_label": TYPE_LABELS.get(e["type"], e["type"]),
        "slug": e["slug"], "name": e["name"], "data": data,
        "tags": db.jload(e["tags"], []), "portret": portret,
        "vazby_out": [{"pred": r["pred"], "note": r["note"], "name": r["name"],
                       "path": r["path"], "type": r["type"], "url": render.page_url(r["path"])}
                      for r in rels],
        "vazby_in": [{"pred": r["pred"], "note": r["note"], "name": r["name"],
                      "path": r["path"], "type": r["type"], "url": render.page_url(r["path"])}
                     for r in rels2],
    }
    if e["type"] == "postava":
        try:
            out["sheet"] = charsheet.compute(data)
        except Exception as ex:
            out["sheet_error"] = str(ex)
    return out


def _battles_for(path: str):
    rows = db.connect().execute(
        "SELECT id,name,status,version FROM battles WHERE kampan=? OR quest=? OR sezeni=?",
        (path, path, path)).fetchall()
    return [dict(r) for r in rows]


def _map_place_for(path: str):
    r = db.connect().execute("SELECT nazev,x,y,typ,jistota FROM map_places WHERE odkaz=?", (path,)).fetchone()
    return dict(r) if r else None


def _mention_pairs(path: str, u: dict | None) -> list[tuple[str, str]]:
    """Jména entit zmíněných na stránce bez odkazu → ghost-link dvojice (name, url)."""
    rows = db.connect().execute(
        "SELECT e.name, e.path, p.secret FROM links l"
        " JOIN entities e ON e.path=l.dst LEFT JOIN pages p ON p.path=e.path"
        " WHERE l.src=? AND l.kind='mention'", (path,)).fetchall()
    editor = security.can_edit(u)
    pairs = {}
    for r in rows:
        if r["secret"] and not editor:
            continue
        name = (r["name"] or "").strip()
        if len(name) >= 4 and r["path"] != path:
            pairs[name] = render.page_url(r["path"])
    return sorted(pairs.items(), key=lambda kv: -len(kv[0]))


def _dir_listing(path: str, u: dict | None):
    """Syntetická rozcestníková stránka pro složku bez indexu."""
    con = db.connect()
    rows = con.execute(
        "SELECT path,title,status,secret FROM pages WHERE path LIKE ? ORDER BY title",
        (path.rstrip("/") + "/%",)).fetchall()
    editor = security.can_edit(u)
    items = []
    for r in rows:
        if r["secret"] and not editor:
            continue
        items.append({"path": r["path"], "title": r["title"],
                      "status": r["status"], "url": render.page_url(r["path"]),
                      "secret": bool(r["secret"])})
    nazev = path.rstrip("/").rsplit("/", 1)[-1].replace("_", " ")
    return {
        "path": path, "title": nazev, "type": "adresar", "type_label": "Složka",
        "status": "", "secret": False, "has_dm": False,
        "html": "", "dm_html": "", "toc": [], "meta": {},
        "backlinks": {"odkazy": [], "vazby": [], "zminky": []},
        "entity": None, "battles": [], "map_place": None,
        "children": items,
        "editable": editor, "can_view_dm": editor,
    }


@router.get("/page")
def get_page(path: str, raw: str = "", u: dict | None = Depends(security.optional)):
    path = path.replace("\\", "/").lstrip("/").rstrip("/")
    cands = [path]
    if not path.lower().endswith(".md"):
        cands.append(path + ".md")
    else:
        cands.append(path[:-3])
    dirp = next((c for c in cands if (ROOT / c).is_dir()), None)
    if dirp:
        return _dir_listing(dirp, u)
    file = next(((ROOT / c) for c in cands if (ROOT / c).is_file()), ROOT / cands[-1])
    path = file.relative_to(ROOT).as_posix() if file.is_file() else path
    row = _page_row(path)
    if not row and not file.is_file():
        raise HTTPException(404, "Stránka nenalezena")
    if row and not _visible(u, row):
        raise HTTPException(404, "Stránka nenalezena")
    meta, body, _ = M.split_front(file.read_text(encoding="utf-8"))
    player_body, dm_body = M.strip_dm(body)
    is_editor = security.can_edit(u)
    # html = vždy hráčsky bezpečný výstup; DM sekci editoři vidí v dm_html boxu
    show_body = player_body
    entity = _entity_card(path, u)
    if entity and not _visible(u, row):
        raise HTTPException(404, "Stránka nenalezena")
    return {
        "path": path,
        "title": row["title"] if row else M.title_of(path, body, meta),
        "type": row["type"] if row else "stranka",
        "type_label": TYPE_LABELS.get(row["type"] if row else "stranka", "Stránka"),
        "status": row["status"] if row else "",
        "secret": bool(row["secret"]) if row else False,
        "has_dm": bool(row["has_dm"]) if row else bool(dm_body),
        "html": render.autolink(render.render_markdown(path, show_body), _mention_pairs(path, u)),
        "dm_html": render.render_markdown(path, dm_body) if is_editor and dm_body else "",
        "toc": db.jload(row["toc"], []) if row else M.toc_of(player_body),
        "meta": meta,
        "backlinks": _backlinks(path, u),
        "entity": entity,
        "battles": _battles_for(path),
        "map_place": _map_place_for(path),
        "raw": file.read_text(encoding="utf-8") if (is_editor and raw) else "",
        "editable": is_editor,
        "can_view_dm": is_editor,
    }


class PageBody(BaseModel):
    body: str = ""
    full: str = ""  # celý soubor včetně frontmatter (pro editor)


@router.put("/page")
def put_page(path: str, body: PageBody, u: dict = Depends(security.require("editor"))):
    """Uloží stránku. `body` = jen tělo (frontmatter zůstane), `full` = celý soubor."""
    p = safe_path(path)
    rel = p.relative_to(ROOT).as_posix()
    if not p.is_file():
        raise HTTPException(404, "soubor neexistuje")
    if body.full:
        text = body.full if body.full.endswith("\n") else body.full + "\n"
    else:
        meta, _old_body, _ = M.split_front(p.read_text(encoding="utf-8"))
        text = M.join_front(meta, body.body)
    p.write_text(text, encoding="utf-8")
    stats = importer.reingest([rel])
    db.audit(u["login"], "page.save", rel)
    return {"ok": True, "stats": stats}


class NewPage(BaseModel):
    dir: str
    name: str
    template: str = ""
    type: str = ""


@router.post("/page")
def new_page(b: NewPage, u: dict = Depends(security.require("editor"))):
    name = b.name.strip()
    if not name:
        raise HTTPException(400, "chybí název")
    import unicodedata
    ascii_name = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^A-Za-z0-9]+", "_", ascii_name).strip("_") or "Nova_stranka"
    p = safe_path(f"{b.dir.strip('/')}/{stem}.md")
    if p.exists():
        raise HTTPException(409, "soubor už existuje")
    if b.template:
        tpl = safe_path(b.template)
        text = tpl.read_text(encoding="utf-8") if tpl.is_file() else "# " + name + "\n"
        text = re.sub(r"^# .*$", "# " + name, text, count=1, flags=re.M)
    else:
        text = f"# {name}\n\n> **Stav:** návrh\n\n"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    rel = p.relative_to(ROOT).as_posix()
    importer.reingest([rel])
    db.audit(u["login"], "page.create", rel)
    return {"ok": True, "path": rel, "url": render.page_url(rel)}


@router.delete("/page")
def del_page(path: str, u: dict = Depends(security.require("editor"))):
    p = safe_path(path)
    if not p.is_file():
        raise HTTPException(404, "soubor neexistuje")
    rel = p.relative_to(ROOT).as_posix()
    p.unlink()
    importer.delete_page(rel)
    db.audit(u["login"], "page.delete", rel)
    return {"ok": True}


class LinkifyBody(BaseModel):
    target: str
    occurrences: int = 1


@router.post("/page/linkify")
def linkify(path: str, b: LinkifyBody, u: dict = Depends(security.require("editor"))):
    """Prvních N prostých výskytů názvu cílové entity přemění na Markdown odkaz."""
    p = safe_path(path)
    tp = safe_path(b.target)
    if not p.is_file() or not tp.is_file():
        raise HTTPException(404, "soubor neexistuje")
    row = db.connect().execute("SELECT name FROM entities WHERE path=?", (b.target,)).fetchone()
    name = row["name"] if row else M.title_of(b.target, M.split_front(tp.read_text(encoding="utf-8"))[1], {})
    import os
    text = p.read_text(encoding="utf-8")
    meta, body, _ = M.split_front(text)
    rel_link = os.path.relpath(ROOT / b.target, p.parent).replace("\\", "/")
    pat = re.compile(r"(?<![\wěščřžýáíéúůóďťňĚŠČŘŽÝÁÍÉÚŮÓĎŤŇ(/])" + re.escape(name)
                     + r"(?![\wěščřžýáíéúůóďťňĚŠČŘŽÝÁÍÉÚŮÓĎŤŇ)\]])", re.I)
    body2, n = pat.subn(lambda m: f"[{m.group(0)}]({rel_link})", body, count=max(1, b.occurrences))
    if not n:
        raise HTTPException(400, "výskyt nenalezen")
    p.write_text(M.join_front(meta, body2), encoding="utf-8")
    rel = p.relative_to(ROOT).as_posix()
    importer.reingest([rel])
    db.audit(u["login"], "page.linkify", rel, f"{name} → {b.target} ×{n}")
    return {"ok": True, "replaced": n}


@router.get("/tree")
def tree(u: dict = Depends(security.require("editor"))):
    files = sorted(f.relative_to(ROOT).as_posix()
                   for d in CONTENT_DIRS if (ROOT / d).is_dir()
                   for f in (ROOT / d).rglob("*") if f.is_file() and f.suffix in (".md", ".json"))
    dirs = sorted({str(Path(f).parent).replace("\\", "/") for f in files})
    return {"files": files, "dirs": dirs}


def _nav_items(folder: str, recursive: bool = True):
    con = db.connect()
    pat = folder + "/%" if recursive else folder + "/%"
    rows = con.execute(
        "SELECT path,title,type,status,secret FROM pages WHERE path LIKE ? ORDER BY title",
        (pat,)).fetchall()
    items = []
    for r in rows:
        rest = r["path"][len(folder) + 1:]
        if rest.upper().startswith("README"):
            continue  # index složky není položka obsahu
        if not recursive and "/" in rest:
            continue
        items.append({"path": r["path"], "title": r["title"], "url": render.page_url(r["path"]),
                      "type": r["type"], "status": r["status"], "secret": bool(r["secret"]),
                      "sub": rest.rsplit("/", 1)[0] if "/" in rest else ""})
    return items


@router.get("/nav")
def nav(u: dict | None = Depends(security.optional)):
    """Strom navigace podle metadat (typy, složky). Tajné položky se hráčům neposílají."""
    is_editor = security.can_edit(u)

    def items(folder, sub=None):
        out = []
        for it in _nav_items(folder):
            if it["secret"] and not is_editor:
                continue
            if sub is not None and it["sub"] != sub:
                continue
            if sub is None and it["sub"]:
                continue
            out.append(it)
        return out

    def subgroups(folder):
        subs = sorted({it["sub"].split("/", 1)[0] for it in _nav_items(folder) if it["sub"]})
        return subs

    npc_subs = subgroups("04_Postavy/NPC")
    postavy = [{"id": "postavy-katalog", "title": "Katalog postav", "url": "/katalog/postavy",
                "type": "katalog", "status": "", "secret": False, "sub": ""}]
    for s in ["Stavitele_a_Bohove", "Vladci"]:
        sub_items = items("04_Postavy/" + s)
        if sub_items:
            postavy.append({"id": f"postavy-{s}", "title": {"Stavitele_a_Bohove": "Stavitelé a bohové",
                           "Vladci": "Vládci"}[s], "children": sub_items, "type": "group",
                           "status": "", "secret": False, "sub": ""})
    npc_group = []
    for s in npc_subs:
        sub_items = items("04_Postavy/NPC/" + s)
        if sub_items:
            npc_group.append({"id": f"npc-{s}", "title": s.replace("_", " "), "children": sub_items,
                              "type": "group", "status": "", "secret": False, "sub": ""})
    npc_top = items("04_Postavy/NPC")
    if npc_top or npc_group:
        postavy.append({"id": "npc", "title": "NPC", "children": npc_top + npc_group,
                        "type": "group", "status": "", "secret": False, "sub": ""})

    con = db.connect()

    svet = [
        {"id": "svet-historie", "title": "Historie a kosmologie", "url": "/p/01_Svet",
         "children": items("01_Svet"), "type": "group"},
        {"id": "mista", "title": "Místa", "url": "/p/01_Svet/Mista", "children": items("01_Svet/Mista"), "type": "group"},
        {"id": "zeme", "title": "Země", "url": "/p/02_Zeme", "children": items("02_Zeme"), "type": "group"},
        {"id": "mesta", "title": "Města", "url": "/p/03_Mesta", "children": items("03_Mesta"), "type": "group"},
        {"id": "obchody", "title": "Obchody", "url": "/p/12_Obchody", "type": "group",
         "children": [{"id": "obchody-katalog", "title": "Katalog obchodů", "url": "/katalog/obchody",
                       "type": "katalog", "status": "", "secret": False, "sub": ""}] + items("12_Obchody")},
        {"id": "postavy", "title": "Postavy", "url": "/p/04_Postavy", "children": postavy, "type": "group"},
        {"id": "frakce", "title": "Frakce", "url": "/p/05_Frakce", "children": items("05_Frakce"), "type": "group"},
        {"id": "knihy", "title": "Knihy a dokumenty", "url": "/p/06_Knihy_a_Dokumenty",
         "children": items("06_Knihy_a_Dokumenty"), "type": "group"},
        {"id": "mapy", "title": "Mapy", "url": "/p/11_Mapy", "children": items("11_Mapy"), "type": "group"},
    ]
    hra = [
        {"id": "boj", "title": "Bojový modul", "url": "/boj", "type": "tool"},
        {"id": "boje", "title": "Správa bojů", "url": "/boje", "type": "tool"},
        {"id": "kampane", "title": "Kampaně", "url": "/kampane",
         "children": items("07_Kampane"), "type": "group"},
        {"id": "questy", "title": "Questy", "url": "/p/08_Questy", "children": items("08_Questy"), "type": "group"},
        {"id": "sezeni", "title": "Sezení", "url": "/p/10_Sezeni", "children": items("10_Sezeni"), "type": "group"},
        {"id": "hadanky", "title": "Hádanky", "url": "/p/09_Hadanky", "children": items("09_Hadanky"), "type": "group"},
        {"id": "hudba", "title": "Hudba", "url": "/hudba", "type": "tool"},
    ]
    znalosti = [
        {"id": "znalosti", "title": "Rozcestník", "url": "/znalosti", "type": "tool"},
        {"id": "druhy", "title": "Druhy", "url": "/katalog/druhy", "type": "katalog"},
        {"id": "povolani", "title": "Povolání", "url": "/katalog/povolani", "type": "katalog"},
        {"id": "podtridy", "title": "Podtřídy", "url": "/katalog/podtridy", "type": "katalog"},
        {"id": "pozadi", "title": "Pozadí", "url": "/katalog/pozadi", "type": "katalog"},
        {"id": "featy", "title": "Featy", "url": "/katalog/featy", "type": "katalog"},
        {"id": "kouzla", "title": "Kouzla", "url": "/katalog/kouzla", "type": "katalog"},
        {"id": "bestiar", "title": "Bestiář", "url": "/katalog/bestiar", "type": "katalog"},
        {"id": "predmety", "title": "Předměty a výbava", "url": "/katalog/predmety", "type": "katalog"},
        {"id": "glosar", "title": "Glosář", "url": "/katalog/glosar", "type": "katalog"},
        {"id": "pravidla", "title": "Pravidla hry", "url": "/pravidla", "type": "group"},
    ]
    sprava = [
        {"id": "otazky", "title": "Otevřené otázky", "url": render.page_url("Otevrene_otazky.md"), "type": "stranka"},
        {"id": "sablony", "title": "Šablony", "url": "/p/_Sablony", "children": items("_Sablony"), "type": "group"},
        {"id": "graf", "title": "Graf vazeb", "url": "/graf", "type": "tool"},
        {"id": "heraldika", "title": "Heraldika", "url": "/heraldika", "type": "tool"},
    ]
    if u and u["role"] == "admin":
        sprava += [
            {"id": "uzivatele", "title": "Uživatelé", "url": "/sprava/uzivatele", "type": "tool"},
            {"id": "audit", "title": "Audit", "url": "/sprava/audit", "type": "tool"},
            {"id": "system", "title": "Systém a zálohy", "url": "/sprava/system", "type": "tool"},
        ]
    sections = [
        {"id": "uvod", "title": "Úvod", "url": "/"},
        {"id": "mapa", "title": "Mapa", "url": "/mapa"},
        {"id": "svet", "title": "Svět", "children": svet},
        {"id": "hra", "title": "Kampaně", "children": hra},
        {"id": "znalosti", "title": "Znalosti", "children": znalosti},
    ]
    if is_editor:
        sections.append({"id": "sprava", "title": "Správa", "children": sprava})
    return {"sections": sections}

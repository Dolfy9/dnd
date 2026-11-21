import { useEffect, useRef, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Folder, Lock, Map as MapIcon, PencilLine, Plus, SlidersHorizontal, Trash2, Wand2 } from "lucide-react";
import { del, post, usePage } from "../api";
import Markdown from "../components/Markdown";
import RightRail from "../layout/RightRail";
import { pushRecent } from "../layout/Sidebar";
import EntityForm from "../components/EntityForm";
import CharSheet from "../components/CharSheet";
import NewEntityDialog, { DIR_TYPE } from "../components/NewEntityDialog";

/* typ entity → kind v /api/postava/obsah (stránky s editovatelnou mechanikou) */
const MECH_KIND: Record<string, string> = {
  druh: "species", povolani: "class", podtrida: "subclass",
  feat: "feat", kouzlo: "spell", predmet: "item", pozadi: "background",
};
import { confirmDialog, toast, PageHeader } from "../components/ui";
import { GROUP_ICONS } from "../icons";
import { useApp, isEditor } from "../store";

const GROUP_LABELS: Record<string, string> = {
  "01_Svet": "Svět", Mista: "Místa", "02_Zeme": "Země", "03_Mesta": "Města",
  "04_Postavy": "Postavy", "05_Frakce": "Frakce", "06_Knihy_a_Dokumenty": "Knihy",
  "07_Kampane": "Kampaně", "08_Questy": "Questy", "09_Hadanky": "Hádanky",
  "10_Sezeni": "Sezení", "11_Mapy": "Mapy", "12_Obchody": "Obchody",
  "13_Druhy": "Druhy", "14_Povolani": "Povolání", "15_Podtridy": "Podtřídy",
  NPC: "NPC", Vladci: "Vládci", Stavitele_a_Bohove: "Stavitelé a bohové",
};

function pathFromLocation(pathname: string): string {
  let p = decodeURIComponent(pathname.replace(/^\/p\/?/, ""));
  if (!p || p === "/") return "README.md";
  p = p.replace(/\/+$/, "");
  if (!p.endsWith(".md")) p += p.includes(".") ? "" : ".md";
  if (!p.includes("/") && p !== "README.md") p = p;
  return p === "" ? "README.md" : p;
}

export default function PageView() {
  const loc = useLocation();
  const path = pathFromLocation(loc.pathname === "/" ? "/p/README" : loc.pathname);
  const page = usePage(path);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, previewPlayer } = useApp();
  const editor = isEditor(user) && !previewPlayer;
  const [editData, setEditData] = useState(false);
  const [newHere, setNewHere] = useState(false);

  useEffect(() => {
    if (page.data?.title) pushRecent(page.data.path, page.data.title);
  }, [page.data?.path, page.data?.title]);

  useEffect(() => { setEditData(false); }, [path]);
  // výška sticky lišty stránky → CSS var pro zanořené sticky prvky (listina postavy)
  const headBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = headBarRef.current;
    const root = document.documentElement;
    if (!el) { root.style.removeProperty("--pv-head-h"); return; }
    const set = () => root.style.setProperty("--pv-head-h", el.offsetHeight + "px");
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty("--pv-head-h"); };
  }, [page.data]);

  if (page.isLoading) {
    return <div className="p-8 text-[var(--ink-3)] font-ui text-sm">Načítám stránku…</div>;
  }
  if (page.error) {
    const stem = path.split("/").pop()!.replace(/\.md$/, "");
    const dir = path.includes("/") ? path.split("/").slice(0, -1).join("/") : "";
    const createHere = async () => {
      try {
        const name = stem.replace(/_/g, " ").replace(/^(Postava|Mesto|Quest|Hadanka|Sezeni|Obchod|Druh|Povolani|Podtrida|Kniha|Kampan) /, "");
        const r = await post<{ url: string; path: string }>("/api/page", { dir, name });
        qc.invalidateQueries({ queryKey: ["nav"] });
        toast("Stránka vytvořena.", "ok");
        nav(`/upravit/${encodeURI(r.path.replace(/\.md$/, ""))}`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Vytvoření selhalo", "err");
      }
    };
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Stránka nenalezena</h1>
        <p className="text-[var(--ink-2)] font-ui text-sm mb-4">
          <code>{path}</code> – {page.error.message}
        </p>
        {editor && (
          <button className="btn btn-primary !text-sm" onClick={createHere}>
            <FilePlus2 size={15} /> Vytvořit tuto stránku
          </button>
        )}
      </div>
    );
  }
  const d = page.data!;

  const remove = async () => {
    if (!await confirmDialog({
      title: "Smazat stránku",
      text: `Opravdu smazat ${d.path}? Soubor se smaže z repozitáře.`,
      okLabel: "Smazat", danger: true,
    })) return;
    try {
      await del(`/api/page?path=${encodeURIComponent(d.path)}`);
      qc.invalidateQueries({ queryKey: ["nav"] });
      toast("Stránka smazána.", "ok");
      const dir = d.path.includes("/") ? d.path.split("/").slice(0, -1).join("/") : "";
      nav(dir ? "/p/" + encodeURI(dir) : "/");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Smazání selhalo", "err");
    }
  };

  const segs = d.path.split("/").slice(0, -1);
  const crumbs = segs.map((s, i) => ({
    label: GROUP_LABELS[s] || s.replace(/_/g, " "),
    url: "/p/" + segs.slice(0, i + 1).join("/"),
  }));

  const wide = d.type === "adresar" || !!d.entity?.sheet;
  const isPostava = !!d.entity?.sheet;

  return (
    <div className="flex items-start">
      <div className="flex-1 min-w-0 pb-6 lg:pb-10">
        <div className={"mx-auto w-full px-6 lg:px-10 " + (isPostava ? "max-w-[1400px]" : wide ? "max-w-6xl" : "max-w-[78ch]")}>
        <div ref={headBarRef} className="sticky top-0 z-20 flex items-center gap-2 mb-3 py-2 bg-[var(--bg)] border-b border-[var(--line)]">
          {!!crumbs.length && (
            <nav className="pv-crumbs font-ui text-[11px] text-[var(--ink-3)] flex gap-1.5 flex-wrap flex-1 min-w-0">
              <Link to="/">Svět</Link>
              {crumbs.map((c, i) => (
                <span key={i} className="flex gap-1.5">
                  <span>›</span>
                  <Link to={c.url} className="hover:text-[var(--accent-2)] hover:underline">{c.label}</Link>
                </span>
              ))}
              <span className="flex gap-1.5"><span>›</span><span className="text-[var(--ink-2)]">{d.title}</span></span>
            </nav>
          )}
          <div className="pv-actions flex gap-1.5 items-center flex-none flex-wrap">
            {d.secret && <span className="chip chip-accent flex items-center gap-1"><Lock size={11} /> tajné</span>}
            {d.map_place && (
              <Link to={`/mapa?misto=${encodeURIComponent(d.map_place.nazev)}`}
                className="btn !text-xs !py-1" title="Zobrazit na mapě"><MapIcon size={13} /> Mapa</Link>
            )}
            {editor && d.type !== "adresar" && (
              <>
                <Link to={`/upravit/${encodeURI(d.path.replace(/\.md$/, ""))}`}
                  className="btn !text-xs !py-1" title="Upravit text stránky (Markdown)">
                  <PencilLine size={13} /> Upravit text
                </Link>
                {d.entity && MECH_KIND[d.entity.type] && (
                  <Link to={`/obsah?kind=${MECH_KIND[d.entity.type]}&stranka=${encodeURIComponent(d.path)}`}
                    className="btn !text-xs !py-1" title="Upravit mechaniku (efekty, tabulka, rysy)">
                    <Wand2 size={13} /> Mechanika
                  </Link>
                )}
                {d.entity && !d.entity.sheet && (
                  <button className={"btn !text-xs !py-1" + (editData ? " btn-primary" : "")}
                    onClick={() => setEditData(!editData)} title="Upravit atributy entity">
                    <SlidersHorizontal size={13} /> Atributy
                  </button>
                )}
                <button className="btn btn-danger !text-xs !py-1" onClick={remove} title="Smazat stránku">
                  <Trash2 size={13} /> Smazat
                </button>
              </>
            )}
            {editor && d.type === "adresar" && (
              <button className="btn !text-xs !py-1" onClick={() => setNewHere(true)} title="Nová stránka v této složce">
                <Plus size={13} /> Nová stránka zde
              </button>
            )}
          </div>
        </div>

        {/* inline editace atributů (entity bez charsheettu — postava se edituje přímo ve sheetu) */}
        {editData && d.entity && !d.entity.sheet && (
          <div className="card p-4 mb-4 fade-in border-[var(--accent)]">
            <EntityForm
              type={d.entity.type}
              entityId={d.entity.id}
              entityPath={d.path}
              initial={d.entity.data}
              name={d.entity.name}
              status={d.status}
              onSaved={() => page.refetch()}
              onCancel={() => setEditData(false)}
            />
          </div>
        )}

        {d.type === "adresar" && d.children ? (
          (() => {
            const DirIcon = GROUP_ICONS[d.path.split("/").pop()!] || GROUP_ICONS[d.path.split("/")[0]] || Folder;
            return (
          <>
            <PageHeader icon={<DirIcon size={20} />}
              title={GROUP_LABELS[d.path.split("/").pop()!] || d.title} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {d.children.map((c) => (
                <Link key={c.path} to={c.url}
                  className="card p-3 hover:no-underline hover:border-[var(--accent)] font-ui flex items-center gap-2.5">
                  <DirIcon size={15} className="text-[var(--accent-2)] shrink-0" />
                  <span className="text-sm text-[var(--ink)]">{c.title}</span>
                  {c.secret && <Lock size={12} className="ml-auto inline text-[var(--accent)]" />}
                </Link>
              ))}
              {!d.children.length && (
                <div className="text-sm text-[var(--ink-3)] font-ui p-3">Složka je prázdná.</div>
              )}
            </div>
          </>
            );
          })()
        ) : (
          <>
            {d.entity?.sheet && (
              <CharSheet sheet={d.entity.sheet} ent={d.entity} hpKey={String(d.entity.id)}
                editor={editor} edit={editData} onEditToggle={setEditData}
                pagePath={d.path} playerMode={!editor} />
            )}
            <Markdown html={d.html} cols={!!d.entity?.sheet} />
          </>
        )}

        {editor && d.dm_html && (
          <div className="mt-6 border-2 border-dashed border-[var(--accent)] rounded-[var(--radius)] p-4 bg-[var(--accent-soft)]">
            <div className="font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--accent-2)] mb-2">
              Pro DM (tajné) – hráči tohle nevidí
            </div>
            <Markdown html={d.dm_html} />
          </div>
        )}

        {newHere && d.type === "adresar" && (
          <NewEntityDialog onClose={() => setNewHere(false)}
            initialDir={d.path}
            initialType={DIR_TYPE[d.path] || DIR_TYPE[d.path.split("/")[0]] || "stranka"} />
        )}

        {!!d.battles.length && (
          <div className="card p-3 mt-6 font-ui">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
              ⚔ Boje ({d.battles.length})
            </div>
            <ul className="space-y-1 text-sm">
              {d.battles.map((b) => (
                <li key={b.id}>
                  <Link to={`/boj?boj=${b.id}`}>{b.name}</Link>
                  <span className="text-[var(--ink-3)] text-xs ml-2">{b.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>
        {/* <1280px: obsah pravého sloupce jako rozbalitelná sekce pod stránkou */}
        {!isPostava && <RightRail page={d} variant="details" />}
      </div>
      {!isPostava && <RightRail page={d} />}
    </div>
  );
}

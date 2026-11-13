import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { usePage } from "../api";
import Markdown from "../components/Markdown";
import RightRail from "../layout/RightRail";
import { pushRecent } from "../layout/Sidebar";
import EntityForm from "../components/EntityForm";
import CharSheet from "../components/CharSheet";
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
  const { user, previewPlayer } = useApp();
  const editor = isEditor(user) && !previewPlayer;
  const [editData, setEditData] = useState(false);

  useEffect(() => {
    if (page.data?.title) pushRecent(page.data.path, page.data.title);
  }, [page.data?.path, page.data?.title]);

  useEffect(() => { setEditData(false); }, [path]);

  if (page.isLoading) {
    return <div className="p-8 text-[var(--ink-3)] font-ui text-sm">Načítám stránku…</div>;
  }
  if (page.error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Stránka nenalezena</h1>
        <p className="text-[var(--ink-2)] font-ui text-sm">
          <code>{path}</code> – {page.error.message}
        </p>
      </div>
    );
  }
  const d = page.data!;
  const segs = d.path.split("/").slice(0, -1);
  const crumbs = segs.map((s, i) => ({
    label: GROUP_LABELS[s] || s.replace(/_/g, " "),
    url: "/p/" + segs.slice(0, i + 1).join("/"),
  }));

  return (
    <div className="flex min-h-0 h-full">
      <div className="flex-1 min-w-0 overflow-y-auto px-6 lg:px-10 pt-2 pb-6 lg:pb-10">
        <div className="flex items-center gap-2 mb-3">
          {!!crumbs.length && (
            <nav className="font-ui text-[11px] text-[var(--ink-3)] flex gap-1.5 flex-wrap flex-1 min-w-0">
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
          <div className="flex gap-1.5 items-center flex-none">
            {d.secret && <span className="chip chip-accent">🔒</span>}
            {d.map_place && (
              <Link to={`/mapa?misto=${encodeURIComponent(d.map_place.nazev)}`}
                className="btn !text-xs !py-1" title="Zobrazit na mapě">🗺 Mapa</Link>
            )}
            {editor && d.entity && (
              <button className={"btn !text-xs !py-1" + (editData ? " btn-primary" : "")} onClick={() => setEditData(!editData)}>
                ✎ Upravit
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
            />
          </div>
        )}

        {d.type === "adresar" && d.children ? (
          <>
            <h1 className="text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-head)", color: "var(--accent)" }}>{d.title}</h1>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {d.children.map((c) => (
                <Link key={c.path} to={c.url}
                  className="card p-3 hover:no-underline hover:border-[var(--accent)] font-ui">
                  <span className="text-sm text-[var(--ink)]">{c.title}</span>
                  {c.secret && <span className="ml-1.5 text-xs">🔒</span>}
                </Link>
              ))}
              {!d.children.length && (
                <div className="text-sm text-[var(--ink-3)] font-ui p-3">Složka je prázdná.</div>
              )}
            </div>
          </>
        ) : (
          <>
            {d.entity?.sheet && (
              <CharSheet sheet={d.entity.sheet} ent={d.entity} hpKey={String(d.entity.id)}
                editor={editor} edit={editData} onEditToggle={setEditData} />
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
      <RightRail page={d} />
    </div>
  );
}

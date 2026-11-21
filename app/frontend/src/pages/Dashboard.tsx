import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Inbox, Plus, type LucideIcon } from "lucide-react";
import { get } from "../api";
import { isEditor, useApp } from "../store";
import { GROUP_ICONS, NAV_ICONS } from "../icons";
import NewEntityDialog from "../components/NewEntityDialog";

const TILES: { href: string; name: string; desc: string; icon: LucideIcon }[] = [
  { href: "/mapa", name: "Mapa", desc: "Prozkouj svět a jeho vrstvy.", icon: GROUP_ICONS["11_Mapy"] },
  { href: "/k/svet", name: "Svět", desc: "Historie, země, města, místa, frakce a postavy.", icon: GROUP_ICONS["01_Svet"] },
  { href: "/katalog/postavy", name: "Postavy", desc: "Najdi postavu podle jména a vazeb.", icon: GROUP_ICONS["04_Postavy"] },
  { href: "/katalog/obchody", name: "Obchody", desc: "Obchody, služby a jejich nabídky.", icon: GROUP_ICONS["12_Obchody"] },
  { href: "/k/znalosti", name: "Znalosti", desc: "Pravidla, druhy, povolání, kouzla a bestiář.", icon: NAV_ICONS.znalosti },
  { href: "/k/hra", name: "Kampaň", desc: "Bojový modul, questy, sezení a hudba.", icon: NAV_ICONS.kampane },
  { href: "/p/05_Frakce/", name: "Frakce", desc: "Řády, odboj a další mocenské skupiny.", icon: GROUP_ICONS["05_Frakce"] },
  { href: "/heraldika", name: "Heraldika", desc: "Erby zemí a měst Montelienu.", icon: NAV_ICONS.heraldika },
];

function Recents() {
  let items: { path: string; title: string }[] = [];
  try { items = JSON.parse(localStorage.getItem("mont-recents") || "[]"); } catch { /* ignore */ }
  if (!items.length) return null;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-2">
        <Clock size={12} /> Nedávné
      </div>
      <ul className="space-y-1">
        {items.slice(0, 8).map((r) => (
          <li key={r.path}>
            <Link to={`/p/${encodeURI(r.path.replace(/\.md$/, ""))}`}
              className="font-ui text-[13px] hover:text-[var(--accent-2)]">
              {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useApp();
  const editor = isEditor(user);
  const [newEntity, setNewEntity] = useState(false);
  const stats = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => get<Record<string, number>>("/api/admin/status"),
    enabled: editor,
    retry: false,
  });
  const navrhy = useQuery({
    queryKey: ["navrhy"],
    queryFn: () => get<{ items: unknown[] }>("/api/admin/navrhy"),
    enabled: editor,
    retry: false,
  });
  const navrhyCount = navrhy.data?.items.length;

  return (
    <div className="chapter fade-in">
      <h1 className="chapter-title">Montelien</h1>
      <div className="chapter-rule"><i>✦</i></div>
      <p className="text-center text-[var(--ink-2)] max-w-2xl mx-auto mb-10 italic">
        Svět, který stvořil uprchlý Ferienec <b>Ertus Potřísněný</b> a jeho děti –{" "}
        <b>Turandar (Stavitelé)</b>. Po Temném dni leží slavná říše v troskách a poslední
        dva roky nad ní tiše vládne <b>Ordenský řád</b>.
      </p>

      <div className="chapter-grid">
        {TILES.map((t) => (
          <Link key={t.href} to={t.href} className="chapter-card">
            <b className="flex items-center gap-2"><t.icon size={16} className="text-[var(--accent-2)]" />{t.name}</b>
            <small>{t.desc}</small>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Recents />
        {editor && (
          <div className="card p-4">
            <div className="flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-2">
              <Inbox size={12} /> Pro DM
            </div>
            <div className="font-ui text-sm space-y-2">
              <Link to="/sprava/navrhy" className="flex items-center gap-2">
                <span className="chip chip-accent">{navrhyCount ?? "…"}</span>
                návrhů k revizi
              </Link>
              <div>
                <button className="btn sm" onClick={() => setNewEntity(true)}>
                  <Plus size={13} /> Nový obsah
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {stats.data && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            ["stránek", stats.data.pages], ["entit", stats.data.entities],
            ["vazeb", stats.data.links], ["pravidel", stats.data.rules],
            ["uživatelů", stats.data.users],
          ].map(([l, n]) => (
            <span key={String(l)} className="chip !text-[11px]">
              <b className="mr-1">{String(n)}</b>{l}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 card p-4">
        <h2 style={{ fontFamily: "var(--font-head)" }}
          className="text-base font-bold text-[var(--accent)] mb-2">Rychlé odkazy</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="btn" to="/p/01_Svet/Historie_Montelienu">Historie Montelienu</Link>
          <Link className="btn" to="/p/Otevrene_otazky">Otevřené otázky</Link>
          {editor && <Link className="btn" to="/sprava/navrhy">Návrhy k revizi</Link>}
          <Link className="btn" to="/katalog/bestiar">Bestiář</Link>
          <Link className="btn" to="/katalog/kouzla">Kouzla</Link>
        </div>
      </div>

      {newEntity && <NewEntityDialog onClose={() => setNewEntity(false)} />}
    </div>
  );
}

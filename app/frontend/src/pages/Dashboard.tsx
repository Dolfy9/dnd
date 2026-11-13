import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get } from "../api";
import { isEditor, useApp } from "../store";

const TILES = [
  { href: "/mapa", name: "Mapa", desc: "Prozkouj svět a jeho vrstvy." },
  { href: "/k/svet", name: "Svět", desc: "Historie, země, města, místa, frakce a postavy." },
  { href: "/katalog/postavy", name: "Postavy", desc: "Najdi postavu podle jména a vazeb." },
  { href: "/katalog/obchody", name: "Obchody", desc: "Obchody, služby a jejich nabídky." },
  { href: "/k/znalosti", name: "Znalosti", desc: "Pravidla, druhy, povolání, kouzla a bestiář." },
  { href: "/k/hra", name: "Kampaň", desc: "Bojový modul, questy, sezení a hudba." },
  { href: "/p/05_Frakce/", name: "Frakce", desc: "Řády, odboj a další mocenské skupiny." },
  { href: "/heraldika", name: "Heraldika", desc: "Erby zemí a měst Montelienu." },
];

export default function Dashboard() {
  const { user } = useApp();
  const editor = isEditor(user);
  const stats = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => get<Record<string, number>>("/api/admin/status"),
    enabled: editor,
    retry: false,
  });

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
            <b>{t.name}</b>
            <small>{t.desc}</small>
          </Link>
        ))}
      </div>

      {stats.data && (
        <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-[var(--ink-3)]">
          <span>{stats.data.pages} stránek</span>
          <span>{stats.data.entities} entit</span>
          <span>{stats.data.links} vazeb</span>
          <span>{stats.data.rules} pravidel</span>
          <span>{stats.data.users} uživatelů</span>
        </div>
      )}

      <div className="mt-10 card p-4">
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
    </div>
  );
}

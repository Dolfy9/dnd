import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get } from "../api";
import type { BattleSummary } from "../types";

function Stub({ icon, title, text, phase }: { icon: string; title: string; text: string; phase: string }) {
  return (
    <div className="p-6 max-w-3xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-1">{icon} {title}</h1>
      <p className="text-[var(--ink-2)] font-ui text-sm mb-4">{text}</p>
      <div className="card p-4 font-ui text-sm text-[var(--ink-3)]">
        Tato část se dodělává v {phase}. Původní webová verze zůstává mezitím plně funkční.
      </div>
    </div>
  );
}

export function MapPage() {
  return <Stub icon="🗺" title="Mapa" text="Interaktivní atlas Montelienu (Leaflet), vrstvy, místa a vazby na stránky." phase="fázi 3" />;
}

export function BattlePage() {
  return <Stub icon="⚔" title="Bojový modul" text="Sdílená bojová mapa, iniciativa a živá synchronizace přes WebSocket." phase="fázi 4" />;
}

export function BattlesPage() {
  const battles = useQuery({
    queryKey: ["battles"],
    queryFn: () => get<{ battles: BattleSummary[] }>("/api/battles"),
    retry: false,
  });
  return (
    <div className="p-6 max-w-3xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-4">⚔ Uložené boje</h1>
      <div className="card divide-y divide-[var(--line)] font-ui">
        {(battles.data?.battles || []).map((b) => (
          <Link key={b.id} to={`/boj?boj=${b.id}`}
            className="flex items-center px-4 py-2.5 hover:no-underline hover:bg-[var(--panel-2)]">
            <span className="text-sm">{b.name}</span>
            {b.shared && <span className="chip chip-accent ml-2">živě</span>}
            <span className="ml-auto text-xs text-[var(--ink-3)]">{b.status}</span>
          </Link>
        ))}
        {!battles.data?.battles?.length && (
          <div className="px-4 py-6 text-sm text-[var(--ink-3)]">Zatím žádné uložené boje.</div>
        )}
      </div>
    </div>
  );
}

export function MusicPage() {
  return <Stub icon="🎵" title="Hudba" text="Přehrávač nálady s presety pro lokace a scény kampaně." phase="fázi 4" />;
}

export function GraphPage() {
  return <Stub icon="🕸" title="Graf vazeb" text="Interaktivní vizualizace propojení entit a stránek." phase="fázi 5" />;
}

export function ZnalostiPage() {
  const items = [
    ["/katalog/druhy", "Druhy (Species)"],
    ["/katalog/povolani", "Povolání (Classes)"],
    ["/katalog/podtridy", "Podtřídy (Subclasses)"],
    ["/katalog/pozadi", "Pozadí (Backgrounds)"],
    ["/katalog/featy", "Featy"],
    ["/katalog/kouzla", "Kouzla"],
    ["/katalog/bestiar", "Bestiář"],
    ["/katalog/predmety", "Předměty a výbava"],
    ["/katalog/glosar", "Glosář pravidel"],
  ];
  return (
    <div className="p-6 max-w-3xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-4">📜 Znalosti světa</h1>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(([href, label]) => (
          <Link key={href} to={href} className="card p-4 hover:no-underline hover:border-[var(--accent)] font-ui text-sm">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

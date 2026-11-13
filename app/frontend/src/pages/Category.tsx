import { Link, useParams } from "react-router-dom";
import {
  Swords, ScrollText, BookOpen, Music, Puzzle, Landmark, MapPin, Flag,
  Castle, Store, Users, LibraryBig, Map, Compass, Dna, Hammer, GitBranch,
  Sparkles, Wand, Skull, Package, BookA, Scale, Inbox, HelpCircle,
  LayoutTemplate, Network, Shield, UserCog, ListChecks, Settings,
  BookMarked, ClipboardList, Crown, Folder, type LucideIcon,
} from "lucide-react";
import { useNav } from "../api";
import { useApp } from "../store";
import type { NavItem } from "../types";

const INTRO: Record<string, string> = {
  svet: "Geografie, historie, kosmologie, země, města, obchody, postavy, frakce a dokumenty světa Montelien.",
  hra: "Nástroje pro vedení kampaní – boje, questy, sezení, hádanky a hudba.",
  znalosti: "Druhy, povolání, pozadí, featy, kouzla, bestiář, předměty a pravidla D&D 2024.",
  sprava: "Správa wiki – uživatelé, audit, nástroje a systém.",
  mapa: "Interaktivní atlas světa Montelien.",
};

// ikona pro každou položku navigace
const ICONS: Record<string, LucideIcon> = {
  // hra / kampaně
  boj: Swords, boje: ClipboardList, kampane: BookMarked, questy: ScrollText,
  sezeni: BookOpen, hadanky: Puzzle, hudba: Music,
  // svět
  "svet-historie": Landmark, mista: MapPin, zeme: Flag, mesta: Castle,
  obchody: Store, postavy: Users, frakce: Crown, knihy: LibraryBig, mapy: Map,
  // znalosti
  znalosti: Compass, druhy: Dna, povolani: Hammer, podtridy: GitBranch,
  pozadi: Landmark, featy: Sparkles, kouzla: Wand, bestiar: Skull,
  predmety: Package, glosar: BookA, pravidla: Scale,
  // správa
  navrhy: Inbox, otazky: HelpCircle, sablony: LayoutTemplate, graf: Network,
  heraldika: Shield, uzivatele: UserCog, audit: ListChecks, system: Settings,
};


function Tile({ item }: { item: NavItem }) {
  const Icon = ICONS[item.id || ""] || Folder;
  const inner = (
    <>
      <span className="navtile-ico"><Icon size={30} strokeWidth={1.4} /></span>
      <span className="navtile-t">{item.title}</span>
    </>
  );
  return item.url
    ? <Link to={item.url} className="navtile">{inner}</Link>
    : <div className="navtile !cursor-default">{inner}</div>;
}

export default function Category() {
  const { sec = "" } = useParams();
  const { user } = useApp();
  const navQ = useNav(!!user);
  const section = (navQ.data?.sections || []).find((s) => s.id === sec);

  if (navQ.isLoading) return <div className="p-8 text-[var(--ink-3)]">Načítám…</div>;
  if (!section) return <div className="p-8 text-[var(--ink-3)]">Kategorie nenalezena.</div>;

  return (
    <div className="chapter fade-in">
      <h1 className="chapter-title">{section.title}</h1>
      <div className="chapter-rule"><i>✦</i></div>
      {INTRO[sec] && (
        <p className="text-center text-[var(--ink-2)] max-w-xl mx-auto mb-8 italic">
          {INTRO[sec]}
        </p>
      )}
      <div className="navtile-grid">
        {(section.children || []).map((c, i) => <Tile key={c.id || i} item={c} />)}
      </div>
    </div>
  );
}

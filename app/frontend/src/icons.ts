import {
  Swords, ScrollText, BookOpen, Music, Puzzle, Landmark, MapPin, Flag,
  Castle, Store, Users, LibraryBig, Map, Compass, Dna, Hammer, GitBranch,
  Sparkles, Wand, Skull, Package, BookA, Scale, Inbox, HelpCircle,
  LayoutTemplate, Network, Shield, UserCog, ListChecks, Settings,
  BookMarked, ClipboardList, Crown, Folder, FileText, File, Globe,
  type LucideIcon,
} from "lucide-react";

// ikona pro každou položku navigace
export const NAV_ICONS: Record<string, LucideIcon> = {
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

// ikona pro typ entity / složky obsahu
export const TYPE_ICONS: Record<string, LucideIcon> = {
  postava: Users, zeme: Flag, mesto: Castle, frakce: Crown, kampan: BookMarked,
  quest: ScrollText, sezeni: BookOpen, hadanka: Puzzle, misto: MapPin,
  kniha: LibraryBig, obchod: Store, druh: Dna, povolani: Hammer,
  podtrida: GitBranch, svet: Globe, mapa: Map, sablona: LayoutTemplate,
  adresar: Folder, stranka: FileText,
};

// složka první úrovně / klíčová složka → ikona (adresářové výpisy, dlaždice)
export const GROUP_ICONS: Record<string, LucideIcon> = {
  "01_Svet": Globe, Mista: MapPin, "02_Zeme": Flag, "03_Mesta": Castle,
  "04_Postavy": Users, "05_Frakce": Crown, "06_Knihy_a_Dokumenty": LibraryBig,
  "07_Kampane": BookMarked, "08_Questy": ScrollText, "09_Hadanky": Puzzle,
  "10_Sezeni": BookOpen, "11_Mapy": Map, "12_Obchody": Store,
  "13_Druhy": Dna, "14_Povolani": Hammer, "15_Podtridy": GitBranch,
  _Sablony: LayoutTemplate, NPC: Users, Vladci: Crown,
  Stavitele_a_Bohove: Sparkles,
};

export const FALLBACK_ICON: LucideIcon = File;

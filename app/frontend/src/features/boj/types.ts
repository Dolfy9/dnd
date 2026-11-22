/* Typy bojového modulu (D&D 5e 2024). Čistá data — žádné React/DOM závislosti. */
import type { MapLightV2 } from "./model/mapV2";
import type { PendingDecision } from "./rules/pending";

export type Ability = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
export type Side = "druzina" | "nepratele" | "neutral";
export type TokenKind = "pc" | "mon" | "summon" | "custom";
export type AreaShape = "sphere" | "cube" | "cone" | "line" | "cylinder" | "emanation" | "rect";
export type DmgType =
  | "Acid" | "Bludgeoning" | "Cold" | "Fire" | "Force" | "Lightning" | "Necrotic"
  | "Piercing" | "Poison" | "Psychic" | "Radiant" | "Slashing" | "Thunder";

export const DMG_TYPES: DmgType[] = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic",
  "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
];
export const ABILITIES: Ability[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
export const SIZE_CELLS: Record<string, number> = {
  Tiny: 1, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4,
};

export interface CondInst {
  n: string;                    // název stavu (2024, EN)
  lvl?: number;                 // Exhaustion 1–6
  r?: number;                   // zbývající kola (tick na start tahu držitele)
  src?: string;                 // tokenId zdroje (Grappled držitele apod.)
  untilEndOf?: string;          // tokenId, na jehož konci tahu stav končí
}

export interface AttackDef {
  nazev: string;
  kind: "weapon" | "spell" | "feature";
  // útok na zásah (attack roll)
  bonus?: number;               // to-hit bonus
  melee?: boolean;
  reach?: number;               // ft
  range?: number;               // ft (normální dostřel)
  long?: number;                // ft (dlouhý dostřel)
  thrown?: [number, number];    // [range, long] pro hozené melee
  // záchrana místo attack rollu
  save?: Ability;
  dc?: number;
  half?: boolean;               // half damage on success
  // poškození
  dmg?: string;                 // "2d6+5"
  avg?: number;
  typ?: DmgType | string;
  dmg2?: string;                // druhý díl ("plus 2d6 Fire")
  typ2?: string;
  // oblast
  area?: { shape: AreaShape; size: number }; // size ve ft
  self?: boolean;
  // meta
  n?: number;                   // útoků za akci
  ba?: boolean;                 // bonus action
  rea?: boolean;                // reaction
  legendaryCost?: number;
  rc?: number;                  // Recharge X–6 (X)
  xd?: number;                  // X/Day (pocet)
  lvl?: number;                 // spell level (0 = cantrip)
  conc?: boolean;
  kouzlo?: string;              // název kouzla pro trvání/koncentraci
  durationRounds?: number;
  heal?: { dice: string; flat: number; plusMod?: boolean };  // léčící kouzlo
  utility?: boolean;               // utility kouzlo — jen cast log/slot/conc
  ritual?: boolean;                // lze seslat jako rituál
  ritualCast?: boolean;            // sesláno rituálně (bez slotu, +10 min)      // trvání efektu v kolech
  slot?: number;                // použitý spell slot (při seslání)
  upcast?: { dice: string; per: number }; // škálování na vyšší slot ("+1d6 za level nad 3" → {dice:"1d6",per:3})
  mastery?: string;
  condOnHit?: { n: string; dc?: number; ab?: Ability }[]; // stavy po zásahu
  pozn?: string;
  text?: string;                // plný text (pro tooltip/inspekci)
}

export interface ActiveEffect {
  id: string;
  nazev: string;
  icon?: string;                // emoji / id ikony
  style?: string;               // vizuální styl zóny
  src?: string;                 // tokenId původce
  conc?: string;                // název kouzla (vázáno na Concentration zdroje)
  duration?: { kind: "rounds" | "endOf" | "startOf"; rounds?: number; who?: string };
  saveEnd?: { ab: Ability; dc: number };
  mods: EffectMods;
  pj?: boolean;
}

export interface EffectMods {
  // útoky
  atkAdvBy?: boolean;           // útoky PROTI tomuto cíli mají Advantage (Faerie Fire, Paralyzed…)
  atkDisBy?: boolean;
  atkAdv?: boolean;             // vlastní útoky mají Advantage (Invisible)
  atkDis?: boolean;
  toHitBonus?: number;          // plošný bonus k zásahu
  toHitDice?: string;           // "1d4" (Bless) / "-1d4" (Bane)
  saveDice?: string;            // kostka k záchranám (Bless/Bane)
  // záchrany
  saveAdvAll?: boolean;         // Dodge → DEX
  saveAdvAb?: Ability[];
  saveDisAb?: Ability[];
  // ostatní
  acBonus?: number;
  dmgResist?: DmgType[] | "all";
  dmgVuln?: DmgType[];
  dmgImun?: DmgType[] | "all";
  extraDmgOnHit?: { dice: string; typ?: DmgType | string }; // Hunter's Mark, Hex
  speedMult?: number;
  speedSet?: number;
  extraAction?: boolean;        // Haste
  extraAtk?: boolean;           // Haste (1 weapon attack)
  grantsCond?: string;          // aplikuje condition na držitele
  advOnHitBy?: boolean;         // Help/Vex – další útočník Advantage
  noOA?: boolean;               // Disengage
  dodge?: boolean;              // Dodge (dis vs attacks + DEX save adv)
  helpBonus?: boolean;
  vex?: boolean;                // po zásahu: další útok na cíl Advantage
  sap?: boolean;                // po zásahu: cíl má Dis na další útok
  slowFt?: number;              // Slow mastery
  rechargeBonus?: boolean;
  // — rozšíření Phase B —
  acSet?: number;               // nastaví AC (Mage Armor, Barkskin)
  speedBonus?: number;          // +ft k speed (Longstrider)
  flySpeedSet?: number;         // Fly
  mirrorImages?: number;        // počet obrazů (Mirror Image)
  noHeal?: boolean;             // cíl nemůže získat HP (Chill Touch)
  nextSaveDice?: string;        // kostka k příští záchraně (Mind Sliver −1d4, Guidance +1d4)
  nextAtkAdvBy?: boolean;       // příští útok na cíl má adv (Guiding Bolt)
  nextAtkDis?: boolean;         // příští útok cíle má dis (Vicious Mockery)
  sneakDmg?: { dice: string };  // Sneak Attack (1× za tah, viz turnKey)
  uncanny?: boolean;            // Uncanny Dodge — reaction: zásah za půlku
  evasion?: boolean;            // DEX save areas: success 0, fail half
  dmgBonusMelee?: number;       // +dmg melee zbraněmi (Rage +2)
  sizeDelta?: number;           // Enlarge +1 / Reduce −1 (jen poznámka)
  stealthDisDetect?: boolean;   // Pass without Trace / BlindSense?
  dmgOnHitOnce?: { dice: string; typ?: DmgType | string }; // Divine Favor 1d4
}

export interface LightSource extends Pick<MapLightV2, "dmOnly" | "zap" | "tvar" | "smer" | "sirka" | "delka" | "color" | "intenzita" | "efekt" | "rychlost" | "stiny" | "blikani"> {
  id: string;
  nazev: string;
  bright: number;               // ft jasného světla
  dim: number;                  // ft slabého světla (navíc k bright)
  anchor?: [number, number];    // buňka (fixní)
  anchorExact?: boolean;
  tokenId?: string;             // neseno žetonem
  conc?: string;
}

export interface Zone {
  id: string;
  nazev: string;
  style: string;                // fire|fog|darkness|ice|web|radiant|necrotic|poison|thorns|water|storm|hazard
  shape: { kind: AreaShape; size: number; w?: number; h?: number };
  anchor: [number, number];     // buňka (sphere/cube/line start/cone apex); emanation → tokenId
  tokenId?: string;             // emanation navázaná na žeton
  dir?: number;                 // cone/line směr ve stupních (0 = východ)
  difficult?: boolean;          // těžký terén
  blocksLos?: boolean;          // Darkness / heavy fog
  trigger?: {
    on: "enter" | "start" | "end" | "any"; // start/end = tah tvora
    dmg?: { dice: string; typ: DmgType | string };
    save?: { ab: Ability; dc: number; half?: boolean };
    cond?: string;
    once?: boolean;
  };
  duration?: ActiveEffect["duration"];
  conc?: string;
  src?: string;
  pj?: boolean;
}

export interface DsState { s: number; f: number }

export interface Token {
  id: string;
  nazev: string;
  kind: TokenKind;
  side: Side;
  s: number;                    // rozměr v buňkách
  velikost?: string;
  typ?: string;                 // creature type (dragon, undead…) — emblem glyph
  x: number | null;
  y: number | null;
  hp: number;
  hp_stav?: string;
  max: number;
  tmp: number;
  ac: number;
  initB: number;
  init: number | null;
  speed: number;
  swim: number;
  fly: number;
  climb: number;
  saves: Partial<Record<Ability, number>>;
  mods: Partial<Record<Ability, number>>;
  atk: AttackDef[];
  cond: CondInst[];
  effects: ActiveEffect[];
  conc: false | string;
  react: boolean;
  spent: Record<string, boolean>;         // Recharge / použité schopnosti
  legendary?: { max: number; used: number; resist?: { max: number; used: number } };
  slots: { max: number; used: number }[];
  pact?: { lvl: number; max: number; used: number } | null;
  zdroje: { nazev: string; max: number; used: number; obnova?: string }[];
  ds: DsState;
  dead: boolean;
  speedOverride?: number;          // DM: dočasná rychlost (Long Rest / odebrání = smazat)
  startPos?: [number, number];     // pozice na začátku tahu (pro Vrátit pohyb)
  dying?: boolean;
  skryty?: boolean;
  elev?: number;
  xp: number;
  lvl?: number;
  cr?: string | number;
  odolnosti: string[];
  imunity: string[];
  zranitelnosti: string[];
  imunity_stavu: string[];
  smysly: string[];
  portret?: string;
  portretFokus?: { x: number; y: number; zoom: number }; // ořez portrétu na minci (0–1, ≥1)
  src?: { cesta?: string; srd?: string; owner?: string; kouzlo?: string };
  poznamka?: string;
  kouzla?: AttackDef[];         // naparsované kouzla coby akce
  pj_note?: string;
  // rozšíření (nová architektura)
  pb?: number;                  // proficiency bonus
  dc?: number;                  // spell save DC
  casting?: { trida?: string; ab?: Ability; dc?: number; atk?: number };
  extraAtk?: number;            // útoků za Attack akci (Extra Attack)
  skills?: Record<string, number>;     // bonusy dovedností (z listu)
  feats?: string[];                    // názvy featů
  features?: { nazev: string; text: string; zdroj?: string; uroven?: number }[];
  items?: { nazev: string; qty: number }[];   // consumables z výbavy
  heroicInspiration?: boolean;         // Heroic Inspiration k použití
  ready?: { text: string; until?: string }; // Ready akce
  initRoll?: number[];          // hozené d20 iniciativy (jen log)
  exhaustion?: number;          // úroveň Exhaustion (zrcadleno i v cond.lvl)
  rysy?: { nazev: string; text: string }[];
}

export interface LogEntry {
  k: number;                    // kolo
  c: string;                    // čas
  kdo: string;
  typ: "attack" | "damage" | "heal" | "save" | "cond" | "effect" | "move" | "turn" | "system";
  t: string;
  detail?: string;              // rozpad hodů
  pj?: boolean;                 // jen pro DM
}

export interface FxEvent {
  id: string;
  typ: "slash" | "bolt" | "projectile" | "aoe" | "dmg" | "heal" | "miss" | "crit" | "zone" | "shake";
  from?: [number, number];
  to?: [number, number];
  at?: [number, number];
  dmgType?: string;
  text?: string;
  tokenId?: string;
  area?: { shape: AreaShape; size: number; anchor: [number, number]; dir?: number };
}

export interface EcoState {
  atkLeft?: number;             // zbývající útoky Attack akce (Extra Attack)
  a: number;                    // Action použita
  b: number;                    // Bonus Action použita
  r: number;                    // Reaction použita (mirror of token.react)
  moved: number;                // použitý pohyb ve ft
  objInt: number;               // Utilize / free interaction
  spell: number;                // slot-level spell za Action
  baSpell: number;              // slot-level spell za Bonus Action
  dash: number;
  disengage: number;
  extraA: number;               // extra akce (Haste)
}

/** Nastavení boje — DM volitelné chování pravidel (persist v boji). */
export interface BattleSettings {
  rezim?: "pravidla" | "volny";   // Volný režim = bez pravidel
  pohyb: {
    limit: "prisne" | "zeptat" | "volne";
    uhlopricky: "5" | "5-10";
    pruchodNepratel: "blokovat" | "povolit";
    oa: "zeptat" | "jenZaznam" | "vypnuto";
    zonyPriPresunuDM: boolean;
    mimoTah: "volne" | "zeptat";
    priprava: "volne";
    vychoziPrekroceni?: MoveMode;
    sledujTah?: boolean;                 // auto-pan na aktivního při novém tahu (výchozí true)
  };
  automatizace: {
    hodUtoku: "auto" | "rucne";
    zraneni: "auto" | "potvrdit";
    concentration: "auto" | "zeptat" | "vypnuto";
    zony: "auto" | "zeptat" | "vypnuto";
    expirace: "auto" | "zeptat";
    recharge: "auto" | "rucne";
    deathSaves: "auto" | "rucne";
    ekonomika: "hlidat" | "varovat" | "vypnuto";
    reakce: "zeptat" | "vypnuto";
    sloty: "hlidat" | "varovat" | "vypnuto";
    dosah: "hlidat" | "varovat";
  };
}
export type MoveMode = "pravidla" | "dash" | "prekrocit" | "nuceny" | "teleport";

export interface StavBoje {
  pendingResolutions?: PendingDecision[];
  map?: string;
  tok: Token[];
  ord: string[];
  turn: number;
  round: number;
  legendaryWindow?: { actorId: string; usedBy: string[] };
  log: LogEntry[];
  eco: Record<string, EcoState>;
  zones: Zone[];
  fx: FxEvent[];
  teren?: Record<string, string>;         // "x,y" → znak dlaždice (přepisuje mrizka)
  lights?: LightSource[];                 // světelné zdroje
  lightLevel?: "bright" | "dim" | "dark"; // globální osvětlení (z map.osvetleni)
  lightCells?: Record<string, "bright" | "dim" | "dark">;
  playerLightCells?: Record<string, "bright" | "dim" | "dark">;
  privateSourceIds?: string[];
  fog?: { on: boolean; revealed: Record<string, 1>; visible?: Record<string, 1>;
    manual?: Record<string, 1>; hidden?: Record<string, 1> }; // fog of war
  dvere?: Record<string, boolean>;            // wallId → otevřené dveře (stav v boji)
  zdroje?: Record<string, boolean>;
  nastaveni?: BattleSettings;     // DM nastavení pravidel tohoto boje
  turnMsgs?: string[];              // hlášky posledního posunu tahu (banner)
  sel?: string | null;
  moved?: number;
  dash?: boolean;
  disengage?: boolean;
  groups?: any;
  paint?: any;
  tab?: string;
  oa?: any;
  [k: string]: unknown;         // neznámé legacy klíče se zachovají
}

export interface BattleStateDoc {
  id?: string;
  nazev?: string;
  stav?: string;
  mapa?: string;
  kampan?: string;
  quest?: string;
  sezeni?: string;
  stav_boje: StavBoje;
  [k: string]: unknown;
}

export interface BattleMapData {
  mlha?: boolean;
  id: string;
  nazev: string;
  misto?: string;
  podklad: string;
  osvetleni?: string;
  popis?: string;
  start?: { druzina?: [number, number][]; nepratele?: [number, number][]; neutral?: [number, number][] };
  stretnuti?: { nazev: string; pocet: number }[];
  mrizka: string[];
  obrazek?: string;
  /* v2 pole — viz model/mapV2.ts (volitelná, staré mapy beze změny) */
  textury?: Record<string, string>;
  vyska?: Record<string, number>;
  steny?: import("./model/mapV2").MapWall[];
  objekty?: import("./model/mapV2").MapObject[];
  kresby?: import("./model/mapV2").MapDrawing[];
  svetla?: import("./model/mapV2").MapLightV2[];
  poznamky?: import("./model/mapV2").MapNote[];
  mrizkaStyl?: import("./model/mapV2").MapMrizkaStyl;
  kalibrace?: import("./model/mapV2").MapKalibrace;
}

export interface TileDef {
  nazev: string;
  cost: number;                 // 0 = neprůchodné
  cover?: number;               // 2 half, 3 three-quarters
  difficult?: boolean;
  blocksSight?: boolean;        // hustý porost apod. — blokuje LoS
  hazard?: string;              // např. "Fire" (láva)
  obscure?: 1 | 2;              // 1 lightly, 2 heavily obscured
}

export const TILES: Record<string, TileDef> = {
  ".": { nazev: "Podlaha / zem", cost: 1 },
  g: { nazev: "Tráva", cost: 1 },
  r: { nazev: "Cesta", cost: 1 },
  "#": { nazev: "Zeď", cost: 0 },
  o: { nazev: "Sloup / balvan", cost: 0, cover: 3 },
  T: { nazev: "Strom", cost: 0, cover: 3 },
  "%": { nazev: "Bedny (half cover, těžký terén)", cost: 2, cover: 2, difficult: true },
  "^": { nazev: "Těžký terén", cost: 2, difficult: true },
  "~": { nazev: "Hluboká voda", cost: 2, difficult: true },
  ",": { nazev: "Mělčina", cost: 2, difficult: true },
  "=": { nazev: "Most / lávka", cost: 1 },
  "+": { nazev: "Dveře", cost: 1 },
  _: { nazev: "Propast / jáma", cost: 0 },
  x: { nazev: "Nebezpečí", cost: 1 },
  S: { nazev: "Schody", cost: 1 },
  /* --- v2 nové dlaždice --- */
  l: { nazev: "Láva", cost: 0, hazard: "Fire" },
  i: { nazev: "Led", cost: 2, difficult: true },
  p: { nazev: "Jáma / příkop", cost: 0 },
  f: { nazev: "Řídký porost", cost: 2, difficult: true, obscure: 1 },
  F: { nazev: "Hustý porost", cost: 2, difficult: true, blocksSight: true, obscure: 2 },
  u: { nazev: "Suti / kamení", cost: 2, difficult: true },
  h: { nazev: "Nízká zeď (half cover, těžký terén)", cost: 2, difficult: true, cover: 2 },
  " ": { nazev: "Mimo mapu", cost: 0 },
};

export const BASE_COLORS: Record<string, string> = {
  mesto: "#8b8478", krypta: "#57524d", les: "#6d8c4c", ruiny: "#968b70",
  reka: "#789a54", more: "#1e4f78", pristav: "#7d7466", bazina: "#55684a",
  snih: "#dfe4ea", jeskyne: "#46423e", hory: "#827d73", poust: "#d4b882", plaz: "#dcc896",
};

export interface EffectPreset {
  id: string;
  nazev: string;
  icon: string;
  color?: string;               // barva chipu/aury
  cat?: string;                 // kategorie (buff|control|zone|feature|env)
  target: "ally" | "enemy" | "any" | "self";
  conc?: boolean;
  durationRounds?: number;
  saveEnd?: { ab: Ability };    // opakovaná záchrana na konci tahu držitele
  grantsCond?: string;
  mods: EffectMods;
  desc: string;
  badge?: string;               // text na minci (např. "+2")
  suggest?: string;             // regex na názvy features/kouzel postav pro auto-návrh
  zone?: {
    style: string;
    shape: { kind: Zone["shape"]["kind"]; size: number; w?: number; h?: number };
    difficult?: boolean;
    blocksLos?: boolean;
    trigger?: Zone["trigger"];
  };
}

export interface MonsterEntry {
  nazev: string; cr: string; cr_num?: number; typ: string; velikost: string;
  ac: number; ac_detail?: string; hp: number; hp_vzorec?: string;
  rychlost?: Record<string, number>; atributy?: Record<string, number>;
  zachrany?: string[]; dovednosti?: string[]; jazyky?: string;
  imunity?: string; odolnosti?: string; zranitelnosti?: string;
  smysly?: Record<string, number>; pasivni_vnimani?: number;
  iniciativa?: number; xp?: number;
  rysy?: { nazev: string; text: string }[];
  akce?: { nazev: string; text: string }[];
  bonusove_akce?: { nazev: string; text: string }[];
  reakce?: { nazev: string; text: string }[];
  legendary?: { nazev: string; text: string }[];
  legendarni?: { nazev: string; text: string }[];
  zdroj?: string;
}

export interface SpellEntry {
  uroven: number; cas: string; dosah: string; trvani: string; text: string;
  skola?: string; slozky?: string;
}

export const uid = (): string => Math.random().toString(36).slice(2, 10);
export const sg = (n: number): string => (n >= 0 ? "+" : "") + n;
export const mod = (v: number): number => Math.floor((v - 10) / 2);
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

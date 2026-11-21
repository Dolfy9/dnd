/* Migrace legacy stavu (web/assets/boj.js + starý Boj.tsx) do StavBoje. Nikdy nehází;
   neznámé klíče se zachovají (index signature na StavBoje). */
import type { StavBoje, Token, CondInst, LogEntry, Side, EcoState } from "../types";
import { uid } from "../types";

const SIDES: Record<string, Side> = {
  druzina: "druzina", nepratele: "nepratele", neutral: "neutral",
  p: "druzina", n: "nepratele", e: "neutral", party: "druzina", enemy: "nepratele",
  allies: "druzina", foes: "nepratele",
};

function normCond(c: any): CondInst | null {
  if (!c) return null;
  if (typeof c === "string") return { n: c };
  const n = c.n || c.name;
  if (!n) return null;
  return { n: String(n), lvl: c.lvl, src: c.src, r: c.r };
}

function normToken(o: any): Token {
  const t: Token = {
    id: o.id || uid(),
    nazev: o.nazev || o.name || "?",
    kind: o.kind === "monster" ? "mon" : o.kind === "npc" ? "custom" : o.kind || "pc",
    side: SIDES[o.side] || (o.side as Side) || "druzina",
    s: o.s || o.size || 1,
    x: o.x ?? null, y: o.y ?? null, elev: o.elev,
    hp: 1, max: 1, tmp: o.tmp ?? 0,
    ac: o.ac ?? 10, initB: o.initB ?? o.init_b ?? 0,
    init: o.init ?? null, initRoll: o.initRoll,
    speed: o.speed ?? o.rychlost ?? 30, swim: o.swim ?? 0, fly: o.fly ?? 0, climb: o.climb ?? 0,
    saves: o.saves || {}, mods: o.mods || {}, pb: o.pb,
    odolnosti: arr(o.odolnosti), imunity: arr(o.imunity), zranitelnosti: arr(o.zranitelnosti),
    imunity_stavu: arr(o.imunity_stavu), smysly: arr(o.smysly),
    dc: o.dc ?? o.dc_kouzel, casting: o.casting, extraAtk: o.extraAtk ?? o.utoky_za_akci,
    atk: o.atk || o.utoky || [], kouzla: o.kouzla,
    cond: [], effects: (o.effects || []).map((e: any) => ({ id: e.id || uid(), nazev: e.nazev || e.n || "efekt", icon: e.icon, src: e.src, conc: e.conc, duration: e.duration, saveEnd: e.saveEnd, mods: e.mods || {} })),
    conc: o.conc ?? false, react: o.react ?? true,
    spent: o.spent || o.usedRc || {},
    legendary: o.legendary,
    slots: (o.slots || []).map((s: any) => typeof s === "number" ? { max: s, used: 0 } : s),
    pact: o.pact, zdroje: (o.zdroje || []).map((z: any) => ({ nazev: z.nazev, max: z.max, used: z.used || 0, obnova: z.obnova })),
    ds: o.ds || { s: 0, f: 0 }, dead: !!o.dead, dying: o.dying,
    skryty: o.skryty || o.hidden,
    xp: o.xp || 0, lvl: o.lvl || o.level, cr: o.cr,
    portret: o.portret, portretFokus: o.portretFokus, src: o.src, poznamka: o.poznamka || o.notes, pj_note: o.pj_note,
    typ: o.typ || o.emblem, velikost: o.velikost, exhaustion: o.exhaustion || 0,
    rysy: o.rysy,
  } as Token;
  // legacy hp jako [cur,max]
  if (Array.isArray(o.hp)) { t.hp = o.hp[0] ?? 0; t.max = o.hp[1] ?? 1; }
  else { t.hp = o.hp ?? o.max ?? 1; t.max = o.max ?? o.hp ?? 1; }
  t.cond = (o.cond || []).map(normCond).filter(Boolean) as CondInst[];
  if (t.exhaustion && !t.cond.some((c) => c.n === "Exhaustion")) t.cond.push({ n: "Exhaustion", lvl: t.exhaustion });
  return t;
}

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? v.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];

function normLog(o: any): LogEntry | null {
  if (!o) return null;
  const t = o.t || o.text || o.d || o.msg || "";
  if (!t) return null;
  return {
    k: o.k ?? o.round ?? 0, c: o.c || o.cas || "",
    kdo: o.kdo || o.who || "",
    typ: o.typ || (o.kind === "a" ? "attack" : "system"),
    t: String(t), detail: typeof o.detail === "string" ? o.detail : o.blok ? JSON.stringify(o.blok) : undefined,
    pj: o.pj || undefined,
  };
}

/** Přijme jakýkoliv objekt z `state.stav_boje` a vrátí platný StavBoje. */
export function migrate(o: any): StavBoje {
  const src = (o && typeof o === "object") ? o : {};
  const S: StavBoje = {
    ...src,
    map: src.map,
    tok: (src.tok || src.tokens || []).map(normToken),
    ord: (src.ord || src.poradi || []).slice(),
    turn: src.turn ?? src.tah ?? -1,
    round: src.round ?? src.kolo ?? 0,
    log: [],
    eco: {},
    zones: (src.zones || []).map((z: any) => ({
      id: z.id || uid(), nazev: z.nazev || "zóna", style: z.style || "fire",
      shape: z.shape || { kind: "rect", size: 5, w: 1, h: 1 },
      anchor: z.anchor || [0, 0], dir: z.dir, tokenId: z.tokenId,
      src: z.src, conc: z.conc, trigger: z.trigger, difficult: z.difficult, blocksLos: z.blocksLos,
    })),
    fx: src.fx || [],
  };
  if (!S.ord.length && S.tok.length) S.ord = S.tok.map((t) => t.id);
  S.ord = S.ord.filter((id: any) => S.tok.some((t) => t.id === id));
  for (const l of src.log || []) { const n = normLog(l); if (n) S.log.push(n); }
  // legacy eco → per-token EcoState
  const eco: Record<string, EcoState> = {};
  for (const t of S.tok) {
    const oe = src.eco?.[t.id];
    eco[t.id] = oe && typeof oe === "object"
      ? { a: oe.a ?? 0, b: oe.b ?? 0, r: oe.r ?? 0, moved: oe.moved ?? (src.moved?.[t.id] ?? 0), objInt: oe.objInt ?? 0, spell: oe.spell ?? 0, baSpell: oe.baSpell ?? 0, dash: oe.dash ? 1 : 0, disengage: oe.disengage ? 1 : 0, extraA: oe.extraA ?? 0 }
      : { a: 0, b: 0, r: 0, moved: src.moved?.[t.id] ?? 0, objInt: 0, spell: 0, baSpell: 0, dash: src.dash ? 1 : 0, disengage: src.disengage ? 1 : 0, extraA: 0 };
    if (src.disengage) t.effects.push({ id: uid(), nazev: "Disengage", mods: { noOA: true } });
  }
  S.eco = eco;
  return S;
}

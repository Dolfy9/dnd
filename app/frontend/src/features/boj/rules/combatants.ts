/* Tvorba žetonů: z charsheetu postavy, ze SRD bestiáře, vlastní. Číslování duplicit. */
import type { Token, MonsterEntry, AttackDef, Ability, Side } from "../types";
import { uid, SIZE_CELLS } from "../types";
import { monsterAttacks, parseSpell } from "./parse";

const sizeCells = (v?: string) => SIZE_CELLS[v as keyof typeof SIZE_CELLS]
  ?? SIZE_CELLS[{ drobny: "Tiny", maly: "Small", stredni: "Medium", velky: "Large", obrovsky: "Huge", giganticky: "Gargantuan" }[(v || "").toLowerCase()] as keyof typeof SIZE_CELLS]
  ?? 1;

const toArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? v.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];

function parseSaves(list?: string[]): Partial<Record<Ability, number>> {
  const out: Partial<Record<Ability, number>> = {};
  for (const s of list || []) {
    const m = s.match(/(STR|DEX|CON|INT|WIS|CHA)\s*([+\-−]?\d+)/i);
    if (m) out[m[1].toUpperCase() as Ability] = Number(m[2].replace("−", "-"));
  }
  return out;
}

const baseTok = (nazev: string, side: Side, kind: Token["kind"]): Token => ({
  id: uid(), nazev, side, kind, s: 1,
  x: null, y: null, hp: 1, max: 1, tmp: 0, ac: 10, initB: 0, init: null,
  speed: 30, swim: 0, fly: 0, climb: 0,
  saves: {}, mods: {}, atk: [], cond: [], effects: [], conc: false, react: true,
  spent: {}, slots: [], zdroje: [], ds: { s: 0, f: 0 }, dead: false,
  xp: 0, odolnosti: [], imunity: [], zranitelnosti: [], imunity_stavu: [], smysly: [],
});

const RANGED_RE = /bow|luk|crossbow|kuš|sling|prak|dart|blowgun|javelin|harpoon/i;
const REACH_RE = /halberd|glaive|pike|whip|halapart|lance|kopí dl|reach/i;
const THROWN_RANGES: [RegExp, [number, number]][] = [
  [/dagger|dýka/i, [20, 60]], [/handaxe|sekerka/i, [20, 60]], [/javelin|ošťep/i, [30, 120]],
  [/spear|kopí/i, [20, 60]], [/light hammer|kladivo/i, [20, 60]], [/trident|trojzub/i, [20, 60]],
];

/** Token z entity.sheet (postava). portret = repo cesta z entity.portret. */
export function fromCharacter(md: string, name: string, sheet: any, side: Side = "druzina", portret?: string): Token {
  const boj = sheet?.boj || {};
  const sp = boj.rychlosti || {};
  const num = (v: unknown): number => { const m = String(v ?? "").match(/\d+/); return m ? Number(m[0]) : 0; };
  const t = baseTok(name, side, "pc");
  t.hp = t.max = boj.hp_max ?? 10;
  t.ac = boj.ac ?? 10;
  t.initB = boj.init ?? 0;
  t.speed = num(sp.walk ?? Object.values(sp)[0] ?? 30) || 30;
  t.swim = num(sp.swim); t.fly = num(sp.fly); t.climb = num(sp.climb);
  t.saves = boj.zachrany || {};
  t.mods = boj.mods || {};
  t.pb = boj.pb;
  t.odolnosti = toArr(boj.odolnosti);
  t.imunity = toArr(boj.imunity);
  t.imunity_stavu = toArr(boj.imunity_stavu);
  t.zranitelnosti = toArr(sheet?.zranitelnosti);
  t.smysly = toArr(boj.smysly);
  t.dc = typeof boj.dc_kouzel === "number" ? boj.dc_kouzel
       : boj.dc_kouzel && typeof boj.dc_kouzel === "object" ? Number(Object.values(boj.dc_kouzel)[0]) || undefined
       : undefined;
  t.casting = Array.isArray(sheet?.casting) ? sheet.casting[0] : sheet?.casting;
  t.extraAtk = boj.utoky_za_akci;
  t.skills = boj.dovednosti || {};
  t.feats = boj.featy || [];
  t.features = boj.rysy || [];
  t.items = (boj.vybava || []).map((v: any) => typeof v === "string" ? { nazev: v, qty: 1 } : { nazev: v.nazev || v.predmet || "?", qty: v.pocet ?? v.qty ?? 1 });
  t.heroicInspiration = !!boj.inspirace;
  t.exhaustion = sheet?.exhaustion || 0;
  if (t.exhaustion) t.cond.push({ n: "Exhaustion", lvl: t.exhaustion });
  t.portret = portret;
  t.src = { cesta: md };
  t.slots = (sheet?.slots || []).map((n: number) => ({ max: n, used: 0 }));
  t.zdroje = (boj.zdroje || []).map((z: any) => ({ nazev: z.nazev, max: z.max, used: 0, obnova: z.obnova }));
  t.atk = (boj.utoky || []).map((u: any): AttackDef => {
    const thrown = THROWN_RANGES.find(([re]) => re.test(u.nazev));
    const o: AttackDef = {
      nazev: u.nazev, kind: "weapon", bonus: u.atk, dmg: u.dmg, typ: u.typ,
      mastery: u.mastery, melee: !RANGED_RE.test(u.nazev), n: 1,
    };
    if (o.melee) o.reach = REACH_RE.test(u.nazev) ? 10 : 5;
    else { o.range = u.range || 60; o.long = u.long; }
    if (thrown) o.thrown = thrown[1];
    return o;
  });
  // kouzla → naparsované akce
  const ctx = { dc: t.dc || t.casting?.dc || 10, atk: t.casting?.atk ?? (t.casting?.dc ?? 10) - 8, smod: Math.max(0, (t.casting?.atk ?? 0) - (t.pb ?? 2)), lvl: sheet?.uroven || sheet?.level || 1 };
  t.lvl = ctx.lvl;
  t.kouzla = (boj.kouzla?.length ? boj.kouzla : sheet?.kouzla || [])
    .map((k: any) => parseSpell(k.nazev || k, { [k.nazev || k]: k }, ctx))
    .filter(Boolean) as AttackDef[];
  if (!t.atk.length && !t.kouzla.length)
    t.atk.push({ nazev: "Unarmed Strike", kind: "weapon", melee: true, reach: 5, bonus: (t.pb || 2) + (t.mods.STR || 0), dmg: "1", typ: "Bludgeoning", n: 1 });
  return t;
}

/** Token ze SRD bestiáře. */
export function fromMonster(m: MonsterEntry, side: Side = "nepratele"): Token {
  const t = baseTok(m.nazev, side, "mon");
  t.typ = (m.typ || "humanoid").toLowerCase();
  t.velikost = m.velikost;
  t.s = sizeCells(m.velikost);
  t.hp = t.max = m.hp ?? 10;
  t.ac = m.ac ?? 10;
  const atr = m.atributy || {};
  for (const k of ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as Ability[])
    if (atr[k] != null) t.mods[k] = Math.floor((atr[k] - 10) / 2);
  t.initB = m.iniciativa ?? t.mods.DEX ?? 0;
  const speedStr = (k: string) => { const v = (m.rychlost || {})[k]; const mm = String(v ?? "").match(/\d+/); return mm ? Number(mm[0]) : 0; };
  t.speed = speedStr("walk") || speedStr("chůze") || 30;
  t.fly = speedStr("fly"); t.swim = speedStr("swim"); t.climb = speedStr("climb");
  t.saves = parseSaves(m.zachrany);
  t.pb = Math.max(2, Math.ceil((m.cr_num ?? 0) / 4) + 1);
  t.odolnosti = toArr(m.odolnosti);
  t.imunity = toArr(m.imunity);
  t.zranitelnosti = toArr(m.zranitelnosti);
  t.smysly = m.smysly ? Object.keys(m.smysly).map((k) => `${k} ${(m.smysly as any)[k]} ft`) : [];
  t.atk = monsterAttacks(m);
  t.cr = m.cr; t.xp = m.xp || 0;
  t.src = { srd: m.nazev };
  const leg = m.legendarni || m.legendary || [];
  const rysy = (m.rysy || []).map((r) => `${r.nazev}: ${r.text}`).join(" ");
  const lr = rysy.match(/Legendary Resistance \((\d+)\/Day/i);
  if (leg.length || lr)
    t.legendary = { max: 3, used: 0, resist: lr ? { max: Number(lr[1]), used: 0 } : undefined };
  if (!t.atk.length)
    t.atk.push({ nazev: "Slam", kind: "weapon", melee: true, reach: 5, bonus: t.pb + (t.mods.STR || 0), dmg: "1d6", typ: "Bludgeoning", n: 1 });
  return t;
}

export function custom(nazev: string, side: Side, hp: number, ac: number, speed = 30, opt?: { s?: number; color?: string; obrazek?: string }): Token {
  const t = baseTok(nazev, side, "custom");
  t.hp = t.max = hp; t.ac = ac; t.speed = speed;
  if (opt?.s) t.s = opt.s;
  if (opt?.color) (t as any).color = opt.color;
  if (opt?.obrazek) t.portret = opt.obrazek;
  t.atk.push({ nazev: "Útok", kind: "weapon", melee: true, reach: 5, bonus: 3, dmg: "1d6+1", typ: "Bludgeoning", n: 1 });
  return t;
}

/** Očísluje duplicity jmen: Guard → Guard 1, Guard 2… */
export function numberDuplicates(tokens: Token[]): void {
  const base = new Map<string, Token[]>();
  for (const t of tokens) {
    const b = t.nazev.replace(/\s+\d+$/, "");
    const arr = base.get(b) || [];
    arr.push(t); base.set(b, arr);
  }
  for (const [b, arr] of base)
    if (arr.length > 1) arr.forEach((t, i) => { t.nazev = `${b} ${i + 1}`; });
}

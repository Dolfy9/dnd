/* Tvorba žetonů: z charsheetu postavy, ze SRD bestiáře, vlastní. Číslování duplicit. */
import type { Token, MonsterEntry, AttackDef, Ability, Side } from "../types";
import { uid, SIZE_CELLS } from "../types";
import { monsterAttacks } from "./parse";
import { importMonsterSpells, linkedSpell, type SpellCatalog } from "./importSpells";
import { CONDITION_NAMES } from "./conditions";
import { DMG_TYPES } from "../types";

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
export function fromCharacter(md: string, name: string, sheet: any, side: Side = "druzina", portret?: string, spells: SpellCatalog = {}): Token {
  const boj = sheet?.boj || {};
  const sp = boj.rychlosti || {};
  const num = (v: unknown): number => { const m = String(v ?? "").match(/\d+/); return m ? Number(m[0]) : 0; };
  const t = baseTok(name, side, "pc");
  t.hp = t.max = boj.hp_max ?? 10;
  t.ac = boj.ac ?? 10;
  t.initB = boj.init ?? 0;
  t.speed = num(sp.walk ?? sheet.speed ?? 30);
  t.swim = num(sp.swim); t.fly = num(sp.fly); t.climb = num(sp.climb);
  t.saves = boj.zachrany || {};
  t.mods = boj.mods || {};
  t.pb = boj.pb;
  t.odolnosti = toArr(boj.odolnosti);
  t.imunity = toArr(boj.imunity);
  t.imunity_stavu = toArr(boj.imunity_stavu);
  t.zranitelnosti = toArr(sheet?.zranitelnosti);
  t.smysly = toArr(boj.smysly);
  t.velikost = boj.velikost || sheet.overview?.velikost;
  t.s = sizeCells(t.velikost);
  t.dc = typeof boj.dc_kouzel === "number" ? boj.dc_kouzel
       : boj.dc_kouzel && typeof boj.dc_kouzel === "object" ? Number(Object.values(boj.dc_kouzel)[0]) || undefined
       : undefined;
  const casting = boj.casting || sheet.casting || [];
  t.casting = Array.isArray(casting) ? casting[0] : casting;
  t.extraAtk = boj.utoky_za_akci;
  t.skills = boj.dovednosti || {};
  t.feats = boj.featy || [];
  t.features = boj.rysy || [];
  t.items = (boj.vybava || []).map((v: any) => typeof v === "string" ? { nazev: v, qty: 1 } : { nazev: v.nazev || v.predmet || "?", qty: v.pocet ?? v.qty ?? 1 });
  t.heroicInspiration = !!boj.inspirace;
  t.exhaustion = sheet?.exhaustion || 0;
  if (t.exhaustion) t.cond.push({ n: "Exhaustion", lvl: t.exhaustion });
  t.portret = portret;
  t.src = { cesta: md, id: md, edition: "2024", source: "character-engine" };
  t.slots = (boj.slots || sheet.slots || []).map((n: number) => ({ max: n, used: 0 }));
  const pact = boj.pact || sheet.pact;
  t.pact = pact ? { lvl: pact.uroven, max: pact.pocet, used: 0 } : undefined;
  t.zdroje = (boj.zdroje || []).map((z: any) => ({ nazev: z.nazev, max: z.max, used: 0, obnova: z.obnova }));
  t.atk = (boj.utoky || []).map((u: any): AttackDef => {
    const thrown = THROWN_RANGES.find(([re]) => re.test(u.nazev));
    const o: AttackDef = {
      nazev: u.nazev, kind: "weapon", bonus: u.atk, dmg: u.dmg, typ: u.typ,
      mastery: u.mastery, melee: u.melee ?? (u.reach != null ? true : u.range != null ? false : !RANGED_RE.test(u.nazev)), n: 1,
    };
    const distance = String(u.dosah || "").match(/(\d+)(?:\s*\/\s*(\d+))?/);
    if (u.melee == null && u.range == null && distance?.[2]) o.melee = false;
    if (o.melee) o.reach = u.reach ?? (distance ? Number(distance[1]) : REACH_RE.test(u.nazev) ? 10 : 5);
    if (!o.melee || u.range != null) { o.range = u.range ?? (distance ? Number(distance[1]) : 60); o.long = u.long ?? (distance?.[2] ? Number(distance[2]) : undefined); }
    if (u.thrown) o.thrown = u.thrown;
    else if (thrown && u.melee == null && u.range == null) o.thrown = thrown[1];
    return o;
  });
  // kouzla → naparsované akce
  t.lvl = sheet.uroven || sheet.level || sheet.lvl || 1;
  t.kouzla = (boj.kouzla?.length ? boj.kouzla : sheet?.kouzla || [])
    .map((k: any) => linkedSpell(k.nazev || k, spells, t, typeof k === "string" ? undefined : k,
      Array.isArray(casting) ? casting.find((c: any) => c.trida === k.trida) || t.casting : t.casting))
    .filter(Boolean) as AttackDef[];
  if (!t.atk.length && !t.kouzla.length)
    t.atk.push({ nazev: "Unarmed Strike", kind: "weapon", melee: true, reach: 5, bonus: (t.pb || 2) + (t.mods.STR || 0), dmg: "1", typ: "Bludgeoning", n: 1 });
  return t;
}

/** Token ze SRD bestiáře. */
export function fromMonster(m: MonsterEntry, side: Side = "nepratele", spells: SpellCatalog = {}): Token {
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
  t.speed = m.rychlost?.walk != null ? speedStr("walk") : speedStr("chůze");
  t.fly = speedStr("fly"); t.swim = speedStr("swim"); t.climb = speedStr("climb");
  t.burrow = speedStr("burrow");
  t.saves = parseSaves(m.zachrany);
  t.pb = Math.max(2, Math.ceil((m.cr_num ?? 0) / 4) + 1);
  t.odolnosti = toArr(m.odolnosti);
  const defenses = toArr(m.imunity);
  t.imunity_stavu = defenses.map(s => CONDITION_NAMES.find(c => c.toLowerCase() === s.toLowerCase())).filter(Boolean) as string[];
  t.imunity = defenses.filter(s => !t.imunity_stavu.some(c => c.toLowerCase() === s.toLowerCase())).map(s => DMG_TYPES.find(d => d.toLowerCase() === s.toLowerCase()) || s);
  t.zranitelnosti = toArr(m.zranitelnosti);
  t.smysly = m.smysly ? Object.keys(m.smysly).map((k) => `${k} ${(m.smysly as any)[k]} ft`) : [];
  t.atk = monsterAttacks(m);
  t.cr = m.cr; t.xp = m.xp || 0;
  t.src = { srd: m.nazev, id: `bestiar:${m.nazev}`, edition: "2024", source: m.zdroj };
  t.rysy = m.rysy;
  const multi = m.akce?.find(a => /^multiattack/i.test(a.nazev));
  if (multi) {
    const counts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    t.multiattack = { text: multi.text, attacks: [...multi.text.matchAll(/\b(one|two|three|four|five|six|\d+)\s+([A-Z][\w'’ -]*?)\s+attacks?\b/g)].map(a => ({ name: a[2], count: counts[a[1]] || Number(a[1]) })) };
    const choice = multi.text.match(/\b(one|two|three|four|five|six|\d+)\s+(?:other\s+)?attacks?, using (.*?) in any combination/i);
    if (choice) { const alternatives = choice[2].split(/,?\s+or\s+|,\s*/); t.multiattack.attacks.push({ name: alternatives.join(" / "), count: counts[choice[1].toLowerCase()] || Number(choice[1]), alternatives }); }
  }
  importMonsterSpells(m, t, spells);
  for (const a of t.atk) if (a.xd) {
    a.uses = a.nazev;
    if (!t.zdroje.some(z => z.nazev === a.uses)) t.zdroje.push({ nazev: a.uses, max: a.xd, used: 0, obnova: "long" });
  }
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

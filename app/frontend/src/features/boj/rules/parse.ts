/* Parsování akcí netvorů (bestiar 2024) a kouzel (kouzla2024) na AttackDef. */
import type { Ability, AttackDef, MonsterEntry, SpellEntry, AreaShape, DmgType } from "../types";
import { DMG_TYPES } from "../types";

const AB: Record<string, Ability> = {
  strength: "STR", dexterity: "DEX", constitution: "CON",
  intelligence: "INT", wisdom: "WIS", charisma: "CHA",
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};
const DT = new Set(DMG_TYPES.map((x) => x.toLowerCase()));
const dmgType = (s: string): DmgType | string =>
  DMG_TYPES.find((d) => d.toLowerCase() === s.toLowerCase()) || s;

/** "4 (1d6 + 1) Piercing damage" / "plus 7 (2d6) Fire damage" → dice+typ */
function parseDmgParts(text: string): { dmg?: string; typ?: string; dmg2?: string; typ2?: string; avg?: number } {
  const out: { dmg?: string; typ?: string; dmg2?: string; typ2?: string; avg?: number } = {};
  const re = /(?:plus\s+)?(\d+)\s*\(\s*([\dd+\s]+)\s*\)\s*(\w+)\s+damage|(?:(\d+)d(\d+)(?:\s*\+\s*(\d+))?)\s*(\w+)\s+damage/g;
  let m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    const dice = m[2] ? m[2].replace(/\s/g, "") : m[4] + "d" + m[5] + (m[6] ? "+" + m[6] : "");
    const ty = m[3] || m[7];
    if (i === 0) { out.dmg = dice; out.typ = dmgType(ty); out.avg = Number(m[1]) || undefined; }
    else if (i === 1) { out.dmg2 = dice; out.typ2 = dmgType(ty); }
    i++;
    if (i >= 2) break;
  }
  if (!out.dmg) {
    // "X (YdZ + N) damage" without parens variant: "8d6 Fire damage"
    const mm = text.match(/(\d+)d(\d+)\s*(\w+)\s+damage/i);
    if (mm && DT.has(mm[3].toLowerCase())) { out.dmg = `${mm[1]}d${mm[2]}`; out.typ = dmgType(mm[3]); }
  }
  return out;
}

function parseConds(text: string): AttackDef["condOnHit"] {
  const out: NonNullable<AttackDef["condOnHit"]> = [];
  const re = /(Blinded|Charmed|Deafened|Frightened|Grappled|Incapacitated|Invisible|Paralyzed|Petrified|Poisoned|Prone|Restrained|Stunned|Unconscious)\s+condition/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    const tail = text.slice(m.index, m.index + 80);
    const dc = tail.match(/escape DC\s*(\d+)|DC\s*(\d+)/i);
    out.push({ n, dc: dc ? Number(dc[1] || dc[2]) : undefined });
  }
  return out.length ? out : undefined;
}

export function parseMonsterAction(nazev: string, text: string, kind: "action" | "bonus" | "reaction" | "legendary" = "action"): AttackDef {
  const o: AttackDef = { nazev, kind: "feature", text, n: 1 };
  if (kind === "bonus") o.ba = true;
  if (kind === "reaction") o.rea = true;
  const rc = nazev.match(/Recharge\s*(\d+)/i) || text.match(/\(Recharge\s*(\d+)[–-]6\)/i);
  if (rc) { o.rc = Number(rc[1]); }
  const xd = nazev.match(/(\d+)\/Day/i) || text.match(/\((\d+)\/Day\)/i);
  if (xd) o.xd = Number(xd[1]);
  const parts = parseDmgParts(text);
  Object.assign(o, parts);

  // attack roll
  const atk = text.match(/(Melee|Ranged|Melee or Ranged)\s+(?:Weapon\s+|Spell\s+)?Attack\s+Roll?:\s*([+\-−]\d+)/i)
    || text.match(/Melee\s+Attack:\s*([+\-−]\d+)/i);
  const sv = text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+Saving\s+Throw:\s*DC\s*(\d+)/i)
    || text.match(/DC\s*(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(?:saving throw|save)/i);
  if (atk) {
    const melee = /melee/i.test(atk[1]), ranged = /ranged/i.test(atk[1]);
    o.bonus = Number(atk[2].replace("−", "-"));
    const reach = text.match(/reach\s*(\d+)\s*ft/i);
    const range = text.match(/range\s*(\d+)(?:\s*\/\s*(\d+))?\s*ft/i);
    if (melee && !range) { o.melee = true; o.reach = reach ? Number(reach[1]) : 5; }
    else if (range) {
      o.range = Number(range[1]); o.long = range[2] ? Number(range[2]) : o.range;
      if (melee) { o.melee = true; o.reach = reach ? Number(reach[1]) : 5; o.thrown = [o.range, o.long]; }
    } else if (ranged) { o.range = 60; }
    else { o.melee = true; o.reach = reach ? Number(reach[1]) : 5; }
  } else if (sv) {
    if (sv[1].match(/^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)$/i)) {
      o.save = AB[sv[1].toLowerCase()]; o.dc = Number(sv[2]);
    } else { o.save = AB[sv[2].toLowerCase()]; o.dc = Number(sv[1]); }
    o.half = /half as much damage|half damage/i.test(text);
    const area = text.match(/(\d+)-foot(?:-radius)?(?:[- ](?:long|wide))?,?\s*(?:\d+-foot[- ](?:long|wide)[-, ]*)?(Cone|Sphere|Cube|Line|Emanation|Cylinder)/i)
      || text.match(/(?:in a|a)\s*(\d+)-foot\s*(Cone|Sphere|Cube|Line|Emanation|Cylinder)/i);
    if (area) o.area = { shape: area[2].toLowerCase() as AreaShape, size: Number(area[1]) };
    const r = text.match(/within\s*(\d+)\s*feet|range\s*(\d+)\s*ft/i);
    o.range = r ? Number(r[1] || r[2]) : (o.area ? 0 : 30);
    if (!o.range) o.self = true;
    o.n = 1;
  }
  const conds = parseConds(text);
  if (conds) o.condOnHit = conds;
  return o;
}

/** Multiattack: "The X makes three attacks" → násobek na akcích. */
export function parseMultiattack(text: string): number {
  const m = text.match(/makes?\s+(one|two|three|four|five|six|\d+)\s+(?:melee\s+|ranged\s+)?attacks/i);
  if (!m) return 0;
  const w = m[1].toLowerCase();
  return { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[w as "one"] ?? Number(m[1]) ?? 0;
}

/** Všechny akce netvora → AttackDef[]. */
export function monsterAttacks(m: MonsterEntry): AttackDef[] {
  const out: AttackDef[] = [];
  let multi = 0;
  for (const a of m.akce || []) {
    if (/^multiattack/i.test(a.nazev)) { multi = parseMultiattack(a.text) || multi; continue; }
    const o = parseMonsterAction(a.nazev, a.text, "action");
    if (multi > 1 && !o.save && o.bonus != null) o.n = multi;
    out.push(o);
  }
  for (const a of m.bonusove_akce || []) out.push(parseMonsterAction(a.nazev, a.text, "bonus"));
  for (const a of m.reakce || []) out.push(parseMonsterAction(a.nazev, a.text, "reaction"));
  for (const a of m.legendarni || m.legendary || []) {
    const o = parseMonsterAction(a.nazev, a.text, "legendary");
    o.rea = true;
    const cost = a.nazev.match(/\(Costs?\s*(\d+)\s*Actions?\)/i);
    if (cost) o.pozn = `${cost[1]} legendary actions`;
    out.push(o);
  }
  return out;
}

const RNDS: Record<string, number> = {
  "1 round": 1, "10 minutes": 100, "1 minute": 10, "1 hour": 600, "8 hours": 4800,
  "instantaneous": 0, "until dispelled": 0,
};

export function spellDurationRounds(trvani: string): number | undefined {
  const t = (trvani || "").toLowerCase();
  if (/concentration,?\s*up to\s*(\d+)\s*(minute|hour|round)/.test(t)) {
    const mm = t.match(/up to\s*(\d+)\s*(minute|hour|round)/)!;
    const n = Number(mm[1]);
    return mm[2].startsWith("round") ? n : mm[2].startsWith("hour") ? n * 600 : n * 10;
  }
  const m = t.match(/(\d+)\s*(round|minute|hour)/);
  if (m) return m[2].startsWith("round") ? Number(m[1]) : m[2].startsWith("hour") ? Number(m[1]) * 600 : Number(m[1]) * 10;
  return RNDS[t];
}

/** Kouzlo + kouzelnický kontext postavy → AttackDef (nebo null, když nelze použít v boji). */
export function parseSpell(name: string, K: Record<string, SpellEntry>, ctx: {
  dc: number; atk: number; smod: number; lvl: number;
}): AttackDef | null {
  const k = K[name] || K[Object.keys(K).find((n) => n.toLowerCase() === name.toLowerCase()) || ""];
  if (!k?.text || /stat block/i.test(k.text)) return null;
  const txt = k.text;
  const first = txt.split(/\n(?:Using a Higher-Level Spell Slot|At Higher Levels)/)[0];
  const lvl0 = Number(k.uroven) || 0;
  const base: Partial<AttackDef> = {
    nazev: name + (lvl0 ? ` (${lvl0}. úr.)` : ""), kouzlo: name, kind: "spell", lvl: lvl0,
    conc: /Concentration/i.test(k.trvani || ""),
    ba: /Bonus Action/i.test(k.cas || ""), rea: /Reaction/i.test(k.cas || ""),
    ritual: /Ritual/i.test(k.cas || "") || !!(k as any).obradnik,
    text: txt, durationRounds: spellDurationRounds(k.trvani),
  };
  const hm = first.match(/regains?\s+(\d+)?d(\d+)(\s*\+\s*(\d+|your spellcasting ability modifier))?[^.]*hit points/i);
  if (hm) {
    const up = txt.match(/healing increases? by\s+(\d+d\d+)/i);
    return { ...base, heal: { dice: `${hm[1] || 1}d${hm[2]}`, flat: /modifier/i.test(hm[4] || "") ? 0 : Number(hm[4]) || 0, plusMod: /modifier/i.test(hm[4] || "") },
             upcast: up ? { dice: up[1] } : undefined } as AttackDef;
  }
  const dm = first.match(/(\d+)d(\d+)(?:\s*\+\s*(?:your spellcasting ability modifier|\d+))?\s*(\w+)\s*damage/i);
  const svName = first.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i);
  const isAtk = /(?:spell|melee spell|ranged spell) attack|spell attack roll|make an? (?:ranged )?attack roll/i.test(first);
  if (!dm && !svName) return { ...base, utility: true } as AttackDef; // utility — zobrazit v panelu
  let n = dm ? Number(dm[1]) : 0;
  const f = dm ? Number(dm[2]) : 0;
  const lvl = Number(k.uroven) || 0;
  if (lvl === 0 && /Cantrip Upgrade/i.test(txt)) {
    // škálování cantripu podle úrovně postavy
    const base = n;
    n = ctx.lvl >= 17 ? base * 4 : ctx.lvl >= 11 ? base * 3 : ctx.lvl >= 5 ? base * 2 : base;
  }
  const plusMod = /\+\s*your spellcasting ability modifier/i.test(dm?.[0] || "");
  const dmg = dm ? `${n}d${f}${plusMod ? (ctx.smod >= 0 ? "+" : "") + ctx.smod : ""}` : undefined;
  const o: AttackDef = {
    nazev: name + (lvl ? ` (${lvl}. úr.)` : ""), kouzlo: name, kind: "spell", lvl,
    dmg, typ: dm ? dmgType(dm[3]) : undefined, n: 1,
    conc: /Concentration/i.test(k.trvani || ""),
    ba: /Bonus Action/i.test(k.cas || ""),
    rea: /Reaction/i.test(k.cas || ""),
    durationRounds: spellDurationRounds(k.trvani),
    text: txt,
  };
  const dos = String(k.dosah || "");
  const area = (dos + " " + first).match(/(\d+)-foot(?:-radius)?(?:[- ]long)?,?\s*(?:\d+-foot-wide\s*)?(Cone|Sphere|Cube|Line|Emanation|Cylinder)/i);
  if (area) o.area = { shape: area[2].toLowerCase() as AreaShape, size: Number(area[1]) };
  o.range = /touch/i.test(dos) ? 5 : (Number((dos.match(/(\d+)\s*feet/) || [])[1]) || (/self/i.test(dos) ? 0 : 60));
  if (!o.range && area) o.self = true;
  if (svName) {
    o.save = AB[svName[1].toLowerCase()]; o.dc = ctx.dc;
    o.half = /half as much damage|half damage/i.test(first);
    // upcast dice "increases by 1d6 for each slot level above 3"
    const up = txt.match(/increases by\s*(\d+d\d+)\s*for each (?:spell )?slot level above\s*(\d+)/i);
    if (up && dmg) o.pozn = `+${up[1]}/slot >${up[2]}`;
  } else if (isAtk || dm) {
    o.bonus = ctx.atk;
    if (o.range <= 5) { o.melee = true; o.reach = 5; }
  }
  const conds = parseConds(first);
  if (conds) o.condOnHit = conds;
  return o;
}

/** Hlavní řádek Multiattacku "The Guardian Naga can use its X" — nepotřebujeme. */
export const isSummonSpell = (k?: SpellEntry | null): boolean =>
  !!k?.text && /stat block/i.test(k.text) && /\n\s*\|/.test(k.text);

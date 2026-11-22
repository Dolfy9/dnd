/* Aplikace poškození a léčení: immunities/resistances/vulnerabilities, temp HP,
   0 HP (PC → Unconscious + death saves; massive damage), concentration check. */
import type { Token } from "../types";
import { hasCond } from "./conditions";
import { sumMods } from "./effects";

export interface DmgPart { amount: number; type: string }

export interface DamageResult {
  applied: number;               // celkové poškození po modifikacích (před tmp)
  parts: { type: string; in: number; out: number; mod: string }[];
  hpLost: number;
  tmpUsed: number;
  hp: number;
  tmp: number;
  downed: boolean;               // klesl na 0
  died: boolean;
  massiveDeath: boolean;
  concDc?: number;               // DC concentration save (pokud má conc)
  messages: string[];
}

const normType = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const hasIn = (list: string[] | undefined, t: string) =>
  !!list?.some((x) => x.toLowerCase() === t.toLowerCase() || x.toLowerCase() === "all" || x.toLowerCase() === "vše");

function modFor(t: Token, type: string, ignore: string[] = []): { mult: number; why: string } {
  const ty = normType(type);
  const em = sumMods(t);
  if (em.dmgImun === "all" || (Array.isArray(em.dmgImun) && em.dmgImun.map(String).map((x) => x.toLowerCase()).includes(ty.toLowerCase())))
    return { mult: 0, why: `Immune (${ty})` };
  if (hasIn(t.imunity, ty)) return { mult: 0, why: `Immune (${ty})` };
  if (hasCond(t, "Petrified") || em.dmgResist === "all") return { mult: 0.5, why: "Resist all (Petrified/efekt)" };
  if (Array.isArray(em.dmgResist) && em.dmgResist.map((x) => x.toLowerCase()).includes(ty.toLowerCase()) && !ignore.includes(ty))
    return { mult: 0.5, why: `Resistant (${ty})` };
  if (hasIn(t.odolnosti, ty) && !ignore.includes(ty)) return { mult: 0.5, why: `Resistant (${ty})` };
  if (hasIn(t.zranitelnosti, ty) || (Array.isArray(em.dmgVuln) && em.dmgVuln.map((x) => x.toLowerCase()).includes(ty.toLowerCase())))
    return { mult: 2, why: `Vulnerable (${ty})` };
  return { mult: 1, why: "" };
}

export function applyDamage(t: Token, parts: DmgPart[], opts: { nonlethal?: boolean; crit?: boolean; ignoreResist?: string[] } = {}): DamageResult {
  const messages: string[] = [];
  const outParts: DamageResult["parts"] = [];
  let total = 0;
  for (const p of parts) {
    const m = modFor(t, p.type, opts.ignoreResist || []);
    const out = Math.floor(p.amount * m.mult);
    outParts.push({ type: p.type, in: p.amount, out, mod: m.why });
    if (m.why) messages.push(m.why);
    total += out;
  }
  let tmpUsed = 0, hpLost = 0;
  let rest = total;
  if (rest > 0 && t.tmp > 0) { tmpUsed = Math.min(t.tmp, rest); t.tmp -= tmpUsed; rest -= tmpUsed; }
  const hpBefore = t.hp;
  const wasDown = t.hp <= 0;
  if (rest > 0) {
    hpLost = Math.min(t.hp, rest);
    t.hp = Math.max(0, t.hp - rest);
  }
  const leftover = rest - hpLost;
  let downed = false, died = false, massiveDeath = false;
  if (t.hp <= 0 && !wasDown) {
    downed = true;
    if (leftover >= t.max) {
      massiveDeath = true; died = true; t.dead = true;
      messages.push(`${t.nazev}: okamžitá smrt (massive damage)`);
    } else if (t.kind === "pc" || opts.nonlethal) {
      t.dying = true;
      t.ds = { s: 0, f: 0 };
      if (opts.nonlethal) messages.push(`${t.nazev}: knocked out (non-lethal)`);
      else if (!hasCond(t, "Unconscious")) t.cond.push({ n: "Unconscious" });
      messages.push(`${t.nazev} padá na 0 HP — Unconscious, death saves`);
    } else {
      died = true; t.dead = true;
    }
  } else if (wasDown && rest > 0 && t.dying) {
    // damage na 0 HP = failed death save (crit = 2)
    const fails = opts.crit ? 2 : 1;
    t.ds.f = Math.min(3, t.ds.f + fails);
    messages.push(`${t.nazev}: zásah na 0 HP → ${fails}× failed death save`);
    if (t.ds.f >= 3) { died = true; t.dead = true; messages.push(`☠ ${t.nazev} umírá`); }
  }
  // Concentration
  let concDc: number | undefined;
  if (t.conc && total > 0 && !t.dead) {
    concDc = Math.min(30, Math.max(10, Math.floor(total / 2)));
  }
  if (t.dead) t.dying = false;
  void hpBefore;
  return { applied: total, parts: outParts, hpLost, tmpUsed, hp: t.hp, tmp: t.tmp, downed, died, massiveDeath, concDc, messages };
}

export interface HealResult { healed: number; revived: boolean; hp: number; messages: string[] }

export function applyHealing(t: Token, amount: number): HealResult {
  const messages: string[] = [];
  const wasDown = t.hp <= 0;
  const healed = Math.min(t.max - t.hp, amount);
  t.hp += healed;
  let revived = false;
  if (wasDown && t.hp > 0) {
    revived = true;
    t.dying = false; t.dead = false;
    t.ds = { s: 0, f: 0 };
    t.cond = (t.cond || []).filter((c) => c.n !== "Unconscious");
    messages.push(`${t.nazev} se vrací k při vědomí`);
  }
  return { healed, revived, hp: t.hp, messages };
}

/** Temporary HP: nestackují se — bere se vyšší hodnota. */
export function setTempHp(t: Token, v: number): number {
  const n = Math.max(0, v);
  t.tmp = Math.max(t.tmp, n);
  return t.tmp;
}

/** Death save roll; nat20 → 1 HP, nat1 → 2 fails. */
export function deathSave(t: Token, roll: number): { text: string; stabilized?: boolean; died?: boolean; revived?: boolean } {
  t.ds = t.ds || { s: 0, f: 0 };
  if (roll === 20) {
    t.hp = 1; t.dying = false; t.ds = { s: 0, f: 0 };
    t.cond = (t.cond || []).filter((c) => c.n !== "Unconscious");
    return { text: `${t.nazev}: death save 20 → 1 HP!`, revived: true };
  }
  if (roll === 1) t.ds.f += 2;
  else if (roll >= 10) t.ds.s += 1;
  else t.ds.f += 1;
  if (t.ds.f >= 3) { t.dead = true; t.dying = false; return { text: `☠ ${t.nazev} umírá (3× fail)`, died: true }; }
  if (t.ds.s >= 3) {
    // stabilizace: zůstává na 0 HP, Unconscious dokud nedostane healing (2024)
    t.ds = { s: 0, f: 0 };
    t.dying = false;
    return { text: `${t.nazev} je stabilizovaný (0 HP)`, stabilized: true };
  }
  return { text: `${t.nazev}: death save ${roll >= 10 ? "✓" : "✗"} (${roll})` };
}

/** Náhled damage bez mutace žetonu (pro potvrzovací krok DM). */
export function previewDamage(t: Token, parts: DmgPart[], opts: { crit?: boolean } = {}): { applied: number; mods: string[] } {
  const c: Token = JSON.parse(JSON.stringify(t));
  const r = applyDamage(c, parts, opts);
  return { applied: r.applied, mods: r.parts.map((p) => p.mod).filter((m): m is string => !!m) };
}

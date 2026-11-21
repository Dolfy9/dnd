/* Čistá pravidla 2024 pro akce: grapple/shove/escape, hide/search,
   movement akce (stand, jump, crawl, fall), TWF, reaction pomocníci. */
import type { Token } from "../../types";
import { hasCond } from "../conditions";
import type { Rng } from "../dice";
import { d20, rollDice } from "../dice";

/* ---------- Grapple / Shove (Unarmed Strike options, 2024) ---------- */
export const grappleDc = (A: Token): number => 8 + (A.mods.STR ?? 0) + (A.pb ?? 2);
/** 2024: cíl může být max o jednu kategorii větší. s = buňky (1=Medium). */
export const grappleSizeOk = (A: Token, B: Token): boolean => (B.s ?? 1) <= (A.s ?? 1) + 1;
export const grappleSaveBonus = (B: Token): number =>
  Math.max(B.saves?.STR ?? -99, B.saves?.DEX ?? -99, B.mods.STR ?? 0, B.mods.DEX ?? 0);
export interface CheckRes { ok: boolean; roll: number; total: number; dc: number }
export const grappleResolve = (A: Token, B: Token, rng: Rng): CheckRes | null => {
  if (!grappleSizeOk(A, B)) return null;
  const dc = grappleDc(A), bonus = grappleSaveBonus(B), r = d20(0, rng);
  return { ok: r.r + bonus < dc, roll: r.r, total: r.r + bonus, dc };
};
export const escapeDc = grappleDc;
export const escapeResolve = (B: Token, A: Token, rng: Rng): CheckRes => {
  const dc = escapeDc(A);
  const bonus = Math.max(B.skills?.["Athletics"] ?? B.mods.STR ?? 0, B.skills?.["Acrobatics"] ?? B.mods.DEX ?? 0);
  const r = d20(0, rng);
  return { ok: r.r + bonus >= dc, roll: r.r, total: r.r + bonus, dc };
};

/* ---------- Hide / Search ---------- */
export const HIDE_DC = 15;
export const hideResolve = (t: Token, rng: Rng): { ok: boolean; roll: number; total: number } => {
  const bonus = t.skills?.["Stealth"] ?? t.mods.DEX ?? 0;
  const r = d20(0, rng);
  return { ok: r.r + bonus >= HIDE_DC, roll: r.r, total: r.r + bonus };
};
/** Search: Perception nebo Investigation (vyšší) vs Stealth výsledek skrytého. */
export const searchResolve = (seeker: Token, stealthTotal: number, rng: Rng): CheckRes => {
  const bonus = Math.max(seeker.skills?.["Perception"] ?? -99, seeker.skills?.["Investigation"] ?? -99,
                         seeker.mods.WIS ?? 0, seeker.mods.INT ?? 0);
  const r = d20(0, rng);
  return { ok: r.r + bonus >= stealthTotal, roll: r.r, total: r.r + bonus, dc: stealthTotal };
};

/* ---------- Pohyb ---------- */
/** Stand up z Prone stojí polovinu speed (2024). */
export const standUpCost = (t: Token): number => Math.ceil((t.speed ?? 30) / 2);
export const dropProneCost = 0;
/** Crawl za Prone = ×2 cena kroku. */
export const crawlMult = (t: Token): number => (hasCond(t, "Prone") ? 2 : 1);
/** Climb/Swim ×2 pro bytosti bez příslušné speed. */
export const climbSwimMult = (t: Token, kind: "climb" | "swim"): number =>
  (kind === "climb" ? t.climb : t.swim) > 0 ? 1 : 2;
/** Long Jump: STR skóre ft s 10ft rozběhem, jinak polovina. */
export const longJumpFt = (t: Token, runningStart: boolean): number => {
  const score = 10 + 2 * (t.mods.STR ?? 0);
  return runningStart ? score : Math.floor(score / 2);
};
/** High Jump: 3 + STR mod ft s rozběhem, jinak stojící = polovina (min 0). */
export const highJumpFt = (t: Token, runningStart: boolean): number => {
  const v = 3 + (t.mods.STR ?? 0);
  return runningStart ? Math.max(0, v) : Math.max(0, Math.floor(v / 2));
};
/** Pád: 1d6 za každých 10 ft, max 20d6; přistání Prone. */
export const fallingDice = (ft: number): string => `${Math.min(20, Math.floor(ft / 10))}d6`;
export const fallingDamage = (ft: number, rng: Rng): number =>
  ft < 10 ? 0 : rollDice(fallingDice(ft), { rng }).total;

/* ---------- Two-Weapon Fighting (2024) ---------- */
/** BA útok off-handem: bez pozitivního modifikátoru, pokud nemá styl Two-Weapon Fighting. */
export const twfDamageMod = (t: Token): number =>
  t.feats?.some((f) => /two-weapon fighting/i.test(f)) || t.features?.some((f) => /two-weapon fighting/i.test(f.nazev))
    ? Math.max(0, t.mods.STR ?? 0) : 0;

/* ---------- Reakce (pomocníci pro prompt layer) ---------- */
/** Shield: +5 AC do začátku příštího tahu → hit se může stát miss. */
export const shieldTurnsMiss = (hitTotal: number, ac: number): boolean => hitTotal < ac + 5;
export const SHIELD_AC = 5;
export const hasReactionAvailable = (t: Token, spentR: boolean): boolean => !spentR;

/* ---------- Healing spell parser ---------- */
/** "regains 2d8+mod Hit Points" → kostky; upcast +Xkostek za úroveň. */
export function parseHealing(text: string, lvl: number, smod: number): { dice: string; flat: number } | null {
  const m = /regains?\s+(\d+)?d(\d+)(?:\s*\+\s*(\d+))?\s*(?:\+\s*[^ ]*modifier)?[^.]*hit points/i.exec(text || "");
  if (!m) return null;
  const n = Number(m[1] || 1), die = Number(m[2]), flat = Number(m[3] ?? smod);
  return { dice: `${n}d${die}`, flat };
}
/** Upcast healing: běžný vzor "+1d8 za slot level nad base" (Cure Wounds/Healing Word). */
export const upcastHeal = (base: { dice: string; flat: number }, baseLvl: number, slot: number): { dice: string; flat: number } => {
  const m = /(\d+)d(\d+)/.exec(base.dice); if (!m) return base;
  const extra = Math.max(0, slot - baseLvl);
  return { dice: `${Number(m[1]) + extra}d${m[2]}`, flat: base.flat };
};

/* ---------- Klasifikace kouzel ---------- */
export type SpellKind = "preset" | "healing" | "attack" | "utility";
export function classifySpell(sp: { nazev: string; text?: string; cas?: string }, presetNames: Set<string>): SpellKind {
  if (presetNames.has(sp.nazev)) return "preset";
  const tx = sp.text || "";
  if (/regains?\s+\d*d\d+[^.]*hit points/i.test(tx)) return "healing";
  if (/make a (ranged|melee) spell attack|spell attack roll/i.test(tx) || /saving throw/i.test(tx) && /d\d+.*damage/i.test(tx)) return "attack";
  return "utility";
}

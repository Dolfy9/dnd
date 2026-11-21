/* Class features a featy 2024 — detekce z t.features/t.feats + resource (zdroje). */
import type { Token, AttackDef, Ability } from "../../types";
import { rollDice, type Rng } from "../dice";
import { uid } from "../../types";

const hasFeat = (t: Token, re: RegExp) => (t.feats || []).some((f) => re.test(f));
export const hasFeature = (t: Token, re: RegExp) =>
  hasFeat(t, re) || (t.features || []).some((f) => re.test(f.nazev));
export const findZdroj = (t: Token, re: RegExp) => (t.zdroje || []).find((z) => re.test(z.nazev));
export const spendZdroj = (t: Token, re: RegExp, n = 1): boolean => {
  const z = findZdroj(t, re); if (!z || z.max - z.used < n) return false; z.used += n; return true;
};
export const leftZdroj = (t: Token, re: RegExp): number => { const z = findZdroj(t, re); return z ? z.max - z.used : 0; };

/* ---- Bardic Inspiration ---- */
export const bardicDie = (t: Token): string => {
  const l = t.lvl || 1; return l >= 15 ? "d12" : l >= 10 ? "d10" : l >= 5 ? "d8" : "d6";
};
export const hasBardic = (t: Token) => hasFeature(t, /bardic inspiration/i);
/** Přidej Bardic die efekt spojenci; vrátí hod kostky nebo null (bez zdroje). */
export function giveBardic(bard: Token, ally: Token): string | null {
  const die = bardicDie(bard);
  if (findZdroj(bard, /bardic|inspiration/i) && !spendZdroj(bard, /bardic|inspiration/i)) return null;
  ally.effects.push({ id: uid(), nazev: `Bardic Inspiration (${die})`, mods: { bardic: die } as any, duration: { kind: "rounds", rounds: 10 }, src: bard.id });
  return die;
}
/** Spotřebuje Bardic die při hodu (vrátí hodnotu kostky nebo 0). */
export function consumeBardic(t: Token, rng: Rng): number {
  const e = t.effects.find((x) => (x.mods as any).bardic); if (!e) return 0;
  t.effects = t.effects.filter((x) => x !== e);
  return rollDice(`1${(e.mods as any).bardic}`, { rng }).total;
}

/* ---- Channel Divinity ---- */
export const hasChannel = (t: Token) => hasFeature(t, /channel divinity|divine spark|turn undead/i) || findZdroj(t, /channel/i) != null;
export const divineSparkAmount = (t: Token): string => `1d8+${t.mods.WIS ?? 0}`; // 2024: d8 + WIS
export function turnUndeadSave(undead: Token, dc: number, rng: Rng): { ok: boolean; roll: number; total: number } {
  const r = rollDice("1d20", { rng }).total; const total = r + (undead.saves?.WIS ?? undead.mods.WIS ?? 0);
  return { ok: total >= dc, roll: r, total };
}
export const applyTurned = (undead: Token): void => {
  if (!undead.cond.some((c) => c.n === "Frightened")) undead.cond.push({ n: "Frightened" });
  if (!undead.cond.some((c) => c.n === "Incapacitated")) undead.cond.push({ n: "Incapacitated" });
};

/* ---- Wild Shape ---- */
export const hasWildShape = (t: Token) => hasFeature(t, /wild shape/i);
export const wildShapeTemp = (t: Token): number => t.lvl || 1; // 2024: temp HP = druid level

/* ---- Monk Focus Points ---- */
export const hasFocus = (t: Token) => findZdroj(t, /focus|ki /i) != null || hasFeature(t, /flurry of blows|patient defense|step of the wind/i);
export const flurryAttacks = (t: Token): AttackDef[] => [
  { nazev: "Flurry: Unarmed 1", kind: "weapon", melee: true, reach: 5, bonus: (t.pb ?? 2) + (t.mods.DEX ?? t.mods.STR ?? 0), dmg: `1d${t.lvl && t.lvl >= 11 ? 10 : t.lvl && t.lvl >= 5 ? 8 : 6}+${t.mods.DEX ?? 0}`, typ: "Bludgeoning", n: 1 },
  { nazev: "Flurry: Unarmed 2", kind: "weapon", melee: true, reach: 5, bonus: (t.pb ?? 2) + (t.mods.DEX ?? t.mods.STR ?? 0), dmg: `1d${t.lvl && t.lvl >= 11 ? 10 : t.lvl && t.lvl >= 5 ? 8 : 6}+${t.mods.DEX ?? 0}`, typ: "Bludgeoning", n: 1 },
];

/* ---- Rogue / Barbarian / feats ---- */
export const hasCunning = (t: Token) => hasFeature(t, /cunning action/i);
export const recklessMods = () => ({ atkAdvStr: true, atkAdvBy: true });
export const hasReckless = (t: Token) => hasFeature(t, /reckless attack/i);
/** GWM: +PB damage jednou za tah s Heavy zbraní (část Attack akce). */
export const hasGWM = (t: Token) => hasFeat(t, /great weapon master/i);
export const gwmBonus = (t: Token, atk: AttackDef): number =>
  hasGWM(t) && !atk.kouzlo && atk.melee ? (t.pb ?? 2) : 0; // volající řeší once-per-turn flag
/** Sharpshooter: ignoruje half/¾ cover + žádný Dis na long range/melee kontakt. */
export const hasSharpshooter = (t: Token) => hasFeat(t, /sharpshooter/i);
export const sharpshooterCover = (t: Token, cover: number): number =>
  hasSharpshooter(t) && cover < 9 ? 0 : cover;
/** Savage Attacker: weapon dmg házíš dvakrát za tah, vezmeš vyšší. */
export const hasSavage = (t: Token) => hasFeat(t, /savage attacker/i);
export const savagePick = (a: number, b: number): number => Math.max(a, b);
/** Alert: +PB k iniciativě. */
export const alertInit = (t: Token): number => hasFeat(t, /alert/i) ? (t.pb ?? 2) : 0;
/** Lucky: Luck points = PB/den; přidej Adv vlastnímu hodu nebo Dis útoku proti tobě. */
export const luckyLeft = (t: Token): number => leftZdroj(t, /lucky|luck/i) || (hasFeat(t, /^lucky$/i) ? (t.pb ?? 2) : 0);
export const hasLucky = (t: Token) => hasFeat(t, /^lucky$/i) || findZdroj(t, /lucky|luck/i) != null;
/** Elemental Adept: ignoruje resistenci na zvolený typ; 1 na kostce se počítá jako 2. */
export const elementalAdeptFor = (t: Token, type: string): boolean =>
  (t.feats || []).some((f) => /elemental adept/i.test(f) && new RegExp(type, "i").test(f));
export const eaFixDie = (t: Token, type: string, rolled: number): number =>
  elementalAdeptFor(t, type) && rolled === 1 ? 2 : rolled;
/** Heroic Inspiration: přehod jeden d20. */
export const consumeInspiration = (t: Token): boolean => {
  if (!t.heroicInspiration) return false; t.heroicInspiration = false; return true;
};

/* ---- Metamagic (Sorcerer) ---- */
export const METAMAGIC: { id: string; nazev: string; cost: (lvl: number) => number; desc: string }[] = [
  { id: "quickened", nazev: "Quickened Spell", cost: () => 2, desc: "Sesli jako Bonus Action (2 SP)." },
  { id: "twinned", nazev: "Twinned Spell", cost: (l) => Math.max(1, l), desc: "Druhý cíl (SP = úroveň kouzla)." },
  { id: "careful", nazev: "Careful Spell", cost: () => 1, desc: "Vybraní auto-save (1 SP)." },
  { id: "distant", nazev: "Distant Spell", cost: () => 1, desc: "Dvojitý dostřel (1 SP)." },
  { id: "empowered", nazev: "Empowered Spell", cost: () => 1, desc: "Přehoď až CHA mod damage kostek (1 SP)." },
  { id: "extended", nazev: "Extended Spell", cost: () => 1, desc: "Dvojité trvání (1 SP)." },
  { id: "heightened", nazev: "Heightened Spell", cost: () => 2, desc: "Dis na první save (2 SP)." },
  { id: "subtle", nazev: "Subtle Spell", cost: () => 1, desc: "Bez V/S složek (1 SP)." },
];
export const isSorcerer = (t: Token) => findZdroj(t, /sorcery/i) != null || hasFeature(t, /metamagic|sorcery/i);
export const metaCost = (ids: string[], spellLvl: number): number =>
  ids.reduce((s, id) => s + (METAMAGIC.find((m) => m.id === id)?.cost(spellLvl) || 0), 0);
export const spendSP = (t: Token, n: number): boolean => spendZdroj(t, /sorcery/i, n);

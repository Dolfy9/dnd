/* Záchranné hody: bonus, adv/dis, autofail STR/DEX, cover na DEX vs oblasti,
   Legendary Resistance, half on success. */
import type { Ability, Token } from "../types";
import { CONDITIONS, exhaustion, hasCond } from "./conditions";
import { sumMods } from "./effects";
import { type Cover } from "./los";
import { d20, rollDice, type Rng, defaultRng } from "./dice";

export interface SaveEval {
  bonus: number;
  autoFail: boolean;
  adv: string[];
  dis: string[];
  net: number;
  pf: number;                      // pravděpodobnost selhání
  notes: string[];
}

export function evalSave(t: Token, ab: Ability, dc: number, opts: { cover?: Cover; vsArea?: boolean; overrideAdv?: number | null; forceDis?: boolean } = {}): SaveEval {
  const notes: string[] = [];
  const em = sumMods(t);
  let bonus = t.saves?.[ab] ?? (t.mods?.[ab] ?? 0);
  const ex = exhaustion(t) * 2;
  bonus -= ex;
  if (ex) notes.push(`Exhaustion −${ex}`);
  const adv: string[] = [], dis: string[] = [];
  const autoFail = (ab === "STR" || ab === "DEX") &&
    ["Paralyzed", "Stunned", "Unconscious", "Petrified"].some((n) => hasCond(t, n));
  if (autoFail) notes.push("automatický neúspěch (stav)");
  if (em.dodge || em.saveAdvAll) adv.push("Dodge");
  if (em.saveAdvAb?.includes(ab)) adv.push("efekt");
  if (em.saveDisAb?.includes(ab)) dis.push("efekt");
  if (ab === "DEX" && hasCond(t, "Restrained")) dis.push("Restrained");
  if (ab === "DEX" && opts.cover && opts.vsArea !== false) {
    if (opts.cover === 2) { bonus += 2; notes.push("Half Cover +2 na DEX"); }
    if (opts.cover === 3) { bonus += 5; notes.push("3/4 Cover +5 na DEX"); }
  }
  let net = adv.length && dis.length ? 0 : adv.length ? 1 : dis.length ? -1 : 0;
  if (opts.overrideAdv != null) net = opts.overrideAdv;
  const pf = autoFail ? 1 : net > 0
    ? 1 - Math.pow(1 - Math.min(1, Math.max(0, (dc - bonus - 1) / 20)), 2)
    : net < 0
      ? Math.pow(Math.min(1, Math.max(0, (dc - bonus - 1) / 20)), 2)
      : Math.min(1, Math.max(0, (dc - bonus - 1) / 20));
  return { bonus, autoFail, adv, dis, net, pf, notes };
}

export interface SaveResult extends SaveEval {
  rolls: number[];
  rolled: number;
  total: number;
  success: boolean;
  legendaryUsed?: boolean;
}

export function resolveSave(t: Token, ab: Ability, dc: number, opts: { cover?: Cover; rng?: Rng; manualRoll?: number; useLegendary?: boolean; forceDis?: boolean } = {}): SaveResult {
  const ev = evalSave(t, ab, dc, opts);
  if (opts.forceDis) ev.net = -5;
  const rng = opts.rng || defaultRng;
  const em = sumMods(t);
  const roll = opts.manualRoll != null ? { r: opts.manualRoll, rolls: [opts.manualRoll] } : d20(ev.net, rng);
  let diceBonus = 0;
  const diceParts: number[] = [];
  if (em.saveDice) {
    const rr = rollDice(em.saveDice, { rng });
    diceBonus = rr.total;
    diceParts.push(...rr.parts);
  }
  const total = ev.autoFail ? 0 : roll.r + ev.bonus + diceBonus;
  let success = !ev.autoFail && total >= dc;
  let legendaryUsed = false;
  if (!success && opts.useLegendary && t.legendary?.resist && t.legendary.resist.used < t.legendary.resist.max) {
    t.legendary.resist.used += 1;
    success = true;
    legendaryUsed = true;
  }
  return { ...ev, rolls: roll.rolls.concat(diceParts), rolled: roll.r, total, success, legendaryUsed };
}

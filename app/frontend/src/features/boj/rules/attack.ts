/* Vyhodnocení a řešení útoku (attack roll) podle pravidel 2024. */
import type { AttackDef, BattleMapData, StavBoje, Token } from "../types";
import { clamp } from "../types";
import { CONDITIONS, exhaustion, hasCond, isIncap, isProne } from "./conditions";
import { effectiveAc, sumMods } from "./effects";
import { gapFt, hostile } from "./grid";
import { coverOf, COVER_BONUS, COVER_TEXT, type Cover } from "./los";
import { canSeeTarget } from "./lighting";
import { d20, rollDice, diceOnlyAvg, type Rng, defaultRng } from "./dice";

export interface AttackCtx {
  attacker: Token;
  target: Token;
  atk: AttackDef;
  map: BattleMapData;
  tokens: Token[];
  ax?: number; ay?: number;          // pozice útočníka (pro plánovaný pohyb)
  overrideAdv?: number | null;       // ruční přepnutí DM (-1|0|1)
  overrideCover?: Cover | null;
  state?: StavBoje;                  // pro vidění/zóny/osvětlení (volitelné)
  teren?: Record<string, string>;    // přepsané dlaždice
}

export interface AttackEval {
  canTarget: boolean;
  dist: number;
  cover: Cover;
  coverText: string;
  advSources: string[];
  disSources: string[];
  net: number;                       // -1|0|1 po zrušení
  targetAC: number;
  acBreak: string;
  inRange: boolean;
  longRange: boolean;
  beyondRange: boolean;
  hitChance: number;                 // 0..1
  critChance: number;
  expectedDmg: number;
  notes: string[];
}

const WEAKENED = ["Blinded", "Paralyzed", "Restrained", "Stunned", "Unconscious", "Petrified"];
const condAdvAgainst = (b: Token) => WEAKENED.some((n) => hasCond(b, n));
const ownDis = (a: Token) =>
  ["Blinded", "Poisoned", "Restrained", "Frightened"].some((n) => hasCond(a, n)) || isProne(a);
const grappledBy = (a: Token): string | undefined => (a.cond || []).find((c) => c.n === "Grappled")?.src;

const distAB = (a: Token, b: Token, ax?: number, ay?: number) =>
  gapFt({ s: a.s, x: ax ?? a.x ?? 0, y: ay ?? a.y ?? 0 }, { s: b.s, x: b.x ?? 0, y: b.y ?? 0 });

/** Advantage/Disadvantage zdroje pro útok a→b na vzdálenost dist. */
export function advFor(a: Token, b: Token, atk: AttackDef, dist: number, tokens: Token[]): { adv: string[]; dis: string[] } {
  const adv: string[] = [], dis: string[] = [];
  const bm = sumMods(b), am = sumMods(a);
  if (condAdvAgainst(b)) adv.push("cíl oslabený (stav)");
  if (bm.atkAdvBy) adv.push("efekt na cíli (Faerie Fire…)");
  if (bm.advOnHitBy || bm.helpBonus) adv.push("Help / označený cíl");
  if (am.vex) adv.push("Vex (mastery)");
  if (isProne(b)) (dist <= 5 ? adv : dis).push(`cíl Prone${dist <= 5 ? " (do 5 ft)" : " (z dálky)"}`);
  if (hasCond(b, "Invisible")) dis.push("cíl Invisible");
  if (bm.atkDisBy && !hasCond(b, "Invisible")) dis.push("efekt na cíli (Dodge…)");
  if (hasCond(a, "Invisible") || am.atkAdv) adv.push("útočník Invisible / efekt");
  if (ownDis(a) || am.atkDis || am.sap) dis.push("útočník oslabený / efekt");
  if (hasCond(a, "Grappled") && grappledBy(a) !== b.id) dis.push("Grappled (jiný cíl)");
  if (bm.nextAtkAdvBy) adv.push("Guiding Bolt (označený cíl)");
  if (am.nextAtkDis) dis.push("Vicious Mockery (−dis na další útok)");

  const thrownNow = !!(atk.melee && atk.thrown && dist > (atk.reach || 5));
  const isRangedAtk = !atk.melee || thrownNow;
  if (isRangedAtk && atk.save == null) {
    const normRange = thrownNow ? (atk.thrown?.[0] ?? 0) : (atk.range || 0);
    if (normRange && dist > normRange) dis.push("dlouhý dostřel");
    if (tokens.some((h) => h !== a && h.x != null && !h.dead && hostile(a, h) && !isIncap(h) && distAB(a, h) <= 5))
      dis.push("nepřítel do 5 ft");
  }
  return { adv, dis };
}

export function inRange(atk: AttackDef, dist: number): boolean {
  if (atk.save != null && atk.bonus == null)
    return atk.self ? dist <= (atk.area ? atk.area.size : 5) : dist <= (atk.range || 5);
  if (atk.melee && dist <= (atk.reach || 5)) return true;
  if (atk.thrown && dist <= atk.thrown[1]) return true;
  return !atk.melee && dist <= (atk.long || atk.range || 0);
}

export function evaluateAttack(ctx: AttackCtx): AttackEval {
  const { attacker: a, target: b, atk, map, tokens } = ctx;
  const dist = distAB(a, b, ctx.ax, ctx.ay);
  const teren = ctx.teren ?? ctx.state?.teren;
  const cov = ctx.overrideCover ?? coverOf({ ...a, x: ctx.ax ?? a.x, y: ctx.ay ?? a.y }, b, map, tokens, undefined, undefined, teren);
  const notes: string[] = [];
  const beyond = !inRange(atk, dist);
  const { adv, dis } = advFor(a, b, atk, dist, tokens);
  // Vidění (světlo, tma, invisible zóny) — pouze když máme plný stav
  if (ctx.state && ctx.ax == null) {
    const vAB = canSeeTarget(ctx.state, map, a, b);
    if (!vAB.see && vAB.reason && !dis.some((d) => d === vAB.reason))
      dis.push(`nevidí cíl: ${vAB.reason}`);
    const vBA = canSeeTarget(ctx.state, map, b, a);
    if (!vBA.see && !hasCond(a, "Invisible") && !adv.some((x) => /Invisible/.test(x)))
      adv.push("cíl nevidí útočníka (skrytý/tma)");
  }
  let net = adv.length && dis.length ? 0 : adv.length ? 1 : dis.length ? -1 : 0;
  if (ctx.overrideAdv != null) { net = ctx.overrideAdv; notes.push("ručně přepsáno DM"); }
  const am = sumMods(a), bm = sumMods(b);
  const exA = exhaustion(a) * 2;
  const coverB = COVER_BONUS[cov];
  const targetAC = effectiveAc(b) + coverB;
  const acBreak = `AC ${b.ac}${bm.acBonus ? ` +efekt ${bm.acBonus}` : ""}${coverB ? ` +kryt ${coverB}` : ""} = ${targetAC}`;
  const toHit = (Number(atk.bonus) || 0) + (am.toHitBonus || 0);
  const need = targetAC - toHit + exA;
  let p = clamp((21 - need) / 20, 0.05, 0.95);
  let pc = 0.05;
  if (net > 0) { p = 1 - (1 - p) * (1 - p); pc = 0.0975; }
  else if (net < 0) { p = p * p; pc = 0.0025; }
  if (dist <= 5 && (hasCond(b, "Paralyzed") || hasCond(b, "Unconscious"))) pc = Math.max(pc, p);
  if (exA) notes.push(`Exhaustion −${exA}`);
  const avg = atk.avg ?? (atk.dmg ? diceOnlyAvg(atk.dmg) : 0);
  const n = atk.n || 1;
  const ev = n * ((p - pc) * avg + pc * (avg + diceOnlyAvg(atk.dmg || "0")));
  return {
    canTarget: !beyond && cov !== 9 && !b.dead,
    dist, cover: cov, coverText: COVER_TEXT[cov],
    advSources: adv, disSources: dis, net,
    targetAC, acBreak, inRange: !beyond,
    longRange: !!(atk.long && dist > (atk.range || 0)),
    beyondRange: beyond,
    hitChance: p, critChance: pc, expectedDmg: ev, notes,
  };
}

export interface AttackResult {
  d20s: number[];
  used: number;
  bonus: number;
  total: number;
  hit: boolean;
  crit: boolean;
  fumble: boolean;
  dmgRolls: number[];
  dmgByType: { type: string; amount: number }[];
  notes: string[];
}

/** Samotný hod — čistý (lze dodat rng / ruční hodnoty pro testy a fyzické kostky). */
export function resolveAttack(ctx: AttackCtx, opts: { rng?: Rng; manualD20?: number; manualDmg?: number; force?: boolean } = {}): AttackResult | null {
  const ev = evaluateAttack(ctx);
  if (!ev.canTarget && !opts.force) return null;
  const rng = opts.rng || defaultRng;
  const a = ctx.attacker, atk = ctx.atk;
  const am = sumMods(a);
  const exA = exhaustion(a) * 2;
  const roll = opts.manualD20 != null ? { r: opts.manualD20, rolls: [opts.manualD20] } : d20(ev.net, rng);
  // Bless/Bane a podobné kostky k zásahu
  let diceBonus = 0;
  if (am.toHitDice) diceBonus = rollDice(am.toHitDice, { rng }).total;
  const bonus = (Number(atk.bonus) || 0) + (am.toHitBonus || 0) - exA + diceBonus;
  const total = roll.r + bonus;
  const fumble = roll.r === 1;
  const critNatural = roll.r === 20;
  const crit5 = ev.dist <= 5 && (hasCond(ctx.target, "Paralyzed") || hasCond(ctx.target, "Unconscious"));
  const hit = !fumble && (critNatural || total >= ev.targetAC);
  const crit = hit && (critNatural || crit5);
  const notes: string[] = [...ev.notes];
  if (crit5 && hit && !critNatural) notes.push("crit do 5 ft (Paralyzed/Unconscious)");
  if (diceBonus) notes.push(`${am.toHitDice} = ${diceBonus > 0 ? "+" : ""}${diceBonus}`);
  const dmgByType: { type: string; amount: number }[] = [];
  const dmgRolls: number[] = [];
  if (hit && opts.manualDmg != null) {
    dmgByType.push({ type: atk.typ || "Bludgeoning", amount: opts.manualDmg });
  } else if (hit && atk.dmg) {
    const r = rollDice(atk.dmg, { crit, rng });
    dmgRolls.push(...r.parts);
    dmgByType.push({ type: atk.typ || "Bludgeoning", amount: r.total });
    if (atk.dmg2) {
      const r2 = rollDice(atk.dmg2, { crit, rng });
      dmgRolls.push(...r2.parts);
      dmgByType.push({ type: atk.typ2 || "Force", amount: r2.total });
    }
    const bm = sumMods(ctx.target);
    if (am.dmgOnHitOnce) {
      const r4 = rollDice(am.dmgOnHitOnce.dice, { rng });
      dmgRolls.push(...r4.parts);
      dmgByType.push({ type: am.dmgOnHitOnce.typ || "Radiant", amount: r4.total });
      notes.push(`on-hit (${am.dmgOnHitOnce.dice} ${am.dmgOnHitOnce.typ || ""})`);
    }
    if (bm.extraDmgOnHit) {
      const r3 = rollDice(bm.extraDmgOnHit.dice, { rng });
      dmgRolls.push(...r3.parts);
      dmgByType.push({ type: bm.extraDmgOnHit.typ || "Force", amount: r3.total });
      notes.push(`extra damage (${bm.extraDmgOnHit.dice})`);
    }
  }
  void CONDITIONS;
  return {
    d20s: roll.rolls, used: roll.r, bonus, total, hit, crit, fumble,
    dmgRolls, dmgByType, notes,
  };
}

/* Conditions D&D 5e 2024 + mechanické příznaky. Exhaustion zvlášť (úrovně). */
import type { Token, CondInst } from "../types";

export interface CondDef {
  desc: string;                 // český popis
  icon: string;                 // emoji ikona
  incapacitated?: boolean;
  speed0?: boolean;
  autoFailStrDex?: boolean;
  attacksAgainstAdv?: boolean;  // útoky proti májí Advantage
  attacksAgainstDis?: boolean;
  ownAttacksDis?: boolean;      // vlastní útoky Disadvantage
  ownAttacksAdv?: boolean;
  critWithin5?: boolean;        // zásah do 5 ft = crit
  resistAll?: boolean;          // Petrified
  dexSaveDis?: boolean;
  proneEffect?: boolean;        // chová se jako Prone (Unconscious)
}

export const CONDITIONS: Record<string, CondDef> = {
  Blinded: {
    desc: "Nevidí; útoky proti němu mají Advantage, jeho útoky Disadvantage.",
    icon: "🙈", attacksAgainstAdv: true, ownAttacksDis: true,
  },
  Charmed: {
    desc: "Nemůže útočit na zdroj okouzlení ani ho cílit schopnostmi.",
    icon: "💘",
  },
  Deafened: { desc: "Neslyší; automaticky neuspěje v testech vyžadujících sluch.", icon: "🧏" },
  Exhaustion: {
    desc: "−2 ke všem d20 testům a −5 ft rychlosti za úroveň. Úroveň 6 = smrt.",
    icon: "😮‍💨",
  },
  Frightened: {
    desc: "Disadvantage na testy schopností a útoky, dokud vidí zdroj strachu; nemůže se k němu dobrovolně přiblížit.",
    icon: "😨", ownAttacksDis: true,
  },
  Grappled: {
    desc: "Speed 0; Disadvantage na útoky proti jiným cílům než tomu, kdo ho drží.",
    icon: "🤼", speed0: true,
  },
  Incapacitated: {
    desc: "Žádné akce, bonusové akce ani reakce; ztrácí Concentration.",
    icon: "🚫", incapacitated: true,
  },
  Invisible: {
    desc: "Jeho útoky mají Advantage, útoky proti němu Disadvantage.",
    icon: "👻", ownAttacksAdv: true, attacksAgainstDis: true,
  },
  Paralyzed: {
    desc: "Incapacitated, Speed 0; útoky proti němu Advantage, zásah do 5 ft kritický; automaticky neuspěje v STR/DEX záchranách.",
    icon: "🧊", incapacitated: true, speed0: true, attacksAgainstAdv: true, critWithin5: true, autoFailStrDex: true,
  },
  Petrified: {
    desc: "Zkamenělý: Incapacitated, Speed 0, Resistance vůči všemu poškození, útoky proti němu Advantage, neuspěje v STR/DEX.",
    icon: "🗿", incapacitated: true, speed0: true, attacksAgainstAdv: true, autoFailStrDex: true, resistAll: true,
  },
  Poisoned: {
    desc: "Disadvantage na útoky a testy schopností.",
    icon: "🤢", ownAttacksDis: true,
  },
  Prone: {
    desc: "Útoky do 5 ft proti němu Advantage, z větší dálky Disadvantage; jeho útoky Disadvantage. Vstát stojí polovinu rychlosti.",
    icon: "🤸", ownAttacksDis: true,
  },
  Restrained: {
    desc: "Speed 0; útoky proti němu Advantage, jeho útoky Disadvantage; Disadvantage na DEX záchrany.",
    icon: "🕸️", speed0: true, attacksAgainstAdv: true, ownAttacksDis: true, dexSaveDis: true,
  },
  Stunned: {
    desc: "Incapacitated; útoky proti němu Advantage; automaticky neuspěje v STR/DEX záchranách.",
    icon: "💫", incapacitated: true, attacksAgainstAdv: true, autoFailStrDex: true,
  },
  Unconscious: {
    desc: "Incapacitated, Prone, Speed 0; útoky proti němu Advantage, zásah do 5 ft kritický; neuspěje v STR/DEX.",
    icon: "😵", incapacitated: true, speed0: true, attacksAgainstAdv: true, critWithin5: true,
    autoFailStrDex: true, proneEffect: true,
  },
};

export const CONDITION_NAMES = Object.keys(CONDITIONS);

export const condOf = (t: Token, n: string): CondInst | undefined =>
  (t.cond || []).find((c) => c.n === n);

export const hasCond = (t: Token, n: string): boolean => !!condOf(t, n);

export const exhaustion = (t: Token): number =>
  Number(condOf(t, "Exhaustion")?.lvl) || 0;

export const isIncap = (t: Token): boolean =>
  t.dead ||
  CONDITION_NAMES.some((n) => CONDITIONS[n].incapacitated && hasCond(t, n)) ||
  (t.kind === "pc" && t.hp <= 0) ||
  (t.dying === true);

/** Speed s přihlédnutím ke Grappled/Restrained/Incapacitated/Exhaustion + efektům. */
export function speedOf(t: Token): number {
  if (isIncap(t)) return 0;
  if (CONDITION_NAMES.some((n) => CONDITIONS[n].speed0 && hasCond(t, n))) return 0;
  const mult = (t.effects || []).reduce((m, e) => m * (e.mods.speedMult ?? 1), 1);
  const set = (t.effects || []).map((e) => e.mods.speedSet).filter((v): v is number => v != null);
  const bonus = (t.effects || []).reduce((m, e) => m + (e.mods.speedBonus ?? 0), 0);
  const base = set.length ? Math.min(...set) : (t.speedOverride ?? t.speed);
  return Math.max(0, Math.round((base - 5 * exhaustion(t)) * mult + bonus));
}

/** Efektivní fly speed (Fly kouzlo atd.). */
export function flySpeedOf(t: Token): number {
  const set = (t.effects || []).map((e) => e.mods.flySpeedSet).filter((v): v is number => v != null);
  return Math.max(t.fly || 0, ...(set.length ? set : [0]));
}

/** Prone včetně Unconscious (chová se jako Prone). */
export const isProne = (t: Token): boolean =>
  hasCond(t, "Prone") || CONDITION_NAMES.some((n) => CONDITIONS[n].proneEffect && hasCond(t, n));

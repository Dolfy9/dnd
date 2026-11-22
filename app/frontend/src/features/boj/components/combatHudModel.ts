import type { AttackDef, StavBoje, Token } from "../types";
import { isIncap } from "../rules/conditions";
import { isFree } from "../rules/free";
import { legendaryActionError } from "../rules/turn";
import { settingsOf } from "../rules/settings";

export type ActionGroup = "all" | "a" | "b" | "r" | "legendary";
export function hpDescription(t: Token): string {
  const supplied = t.hp_stav;
  if (supplied) return supplied;
  if (t.dead) return "Mrtvý";
  if (t.hp <= 0) return "Vyřazený";
  if (!Number.isFinite(t.hp) || !Number.isFinite(t.max)) return "Stav neznámý";
  const f = t.hp / Math.max(1, t.max);
  return f >= 1 ? "Nezraněný" : f > .5 ? "Lehce zraněný" : f > .25 ? "Těžce zraněný" : "Na pokraji";
}
export function pipState(S: StavBoje, t: Token, group: Exclude<ActionGroup, "all">) {
  const e = S.eco[t.id];
  const max = group === "legendary" ? t.legendary?.max || 0 : 1;
  const used = group === "legendary" ? t.legendary?.used || 0 : e?.[group] || 0;
  return { max, used: Math.min(max, Math.max(0, used)), left: Math.max(0, max - used) };
}
export const attackGroup = (a: AttackDef): Exclude<ActionGroup, "all"> => a.legendaryCost != null ? "legendary" : a.ba ? "b" : a.rea ? "r" : "a";
export function economyReason(S: StavBoje, t: Token, cost: "a" | "b" | "r"): string | undefined {
  if (isFree(S) || settingsOf(S).automatizace.ekonomika !== "hlidat") return;
  const e = S.eco[t.id];
  if (e?.[cost] && !(cost === "a" && e.extraA)) return `${cost === "a" ? "Action" : cost === "b" ? "Bonus Action" : "Reaction"} použita`;
}
export function actorReason(t: Token, dm: boolean): string | undefined {
  if (!dm) return "Ovládá PJ";
  if (t.dead || t.hp <= 0 || isIncap(t)) return "Tvor nemůže jednat";
}
export function unusableReason(S: StavBoje, t: Token, a: AttackDef, dm: boolean): string | undefined {
  if (!dm) return "Ovládá PJ";
  if (isFree(S)) return;
  const actor = actorReason(t, dm); if (actor) return actor;
  if (a.rc && t.spent?.[a.nazev]) return "Čeká na recharge";
  const resource = t.zdroje.find(z => z.nazev === a.uses);
  if (resource && resource.used >= resource.max) return "Došla použití";
  if (a.legendaryCost != null) return legendaryActionError(S, t, a.legendaryCost);
  if (!a.innate && settingsOf(S).automatizace.sloty === "hlidat" && (a.lvl || 0) > 0 && !a.ritual && !t.slots?.some((s, i) => i + 1 >= a.lvl! && s.used < s.max)
      && !(t.pact && t.pact.lvl >= a.lvl! && t.pact.used < t.pact.max)) return "Došly sloty";
  if (!a.kouzlo && !a.ba && !a.rea && (S.eco[t.id]?.atkLeft || 0) > 0) return;
  return economyReason(S, t, a.ba ? "b" : a.rea ? "r" : "a");
}

export function publicHpFraction(t: Token): number {
  const bucket = hpDescription(t);
  return bucket === "Nezraněný" ? 1 : bucket === "Lehce zraněný" ? .75 : bucket === "Těžce zraněný" ? .4 : bucket === "Na pokraji" ? .15 : 0;
}

import type { BattleMapData, StavBoje, Token } from "../../types";
import { uid } from "../../types";
import { enqueueDecision, pendingOf, removeDecision } from "../../rules/pending";
import { byId, ecoOf, log, resolveEndSave } from "../../rules/turn";
import { gapFt, meleeReach } from "../../rules/grid";
import { isIncap } from "../../rules/conditions";
import { resolveSave } from "../../rules/saves";
import { defaultRng, type Rng } from "../../rules/dice";
import type { MovementPlan } from "../../rules/movement";
import { cmdAttack } from "./combat";
import { moveToken } from "./move";
import { dropConc } from "./effects";

export function queueOpportunityMove(S: StavBoje, token: Token, plan: MovementPlan, to: [number, number]) {
  if (pendingOf(S).some(p => p.move && p.tokenId === token.id)) return;
  const batch = uid();
  for (const ownerId of plan.oaIds) {
    const owner = byId(S, ownerId);
    if (!owner || ecoOf(S, owner).r || owner.react === false || isIncap(owner) || owner.dead) continue;
    const i = plan.path.findIndex((point, n) => n > 0 && gapFt(token, owner, ...plan.path[n - 1]) <= meleeReach(owner) && gapFt(token, owner, ...point) > meleeReach(owner));
    if (i < 1) continue;
    enqueueDecision(S, { kind: "oa", tokenId: token.id, label: `${owner.nazev} → ${token.nazev} · Opportunity Attack`, move: { batch, ownerId, from: [token.x!, token.y!], at: plan.path[i - 1], to, ft: plan.ft } });
  }
  if (!pendingOf(S).some(p => p.move?.batch === batch)) moveToken(S, token.id, ...to, { ft: plan.ft, mode: "pravidla" });
}

export function resolvePending(S: StavBoje, id: string, skip: boolean, map: BattleMapData, rng: Rng = defaultRng) {
  const item = pendingOf(S).find(p => p.id === id);
  if (!item) return false;
  removeDecision(S, id);
  const t = byId(S, item.tokenId);
  if (!t) return false;
  if (skip) log(S, "system", `Přeskočeno: ${item.label}`, "PJ", undefined, true);
  if (item.kind === "concentration" && !skip && t.conc === item.spell) {
    const save = !t.dead && !isIncap(t) ? resolveSave(t, "CON", item.dc || 10, { rng }) : null;
    log(S, "save", `${t.nazev}: Concentration CON ${save?.total ?? "Incapacitated"} vs DC ${item.dc} → ${save?.success ? "úspěch" : "neúspěch"}`, t.nazev, save ? `d20:${save.rolls.join("/")}` : undefined);
    if (!save?.success) dropConc(S, t.id);
  }
  if (item.kind === "saveEnd" && !skip) {
    const effect = t.effects.find(e => e.id === item.effectId);
    if (effect) for (const message of resolveEndSave(S, t, effect, rng)) log(S, "save", message, t.nazev);
  }
  if (item.move) {
    const m = item.move;
    if (t.x !== m.from[0] || t.y !== m.from[1] || t.dead || isIncap(t)) {
      S.pendingResolutions = pendingOf(S).filter(p => p.move?.batch !== m.batch);
      log(S, "system", "Odložený pohyb zrušen: tvor se přesunul nebo nemůže pokračovat.", "PJ");
      return false;
    }
    const owner = byId(S, m.ownerId);
    const atk = owner?.atk.find(a => a.melee);
    if (!skip && owner && atk && !ecoOf(S, owner).r && owner.react !== false && !owner.dead && !isIncap(owner)) {
      [t.x, t.y] = m.at;
      cmdAttack(S, { atkId: owner.id, tgtId: t.id, atk: { ...atk, ba: false, rea: true, legendaryCost: undefined }, rng, override: true }, { map });
      [t.x, t.y] = m.from;
    }
    if (!pendingOf(S).some(p => p.move?.batch === m.batch) && !t.dead && !isIncap(t)) moveToken(S, t.id, ...m.to, { ft: m.ft, mode: "pravidla" });
  }
  return true;
}

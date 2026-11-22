import type { AttackDef, BattleMapData, StavBoje, Token, Ability } from "../types";
import type { Resolve } from "../components/ResolveDialog";
import type { Intent } from "./useIntents";
import { byId, cur, log, STD_ACTIONS } from "../rules/turn";
import { cumFt, planMovement } from "../rules/movement";
import { settingsOf } from "../rules/settings";
import { tokensInArea } from "../rules/areas";
import { targetStatus } from "../components/targetingModel";
import { actorReason, economyReason, unusableReason } from "../components/combatHudModel";
import { pendingOf } from "../rules/pending";
import { cmdDeathSave, cmdStdAction, nextTurn, moveToken } from "./commands";
import { queueOpportunityMove, resolvePending } from "./commands/pending";
import { resolveSave } from "../rules/saves";
import { d20 } from "../rules/dice";
import type { ResolutionOptions } from "./resolution";

export const ownsToken = (t: Token | undefined, userId: number | undefined) => !!t && userId != null && t.src?.owner === String(userId);
export const playerTurn = (S: StavBoje | null, t: Token | undefined, userId: number | undefined) => !!S && ownsToken(t, userId) && cur(S)?.id === t?.id;
export const actionId = (a: AttackDef) => `${a.kouzlo || a.kind === "spell" ? "spell" : "attack"}:${a.kouzlo || a.nazev}`;
export const actionOf = (t: Token, id: string | undefined) => [...t.atk, ...(t.kouzla || [])].find(a => actionId(a) === id);
export function requestForResolution(r: Resolve): Intent["payload"] {
  return { action_id: actionId(r.atk), target_ids: r.kind === "area" ? r.tgtIds : [r.tgtId, ...(r.extraTgtIds || [])],
    ...(r.kind === "area" ? { aoe: { anchor: r.spec.anchor, rotation: r.spec.dir } } : {}),
    manual_dice: { ...(r.slot ? { slot: r.slot } : {}), ...(r.pact ? { pact: 1 } : {}) } };
}
export function intentOptions(row: Intent): ResolutionOptions {
  const dice = row.payload.manual_dice || {};
  return { manualD20: typeof dice.attack === "number" ? dice.attack : undefined,
    manualDmg: typeof dice.damage === "number" ? dice.damage : undefined,
    slot: typeof dice.slot === "number" ? dice.slot : undefined, pact: dice.pact === 1 };
}
export function intentResolution(S: StavBoje, row: Intent): Resolve | null {
  const t = byId(S, row.token_id), atk = t && actionOf(t, row.payload.action_id);
  if (!t || !atk) return null;
  const options = intentOptions(row);
  if (row.payload.aoe && atk.area) {
    const spec = { ...atk.area, anchor: row.payload.aoe.anchor, dir: row.payload.aoe.rotation };
    return { kind: "area", srcId: t.id, atk, spec, tgtIds: tokensInArea(spec, S.tok, t).map(t => t.id), slot: options.slot, pact: options.pact };
  }
  return { kind: "attack", srcId: t.id, atk, tgtId: row.payload.target_ids?.[0] || t.id,
    extraTgtIds: row.payload.target_ids?.slice(1), slot: options.slot, pact: options.pact };
}
export function intentMovement(S: StavBoje, map: BattleMapData, row: Intent) {
  const copy = structuredClone(S), t = byId(copy, row.token_id), path = row.payload.path || [];
  if (!t || path.length < 2) return null;
  const plan = planMovement(copy, map, t, path.slice(1, -1), path[path.length - 1], "pravidla", settingsOf(copy));
  const costs = cumFt(t, path, map, copy, settingsOf(copy));
  const ft = costs[costs.length - 1] || 0;
  return { ...plan, ft, overFt: Math.max(0, ft - plan.limitFt), withinLimit: ft <= plan.limitFt };
}
export function intentError(S: StavBoje, map: BattleMapData, row: Intent): string | undefined {
  S = structuredClone(S);
  const t = byId(S, row.token_id);
  if (!t) return "Žeton už v boji není.";
  if (!ownsToken(t, row.user_id)) return "Vlastník žetonu se změnil.";
  if (!["reaction", "roll"].includes(row.kind) && cur(S)?.id !== t.id) return "Žeton už není na tahu.";
  if (row.kind === "move") {
    const path = row.payload.path || [], plan = intentMovement(S, map, row);
    if (actorReason(t, true)) return actorReason(t, true);
    if (!plan || path[0][0] !== t.x || path[0][1] !== t.y) return "Výchozí pozice se změnila.";
    if (path.some((p, i) => i && Math.max(Math.abs(p[0] - path[i - 1][0]), Math.abs(p[1] - path[i - 1][1])) !== 1)
      || plan.blocked || JSON.stringify(path) !== JSON.stringify(plan.path)) return "Cesta už není průchozí.";
    if (plan.overFt > 0) return "Nedostatek zbývajícího pohybu.";
  }
  if (row.kind === "action") {
    if (row.payload.target_ids?.some(id => !byId(S, id))) return "Cíl už v boji není.";
    const standard = row.payload.action_id?.startsWith("std:");
    if (standard) {
      const id = row.payload.action_id!.slice(4);
      if (!STD_ACTIONS.some(a => a.id === id)) return "Neznámá standardní akce.";
      if (["grapple", "shove", "help"].includes(id) && !row.payload.target_ids?.length) return "Vyber cíl akce.";
      return actorReason(t, true) || economyReason(S, t, "a");
    }
    const r = intentResolution(S, row);
    if (!r) return "Akce už není dostupná.";
    const reason = unusableReason(S, t, r.atk, true); if (reason) return reason;
    if (r.kind === "attack") {
      const target = byId(S, r.tgtId);
      if (!target) return "Cíl už v boji není.";
      const ev = targetStatus(S, map, t, target, r.atk);
      if (!r.atk.utility && !ev.highlighted) return ev.reason || "Cíl není legální.";
    }
    if (r.kind === "area") {
      const anchor = { ...t, id: "intent-area", x: r.spec.anchor[0], y: r.spec.anchor[1] };
      if (!targetStatus(S, map, t, anchor, r.atk).highlighted) return "Střed oblasti je mimo dosah nebo výhled.";
    }
  }
  if (row.kind === "reaction") {
    const pending = pendingOf(S).find(p => p.id === row.payload.pending_id);
    if (!pending || (pending.move?.ownerId || pending.actorId || pending.tokenId) !== t.id) return "Nabídka reakce už není dostupná.";
    if (row.payload.accept && S.eco[t.id]?.r) return "Reaction už byla použita.";
  }
  if (row.kind === "death_save" && (t.hp > 0 || t.dead || t.dying === false)) return "Žeton nepotřebuje death save.";
}
export const canAutoMove = (S: StavBoje, map: BattleMapData, row: Intent) => row.kind === "move" && !intentError(S, map, row) && !intentMovement(S, map, row)?.oaIds.length;
export const intentWasApplied = (S: StavBoje, id: string) => S.log.some(l => l.detail === `intent:${id}`);
export function logIntent(S: StavBoje, row: Intent, player: string) { log(S, "system", `${player}: žádost provedena · ${byId(S, row.token_id)?.nazev || row.token_id}`, player, `intent:${row.id}`); }
export function applySimpleIntent(S: StavBoje, map: BattleMapData, row: Intent, override = false): boolean {
  if (!override && intentError(S, map, row)) return false;
  const t = byId(S, row.token_id); if (!t) return false;
  if (row.kind === "move") {
    const path = row.payload.path!, to = path[path.length - 1], plan = intentMovement(S, map, row);
    if (!plan) return false;
    if (plan.oaIds.length && !override) queueOpportunityMove(S, t, plan, to);
    else moveToken(S, t.id, ...to, { ft: plan.ft, mode: plan.blocked ? "teleport" : "pravidla", oas: plan.oas });
  } else if (row.kind === "end_turn") nextTurn(S);
  else if (row.kind === "death_save") cmdDeathSave(S, t.id);
  else if (row.kind === "reaction") return resolvePending(S, row.payload.pending_id!, !row.payload.accept, map);
  else if (row.kind === "action" && row.payload.action_id?.startsWith("std:")) cmdStdAction(S, t.id, row.payload.action_id.slice(4), row.payload.target_ids?.[0], override);
  else if (row.kind === "roll") {
    const name = row.payload.name || "STR", ab = name.toUpperCase() as Ability;
    if (row.payload.type === "save") {
      const save = resolveSave(t, ab, row.payload.dc ?? 10, { manualRoll: row.payload.value });
      log(S, "save", `${t.nazev}: ${name} ${save.total} vs DC ${row.payload.dc ?? 10}`, t.nazev);
    } else {
      const rolled = row.payload.value ?? d20().r, bonus = t.skills?.[name] ?? t.mods?.[ab] ?? 0;
      log(S, "system", `${t.nazev}: ${name} ${rolled}+${bonus}=${rolled + bonus}`, t.nazev);
    }
  } else return false;
  return true;
}

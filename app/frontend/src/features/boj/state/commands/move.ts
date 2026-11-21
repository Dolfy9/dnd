/* move.ts */
import type { StavBoje, Token, Zone, AttackDef, FxEvent } from "../../types";
import { uid } from "../../types";
import { rollInitiative, advanceTurn, byId, log, useEco, ecoFree, ecoOf, moveLeft, resetEconomy } from "../../rules/turn";
import { evaluateAttack, resolveAttack, type AttackCtx } from "../../rules/attack";
import { applyDamage, applyHealing, setTempHp, deathSave } from "../../rules/damage";
import { resolveSave } from "../../rules/saves";
import { zonesOn, dropConcentration, makeEffect, presetById, sumMods } from "../../rules/effects";
import { reachable, gapFt, hostile, cellsOf, meleeReach, oaAlong } from "../../rules/grid";
import { coverOf } from "../../rules/los";
import { tokensInArea, areaCells, type AreaSpec } from "../../rules/areas";
import { numberDuplicates } from "../../rules/combatants";
import { d20, rollDice, defaultRng } from "../../rules/dice";
import { hasCond, isIncap, speedOf } from "../../rules/conditions";
import { resourceAction, restResources } from "../../rules/resources";
import { canSeeTarget } from "../../rules/lighting";
import type { BattleMapData, MoveMode } from "../../types";
import { settingsOf } from "../../rules/settings";
import { planMovement } from "../../rules/movement";
import { fx } from "./shared";
import { isFree } from "../../rules/free";

/* ---------- pohyb ---------- */
export interface MoveOpts {
  ft?: number; oas?: string[]; mode?: MoveMode; override?: boolean;
  zones?: boolean; // triggerovat vstup do zón (default: nastaveni / jen ne-nucené)
}
const MODE_LABEL: Record<string, string> = {
  dash: " (Dash)", prekrocit: " ⚙ DM: překročen pohyb", nuceny: " (nucený přesun ⚙)", teleport: " (teleport ⚙)",
};
export const moveToken = (S: StavBoje, id: string, x: number, y: number, o: MoveOpts = {}) => {
  const t = byId(S, id); if (!t) return;
  if (isFree(S)) {           // volný režim: přemístění bez pravidel
    t.x = x; t.y = y;
    log(S, "move", `${t.nazev} → (${x},${y}) (volný přesun)`, t.nazev);
    return;
  }
  const mode = o.mode || "pravidla";
  const set = settingsOf(S).pohyb;
  t.x = x; t.y = y;
  const e = ecoOf(S, t);
  const ft = o.ft ?? 0;
  if (mode === "dash") { useEco(S, t, "a"); e.dash = 1; e.moved += ft; }
  else if (mode === "pravidla" || mode === "prekrocit") e.moved += ft;
  // nuceny/teleport: bez nákladu pohybu
  const over = mode === "prekrocit" ? ` — ${ft} ft` : ft ? ` — ${ft} ft` : "";
  log(S, "move", `${t.nazev} → (${x},${y})${over}${MODE_LABEL[mode] || ""}${o.oas?.length ? ` ⚠ OA: ${o.oas.join(", ")}` : ""}`, t.nazev);
  if (o.oas?.length) fx(S, "shake", { to: [x, y], text: "Opportunity Attack!", tokenId: t.id });
  // trigger zón při vstupu (u nuceného/teleportu podle nastavení)
  const trig = o.zones ?? (mode === "nuceny" || mode === "teleport" ? set.zonyPriPresunuDM : true);
  if (trig) for (const z of zonesOn(t, S.zones, S.tok)) triggerZone(S, t, z, "enter");
};

/** Vrátí žeton na pozici z počátku tahu a vynuluje spotřebovaný pohyb. */
export function undoTurnMovement(S: StavBoje, id: string) {
  const t = byId(S, id); if (!t?.startPos) return;
  const e = ecoOf(S, t);
  const ft = e.moved;
  [t.x, t.y] = t.startPos;
  e.moved = 0;
  delete t.startPos;
  log(S, "move", `${t.nazev}: pohyb vrácen (−${ft} ft)`, "PJ");
}

/** Trigger zóny (enter/start/end) — damage/save/cond. */
export function triggerZone(S: StavBoje, t: Token, z: Zone, on: NonNullable<Zone["trigger"]>["on"]) {
  const tr = z.trigger;
  if (!tr || (tr.on !== on && tr.on !== "any")) return;
  let dmg = tr.dmg ? rollDice(tr.dmg.dice).total : 0;
  if (tr.save && tr.save.dc) {
    const sr = resolveSave(t, tr.save.ab, tr.save.dc, {});
    if (sr.success) dmg = tr.save.half ? Math.floor(dmg / 2) : (tr.cond ? 0 : dmg);
    else if (tr.cond && !hasCond(t, tr.cond)) { t.cond.push({ n: tr.cond }); log(S, "cond", `${t.nazev}: ${tr.cond} (${z.nazev})`, "PJ"); }
  } else if (tr.cond && !hasCond(t, tr.cond)) { t.cond.push({ n: tr.cond }); log(S, "cond", `${t.nazev}: ${tr.cond} (${z.nazev})`, "PJ"); }
  if (dmg) {
    const r = applyDamage(t, [{ amount: dmg, type: tr.dmg!.typ }]);
    fx(S, "dmg", { to: [t.x ?? 0, t.y ?? 0], text: String(r.applied), dmgType: String(tr.dmg!.typ), tokenId: t.id });
    log(S, "damage", `${t.nazev}: ${r.applied} ${tr.dmg!.typ} (${z.nazev})`, "PJ");
    for (const m of r.messages) log(S, "system", m, "PJ");
  }
}

export interface MovePlan { ft: number; path: [number, number][]; blocked: boolean; oas: string[] }
export function planMove(S: StavBoje, map: BattleMapData, t: Token, to: [number, number]): MovePlan {
  const lim = moveLeft(S, t) + (t.fly ? 0 : 0);
  const r = reachable(t, Math.max(lim, 0), map, S.tok, S.zones, S.teren, (S as any).dvere);
  const ft = r.dist[`${to[0]},${to[1]}`];
  const path = ft != null ? r.path(to[0], to[1]) : [];
  const disengaged = sumMods(t).noOA || !!ecoOf(S, t).disengage;
  const oas = path.length > 1 ? oaAlong(t, path, S.tok, disengaged).map((h) => h.nazev) : [];
  const blocked = ft == null;
  return { ft: ft ?? 0, path, blocked, oas };
}
export function reachableCells(S: StavBoje, map: BattleMapData, t: Token) {
  return reachable(t, Math.max(moveLeft(S, t), 0), map, S.tok, S.zones, S.teren, (S as any).dvere).dist;
}

/* ---------- move & attack ---------- */
export interface MoveAttackPlan { cell: [number, number]; ft: number; path: [number, number][]; oas: string[] }
/** Najde nejblizsi dosazitelnou bunku, ze ktere `atk` dosahne na `B` (melee). */
export function planMoveAttack(S: StavBoje, map: BattleMapData, A: Token, B: Token, atk: AttackDef): MoveAttackPlan | null {
  if (!atk.melee) return null;
  const lim = moveLeft(S, A);
  const r = reachable(A, Math.max(lim, 0), map, S.tok, S.zones, S.teren, (S as any).dvere);
  const reach = atk.reach || 5;
  let best: MoveAttackPlan | null = null;
  for (const key of Object.keys(r.dist)) {
    const [x, y] = key.split(",").map(Number);
    const d = gapFt({ s: A.s, x, y }, B);
    if (d > reach) continue;
    const ft = r.dist[key];
    const path = r.path(x, y);
    const dis = sumMods(A).noOA || !!ecoOf(S, A).disengage;
    const oas = path.length > 1 ? oaAlong(A, path, S.tok, dis).map((h) => h.nazev) : [];
    if (!best || ft < best.ft) best = { cell: [x, y], ft, path, oas };
  }
  return best;
}

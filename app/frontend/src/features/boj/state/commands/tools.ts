/* tools.ts */
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
import type { BattleMapData } from "../../types";
import { fx } from "./shared";
import { mapCells, updateFog } from "../../model/fog";

/* ---------- teren / mlha / svetla ---------- */
export function cmdPaint(S: StavBoje, cells: [number, number][], tile: string) {
  S.teren = S.teren || {};
  for (const [x, y] of cells) {
    const k = `${x},${y}`;
    if (tile === ".") delete S.teren[k]; else S.teren[k] = tile;
  }
  log(S, "system", `Teren: ${cells.length} bunek → "${tile === "." ? "vymazano" : tile}"`, "PJ");
}

export function cmdFogToggle(S: StavBoje, on: boolean) {
  S.fog = { ...S.fog, on, revealed: S.fog?.revealed || {} };
  log(S, "system", `Mlha války: ${on ? "zapnuto" : "vypnuto"}`, "PJ");
}
export function cmdFogCells(S: StavBoje, cells: [number, number][], reveal: boolean) {
  S.fog = S.fog || { on: true, revealed: {} };
  S.fog.manual ||= {}; S.fog.hidden ||= {}; S.fog.visible ||= {};
  for (const [x, y] of cells) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) continue;
    const k = `${x},${y}`;
    if (reveal) {
      S.fog.manual[k] = 1; S.fog.revealed[k] = 1; S.fog.visible[k] = 1; delete S.fog.hidden[k];
    } else {
      S.fog.hidden[k] = 1; delete S.fog.manual[k]; delete S.fog.revealed[k]; delete S.fog.visible[k];
    }
  }
}
export function cmdFogAll(S: StavBoje, map: BattleMapData) {
  cmdFogToggle(S, true); cmdFogCells(S, mapCells(map), true);
}
export function cmdFogReset(S: StavBoje, map: BattleMapData) {
  S.fog = { on: true, revealed: {}, visible: {} }; updateFog(S, map);
  log(S, "system", "Mlha války: zapomenuta prozkoumaná místa", "PJ");
}
export function cmdFogParty(S: StavBoje, map: BattleMapData) {
  S.fog = S.fog || { on: true, revealed: {} };
  updateFog(S, map);
  log(S, "system", "Mlha války: přepočítán výhled družiny", "PJ");
}

export function cmdAddLight(S: StavBoje, l: Omit<import("../../types").LightSource, "id">) {
  S.lights = [...(S.lights || []), { ...l, id: uid() }];
  log(S, "system", `Svetlo ${l.nazev} (${l.bright}/${l.dim} ft)`, "PJ");
}
export function cmdRemoveLight(S: StavBoje, id: string) {
  S.lights = (S.lights || []).filter((l) => l.id !== id);
  S.zdroje = { ...S.zdroje, [id]: false };
}
export function cmdLightLevel(S: StavBoje, lvl: "bright" | "dim" | "dark") {
  S.lightLevel = lvl;
  log(S, "system", `Osvetleni: ${lvl}`, "PJ");
}

/* ---------- kostky ---------- */
export function cmdDice(S: StavBoje, who: string, expr: string, adv?: -1 | 0 | 1) {
  if (adv) {
    const r = d20(adv);
    log(S, "system", `${who}: d20${adv > 0 ? " (adv)" : " (dis)"} → ${r.r} [${r.rolls.join(", ")}]`, who, `d20:${r.rolls.join("/")}`);
    return r.r;
  }
  const r = rollDice(expr);
  log(S, "system", `${who}: ${expr} = ${r.total} [${r.parts.join(", ")}]`, who, `${expr}:${r.parts.join("+")}`);
  return r.total;
}

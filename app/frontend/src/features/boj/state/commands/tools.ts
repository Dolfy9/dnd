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
  S.fog = { on, revealed: S.fog?.revealed || {} };
  log(S, "system", `Fog of War: ${on ? "zapnuto" : "vypnuto"}`, "PJ");
}
export function cmdFogCells(S: StavBoje, cells: [number, number][], reveal: boolean) {
  S.fog = S.fog || { on: true, revealed: {} };
  for (const [x, y] of cells) {
    const k = `${x},${y}`;
    if (reveal) S.fog.revealed[k] = 1;
    else { delete S.fog.revealed[k]; if (S.fog.visible) delete S.fog.visible[k]; }
  }
}
export function cmdFogParty(S: StavBoje, radiusCells = 8) {
  S.fog = S.fog || { on: true, revealed: {} };
  for (const t of S.tok.filter((x) => x.side === "druzina" && x.x != null && !x.dead))
    for (let dx = -radiusCells; dx <= radiusCells; dx++)
      for (let dy = -radiusCells; dy <= radiusCells; dy++)
        S.fog.revealed[`${t.x! + dx},${t.y! + dy}`] = 1;
  log(S, "system", "Fog: odhaleno okoli druziny", "PJ");
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

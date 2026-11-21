/* turn.ts */
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

/* ---------- iniciativa / tah ---------- */
export const cmdRollInit = (S: StavBoje, surprise: string[] = []) => { rollInitiative(S, defaultRng, surprise); };
export const setInit = (S: StavBoje, id: string, v: number) => {
  const t = byId(S, id); if (!t) return;
  t.init = v;
  S.ord = [...S.tok].sort((x, y) => (y.init ?? 0) - (x.init ?? 0) || (y.initB ?? 0) - (x.initB ?? 0)).map((x) => x.id);
  if (S.turn >= S.ord.length) S.turn = 0;
};
export const nextTurn = (S: StavBoje) => { advanceTurn(S); };
export const setTurnTo = (S: StavBoje, idx: number) => { if (idx >= 0 && idx < S.ord.length) S.turn = idx; };

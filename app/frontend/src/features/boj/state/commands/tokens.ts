/* tokens.ts */
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
import { refreshedStats } from "../../rules/reimport";

/* ---------- žetony ---------- */
export const addToken = (S: StavBoje, t: Token, xy?: [number, number]) => {
  if (xy) { t.x = xy[0]; t.y = xy[1]; }
  S.tok.push(t);
  if (!S.ord.includes(t.id)) S.ord.push(t.id);
  numberDuplicates(S.tok);
  log(S, "system", `${t.nazev} přidán do boje`, "PJ");
};
export const removeToken = (S: StavBoje, id: string) => {
  const t = byId(S, id); if (!t) return;
  S.tok = S.tok.filter((x) => x !== t);
  S.ord = S.ord.filter((i) => i !== id);
  delete S.eco[id];
  log(S, "system", `${t.nazev} odebrán z boje`, "PJ");
};
export const patchToken = (S: StavBoje, id: string, patch: Partial<Token>) => {
  const t = byId(S, id); if (t) Object.assign(t, patch);
};
export const reimportToken = (S: StavBoje, id: string, fresh: Token) => {
  const t = byId(S, id); if (!t) return;
  Object.assign(t, refreshedStats(t, fresh));
  log(S, "system", `${t.nazev}: statistiky obnoveny ze zdroje; HP, stavy a pozice zachovány`, "PJ", undefined, true);
};

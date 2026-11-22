import type { AttackDef, BattleMapData, StavBoje, Token } from "../types";
import { evaluateAttack } from "../rules/attack";
import { canSeeTarget } from "../rules/lighting";
import type { AreaSpec } from "../rules/areas";

export function targetStatus(S: StavBoje, map: BattleMapData, source: Token, target: Token, atk: AttackDef) {
  const evaluation = evaluateAttack({ attacker: source, target, atk, map, tokens: S.tok, state: S, teren: S.teren });
  const vision = canSeeTarget(S, map, source, target);
  const reason = evaluation.beyondRange ? "Mimo dostřel" : evaluation.cover === 9 ? "Bez linie výhledu · plný kryt" : target.dead ? "Mrtvý cíl" : !vision.see ? `Nevidí cíl: ${vision.reason || "bez výhledu"} · útok naslepo` : "";
  return { ...evaluation, reason, highlighted: evaluation.canTarget && vision.see };
}
export function targetingArea(source: Token, atk: AttackDef, cursor: [number, number], rotation = 0): AreaSpec {
  const shape = atk.area!.shape;
  const directional = shape === "cone" || shape === "line";
  const anchor: [number, number] = directional || shape === "emanation" ? [source.x || 0, source.y || 0] : cursor;
  const dir = directional ? Math.atan2(cursor[1] - anchor[1], cursor[0] - anchor[0]) * 180 / Math.PI + rotation : rotation;
  return { shape, size: atk.area!.size, anchor, dir };
}

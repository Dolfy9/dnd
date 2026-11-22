import type { BattleMapData, StavBoje, Token } from "../types";
import { fogPlayerState, fogState } from "../model/fog";
import { movementCosts } from "../rules/movement";
import { cellsOf, gapFt, hostile, mapSize, meleeReach, oaAlong } from "../rules/grid";
import { flySpeedOf, isIncap, speedOf } from "../rules/conditions";
import { moveLeft } from "../rules/turn";
import { settingsOf } from "../rules/settings";

export const overlayState = (S: StavBoje, dm: boolean) => dm ? S : fogPlayerState(S);
export const overlayCellVisible = (S: StavBoje, dm: boolean, x: number, y: number) => dm || fogState(S.fog, x, y) === "visible";
export function movementOverlay(S: StavBoje, map: BattleMapData, id: string, dm: boolean) {
  const visible = overlayState(S, dm);
  const state = { ...visible, eco: { ...visible.eco }, tok: visible.tok.map(t => ({ ...t })) }, t = state.tok.find(t => t.id === id);
  if (!t) return [];
  const remaining = moveLeft(state, t);
  const dash = state.eco[t.id]?.a ? 0 : Math.max(speedOf(t), flySpeedOf(t));
  return Object.entries(movementCosts(state, map, t, remaining + dash, settingsOf(state)))
    .flatMap(([key, cost]) => {
      const [x, y] = key.split(",").map(Number);
      return cost > 0 && cellsOf(t, x, y).every(([cx, cy]) => overlayCellVisible(state, dm, cx, cy)) ? [{ x, y, cost, dash: cost > remaining }] : [];
    });
}
function reactors(S: StavBoje, t: Token) {
  return S.tok.filter(h => hostile(t, h) && !h.dead && !isIncap(h) && h.react !== false && !S.eco[h.id]?.r);
}
function disengaged(S: StavBoje, t: Token) {
  return !!S.eco[t.id]?.disengage || t.effects.some(e => e.mods?.noOA) || settingsOf(S).pohyb.oa === "vypnuto";
}
export function provokingPathCells(S: StavBoje, t: Token, path: [number, number][]) {
  return path.flatMap((_, i) => i + 1 < path.length && oaAlong(t, [path[i], path[i + 1]], reactors(S, t), disengaged(S, t)).length ? [i] : []);
}
export function reachCells(S: StavBoje, map: BattleMapData, t: Token, dm: boolean) {
  if (!overlayState(S, dm).tok.some(token => token.id === t.id)) return [];
  if (t.x == null || t.y == null || t.dead) return [];
  const { W, H } = mapSize(map), radius = Math.ceil(meleeReach(t) / 5), cells: [number, number][] = [];
  for (let y = Math.max(0, t.y - radius); y < Math.min(H, t.y + t.s + radius); y++)
    for (let x = Math.max(0, t.x - radius); x < Math.min(W, t.x + t.s + radius); x++)
      if (gapFt({ x, y, s: 1 }, t) > 0 && gapFt({ x, y, s: 1 }, t) <= meleeReach(t) && overlayCellVisible(S, dm, x, y)) cells.push([x, y]);
  return cells;
}
export function threatCells(S: StavBoje, map: BattleMapData, id: string, dm: boolean) {
  const state = overlayState(S, dm), t = state.tok.find(t => t.id === id);
  if (!t || disengaged(state, t)) return [];
  const cells = new Map<string, [number, number]>(), { W, H } = mapSize(map);
  for (const h of reactors(state, t)) {
    if (h.x == null || h.y == null) continue;
    const radius = Math.ceil(meleeReach(h) / 5) + t.s;
    for (let y = Math.max(0, h.y - radius); y < Math.min(H - t.s + 1, h.y + h.s + radius); y++)
      for (let x = Math.max(0, h.x - radius); x < Math.min(W - t.s + 1, h.x + h.s + radius); x++) {
        if (!cellsOf(t, x, y).every(([cx, cy]) => overlayCellVisible(state, dm, cx, cy))) continue;
        const exits = [-1, 0, 1].some(dx => [-1, 0, 1].some(dy => oaAlong(t, [[x, y], [x + dx, y + dy]], [h], false).length));
        if (exits) cells.set(`${x},${y}`, [x, y]);
      }
  }
  return [...cells.values()];
}

export interface LabelBox { id: string; x: number; y: number; width: number; height: number; priority: number }
export const labelsOverlap = (a: LabelBox, b: LabelBox) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export function layoutLabels(labels: LabelBox[], gap: number, bounds?: { left: number; right: number; top: number; bottom: number }): LabelBox[] {
  const placed: LabelBox[] = [];
  for (const label of [...labels].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))) {
    if (bounds && (label.width > bounds.right - bounds.left || label.height > bounds.bottom - bounds.top)) continue;
    for (let row = 0; row < labels.length * 2 + 1; row++) {
      const y = label.y + (row % 2 ? -1 : 1) * Math.ceil(row / 2) * (label.height + gap);
      const box = { ...label, x: bounds ? Math.max(bounds.left, Math.min(label.x, bounds.right - label.width)) : label.x, y };
      if (bounds && (y < bounds.top || y + label.height > bounds.bottom)) continue;
      if (placed.every(p => !labelsOverlap({ ...box, x: box.x - gap / 2, y: box.y - gap / 2, width: box.width + gap, height: box.height + gap }, p))) { placed.push(box); break; }
    }
  }
  return placed;
}

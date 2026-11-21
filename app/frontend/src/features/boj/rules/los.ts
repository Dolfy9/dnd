/* Line of sight a cover: 0 = žádný, 2 = half (+2 AC), 3 = three-quarters (+5), 9 = total.
   Port coverOf z boj.js s čistými vstupy. */
import type { BattleMapData, Token } from "../types";
import { cellsOf, occupantAt, tileAt, tileDef, type TerenMap } from "./grid";

export type Cover = 0 | 2 | 3 | 9;
export const COVER_BONUS: Record<Cover, number> = { 0: 0, 2: 2, 3: 5, 9: 0 };
export const COVER_TEXT: Record<Cover, string> = {
  0: "bez krytu", 2: "Half Cover (+2 AC)", 3: "Three-Quarters Cover (+5 AC)", 9: "Total Cover",
};

function lineVal(map: BattleMapData, tokens: Token[], x0: number, y0: number, x1: number, y1: number, skip: Record<string, 1>, teren?: TerenMap): number {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len * 8));
  let v = 0;
  for (let i = 1; i < n; i++) {
    const px = x0 + ((x1 - x0) * i) / n, py = y0 + ((y1 - y0) * i) / n;
    const cx = Math.floor(px), cy = Math.floor(py), key = `${cx},${cy}`;
    if (skip[key]) continue;
    const c = tileAt(map, cx, cy, teren);
    if (c === "#") return 9;
    const cov = tileDef(c).cover || 0;
    if (cov) v = Math.max(v, cov);
    if (occupantAt(tokens, cx, cy)) v = Math.max(v, 2);
  }
  return v;
}

/** Cover cíle `b` proti útočníku `a` stojícímu na (ax,ay) nebo na své pozici. */
export function coverOf(a: Token, b: Token, map: BattleMapData, tokens: Token[], ax?: number, ay?: number, teren?: TerenMap): Cover {
  const px = ax ?? a.x ?? 0, py = ay ?? a.y ?? 0;
  const skip: Record<string, 1> = {};
  cellsOf(a, px, py).concat(cellsOf(b)).forEach(([x, y]) => { skip[`${x},${y}`] = 1; });
  const e = 0.04;
  const ac = [
    [px + e, py + e], [px + a.s - e, py + e],
    [px + e, py + a.s - e], [px + a.s - e, py + a.s - e],
  ];
  const bx = b.x ?? 0, by = b.y ?? 0;
  const tc = [
    [bx + e, by + e], [bx + b.s - e, by + e],
    [bx + e, by + b.s - e], [bx + b.s - e, by + b.s - e],
  ];
  let best: Cover = 9;
  for (const p of ac) {
    const vals = tc.map((q) => lineVal(map, tokens, p[0], p[1], q[0], q[1], skip, teren));
    let c: Cover;
    if (vals.every((v) => v === 9)) c = 9;
    else {
      const nb = vals.filter((v) => v > 0).length;
      // jsou-li všechny rohy zastíněné jen half-cover překážkami/bytostmi → Half Cover
      c = (nb >= 3 ? (vals.every((v) => v > 0 && v <= 2) ? 2 : 3) : nb >= 1 ? 2 : 0) as Cover;
    }
    if (c < best) best = c;
    if (!best) break;
  }
  return best;
}

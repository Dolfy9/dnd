/* Mřížka: políčka, obsazenost, vzdálenost (2024: Chebyshev, hrana k hraně),
   Dijkstra pohyb (těžký terén ×2, zóny, letectví/plavání), Opportunity Attacks. */
import { TILES, type Token, type Zone, type BattleMapData } from "../types";
import { isIncap } from "./conditions";
import { deckAt, deckCoversStep, mapWalls } from "../model/mapRoutes";
import { cellInfo, edgeBlocked, wallIndex, type DoorStates } from "../model/mapV2";

export type TerenMap = Record<string, string> | undefined | null;

/** Efektivní dlaždice: override z `teren` (namalované) předchází `mrizka`. */
export const tileAt = (map: BattleMapData, x: number, y: number, teren?: TerenMap): string => {
  const o = teren?.[`${x},${y}`];
  if (o) return "~_".includes(o)&&deckAt(map,x,y)?".":o;
  const m = map.mrizka;
  const c=m && y >= 0 && y < m.length && x >= 0 && x < m[y].length ? m[y][x] : "#";
  return "~_".includes(c)&&deckAt(map,x,y)?".":c;
};

export const tileDef = (c: string) => TILES[c] || TILES["."];

export const mapSize = (map: BattleMapData) => ({
  W: map.mrizka[0]?.length || 0,
  H: map.mrizka.length || 0,
});

/** Buňky, které žeton zabírá. */
export function cellsOf(t: { s: number; x?: number | null; y?: number | null }, x?: number, y?: number): [number, number][] {
  const px = x ?? t.x ?? 0, py = y ?? t.y ?? 0;
  const out: [number, number][] = [];
  for (let i = 0; i < t.s; i++) for (let j = 0; j < t.s; j++) out.push([px + i, py + j]);
  return out;
}

/** Vzdálenost hrana–hrana ve ft (2024: každý čtverec 5 ft, diagonály rovné). */
export function gapFt(a: { s: number; x: number | null; y: number | null }, b: { s: number; x: number | null; y: number | null }, ax?: number, ay?: number): number {
  const px = ax ?? a.x ?? 0, py = ay ?? a.y ?? 0;
  const bx = b.x ?? 0, by = b.y ?? 0;
  const dx = Math.max(0, bx - (px + a.s - 1), px - (bx + b.s - 1));
  const dy = Math.max(0, by - (py + a.s - 1), py - (by + b.s - 1));
  return Math.max(dx, dy) * 5;
}

export const hostile = (a: Pick<Token, "side">, b: Pick<Token, "side">): boolean =>
  a.side !== b.side && a.side !== "neutral" && b.side !== "neutral";

export function occupantAt(tokens: Token[], x: number, y: number, except?: Token): Token | undefined {
  return tokens.find((t) => t !== except && t.x != null && !t.dead &&
    x >= t.x && x < t.x + t.s && y >= t.y! && y < t.y! + t.s);
}

/** Zóny těžkého terénu na buňce. */
export const zoneDifficultAt = (zones: Zone[], x: number, y: number): boolean =>
  zones.some((z) => z.difficult && zoneCovers(z, x, y));

/** Kryje zóna danou buňku? (pro Dijkstra/triggery; anchor = levý horní roh pro rect) */
export function zoneCovers(z: Zone, x: number, y: number): boolean {
  const { kind, size, w, h } = z.shape;
  const [ax, ay] = z.anchor;
  const r = size / 5;
  switch (kind) {
    case "rect": return x >= ax && x < ax + (w || 1) && y >= ay && y < ay + (h || 1);
    case "sphere": case "cylinder": {
      const cx = ax + 0.5, cy = ay + 0.5;
      return Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r + 0.001;
    }
    case "cube": {
      const half = Math.ceil(r / 2);
      return Math.abs(x - ax) <= half - 1 + 0.001 || (x >= ax - half && x <= ax + half && y >= ay - half && y <= ay + half);
    }
    case "emanation": return false; // řeší se přes token v efektech
    default: return Math.hypot(x + 0.5 - (ax + 0.5), y + 0.5 - (ay + 0.5)) <= r + 0.001;
  }
}

/** Cena vstupu žetonu `t` na pozici (x,y): nejhorší z jeho buněk. Infinity = neprůchodné. */
export function stepCost(t: Token, x: number, y: number, map: BattleMapData, tokens: Token[], zones: Zone[] = [], teren?: TerenMap): number {
  let worst = 1;
  for (const [cx, cy] of cellsOf(t, x, y)) {
    const c = tileAt(map, cx, cy, teren), def = tileDef(c);
    if (c === "_" && !t.fly) return Infinity;
    if (!def.cost && c !== "_") return Infinity;
    if (def.cost && cellInfo(map,cx,cy,teren).blocksMove) return Infinity;
    let k = def.cost || 1;
    if (c === "~" && t.swim) k = 1;
    if (t.fly && "^,%~_".includes(c)) k = 1;
    if (zoneDifficultAt(zones, cx, cy)) k = Math.max(k, 2);
    const o = occupantAt(tokens, cx, cy, t);
    if (o) {
      if (hostile(t, o) && Math.abs(o.s - t.s) < 2 && !isIncap(o)) return Infinity;
      k = Math.max(k, 2);
    }
    worst = Math.max(worst, k);
  }
  return worst;
}

export const canEndAt = (t: Token, x: number, y: number, map: BattleMapData, tokens: Token[], zones: Zone[] = [], teren?: TerenMap): boolean =>
  cellsOf(t, x, y).every(([cx, cy]) => !occupantAt(tokens, cx, cy, t)) &&
  stepCost(t, x, y, map, tokens, zones, teren) < Infinity;

export interface ReachResult {
  dist: Record<string, number>;
  prev: Record<string, string>;
  path: (x: number, y: number) => [number, number][];
}

/** Dijkstra po buňkách; limit ve ft. */
export function reachable(t: Token, limitFt: number, map: BattleMapData, tokens: Token[], zones: Zone[] = [], teren?: TerenMap, doors?: DoorStates): ReachResult {
  const wIdx = wallIndex(mapWalls(map));
  const { W, H } = mapSize(map);
  const dist: Record<string, number> = {}, prev: Record<string, string> = {};
  const key = (x: number, y: number) => `${x},${y}`;
  const q: [number, number, number][] = [[0, t.x ?? 0, t.y ?? 0]];
  dist[key(t.x ?? 0, t.y ?? 0)] = 0;
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]);
    const [c, x, y] = q.shift()!;
    if (c > (dist[key(x, y)] ?? Infinity)) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx + t.s > W || ny + t.s > H) continue;
      if (dx && dy && !tileDef(tileAt(map, x + dx, y, teren)).cost && !tileDef(tileAt(map, x, y + dy, teren)).cost && !cellsOf(t,x,y).every(([cx,cy])=>deckCoversStep(map,cx,cy,cx+dx,cy+dy))) continue;
      if (wIdx.size && edgeBlocked(wIdx, x, y, nx, ny, doors)) continue;   // hranová zeď/dveře
      const sc = stepCost(t, nx, ny, map, tokens, zones, teren);
      if (sc === Infinity) continue;
      const nc = c + sc * 5;
      if (nc > limitFt) continue;
      const k = key(nx, ny);
      if (dist[k] == null || nc < dist[k]) { dist[k] = nc; prev[k] = key(x, y); q.push([nc, nx, ny]); }
    }
  }
  return {
    dist, prev,
    path(x, y) {
      const p: [number, number][] = [];
      let c: string | undefined = key(x, y);
      while (c) { p.unshift(c.split(",").map(Number) as [number, number]); c = prev[c]; }
      return p;
    },
  };
}

/** Melee dosah žetonu (max z jeho melee útoků). */
export const meleeReach = (t: Token): number =>
  Math.max(5, ...t.atk.filter((a) => a.melee).map((a) => a.reach || 5));

/** Protivníci, kteří dostanou OA při průchodu `t` po `path` (bez Disengage). */
export function oaAlong(t: Token, path: [number, number][], tokens: Token[], disengaged: boolean): Token[] {
  if (disengaged) return [];
  const out: Token[] = [];
  for (const h of tokens) {
    if (h === t || h.x == null || h.dead || !hostile(t, h) || isIncap(h) || h.react === false) continue;
    const r = meleeReach(h);
    for (let i = 1; i < path.length; i++) {
      if (gapFt(t, h, path[i - 1][0], path[i - 1][1]) <= r && gapFt(t, h, path[i][0], path[i][1]) > r) {
        out.push(h); break;
      }
    }
  }
  return out;
}

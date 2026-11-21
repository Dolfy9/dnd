/* Movement planner — čistý modul pro drag&drop i klávesnici.
   Režimy: pravidla (Dijkstra bez capu → overFt), dash, prekrocit (DM),
   nuceny (forced move — bez pohybu, bez OA, ne projde zdí), teleport.
   Úhlopříčky 5 ft (2024) nebo střídavě 5/10 ft (DMG varianta). */
import type { StavBoje, Token, BattleMapData, BattleSettings, MoveMode, Zone } from "../types";
import { mapSize, tileAt, tileDef, cellsOf, occupantAt, hostile, zoneCovers, oaAlong } from "./grid";
import { isIncap } from "./conditions";
import { moveLeft, ecoOf } from "./turn";

export interface MovementPlan {
  mode: MoveMode;
  path: [number, number][];
  ft: number;
  limitFt: number;
  overFt: number;
  withinLimit: boolean;
  dashFits: boolean;
  actionFree: boolean;
  blocked: null | "zed" | "obsazeno" | "mimo_mapu";
  farthest?: [number, number];
  oas: string[];           // názvy provokujících
  oaIds: string[];         // id provokujících (quick-resolve)
  zonesEntered: string[];  // id zón, do kterých cesta vstoupí
  spendsMovement: boolean;
  provokesOA: boolean;
}

const spd = (t: Token) => t.speedOverride ?? t.speed;

/** stepCost s volitelným průchodem nepřáteli a nuceným režimem (cena vždy 1). */
function stepCostM(t: Token, x: number, y: number, map: BattleMapData, tokens: Token[], zones: Zone[], teren: StavBoje["teren"], passHostile: boolean, forced: boolean): number {
  let worst = 1;
  for (const [cx, cy] of cellsOf(t, x, y)) {
    const c = tileAt(map, cx, cy, teren), def = tileDef(c);
    if (c === "_" && !t.fly) return Infinity;
    if (!def.cost && c !== "_") return Infinity;
    let k = forced ? 1 : (def.cost || 1);
    if (c === "~" && t.swim) k = 1;
    if (t.fly && "^,%~_".includes(c)) k = 1;
    const o = occupantAt(tokens, cx, cy, t);
    if (o) {
      if (hostile(t, o) && Math.abs(o.s - t.s) < 2 && !isIncap(o)) {
        if (!passHostile) return Infinity;
        k = Math.max(k, 2);
      } else if (!hostile(t, o)) k = Math.max(k, 2);
    }
    worst = Math.max(worst, k);
  }
  return worst;
}

interface DijkstraRes {
  dist: Map<string, number>;
  prev: Map<string, string>;
}

/** Dijkstra bez limitu; stav = "x,y,p" (p = parita úhlopříček pro 5-10 variant). */
function dijkstra(t: Token, from: [number, number], map: BattleMapData, S: StavBoje, diag: string, passHostile: boolean, forced: boolean): DijkstraRes {
  const { W, H } = mapSize(map);
  const alt = diag === "5-10";
  const key = (x: number, y: number, p: number) => `${x},${y},${p}`;
  const dist = new Map<string, number>(), prev = new Map<string, string>();
  const start = key(from[0], from[1], 0);
  dist.set(start, 0);
  const q: [number, number, number, number][] = [[0, from[0], from[1], 0]];
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]);
    const [c, x, y, p] = q.shift()!;
    if (c > (dist.get(key(x, y, p)) ?? Infinity)) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx + t.s > W || ny + t.s > H) continue;
      if (dx && dy && !tileDef(tileAt(map, x + dx, y, S.teren)).cost && !tileDef(tileAt(map, x, y + dy, S.teren)).cost) continue;
      const sc = stepCostM(t, nx, ny, map, S.tok, S.zones, S.teren, passHostile, forced);
      if (sc === Infinity) continue;
      const diagStep = !!(dx && dy);
      const np = alt && diagStep ? 1 - p : p;
      const stepFt = diagStep && alt ? (p === 0 ? 5 : 10) : 5;
      const nc = c + sc * stepFt;
      const k = key(nx, ny, np);
      if (nc < (dist.get(k) ?? Infinity)) { dist.set(k, nc); prev.set(k, key(x, y, p)); q.push([nc, nx, ny, np]); }
    }
  }
  return { dist, prev };
}

/** Nejsledovanější klíč pro cíl [x,y] — vezme libovolnou paritu. */
function bestKey(r: DijkstraRes, x: number, y: number): string | null {
  let best: string | null = null, bd = Infinity;
  for (const p of [0, 1]) {
    const d = r.dist.get(`${x},${y},${p}`);
    if (d != null && d < bd) { bd = d; best = `${x},${y},${p}`; }
  }
  return best;
}

function pathTo(r: DijkstraRes, k: string): { path: [number, number][]; ft: number } {
  const p: [number, number][] = [];
  let c: string | undefined = k;
  while (c) { const [x, y] = c.split(",").map(Number); p.unshift([x, y]); c = r.prev.get(c); }
  return { path: p, ft: r.dist.get(k) ?? 0 };
}

/** Buňka dosažitelné cesty nejblíž cíli (pro "zed" hlášení). */
function farthestCell(r: DijkstraRes, tx: number, ty: number): [number, number] {
  let best: [number, number] = [tx, ty], bd = Infinity, bg = -1;
  for (const k of r.dist.keys()) {
    const [x, y] = k.split(",").map(Number);
    const d = r.dist.get(k)!;
    const gap = Math.abs(x - tx) + Math.abs(y - ty);
    if (gap < bd || (gap === bd && d < bg)) { bd = gap; bg = d; best = [x, y]; }
  }
  return best;
}

/** Zóny, do kterých cesta vstoupí (jen nové krytí oproti startu). */
function zonesEntered(S: StavBoje, t: Token, path: [number, number][]): string[] {
  const inAt = new Set<string>();
  for (const [cx, cy] of cellsOf(t)) for (const z of S.zones) if (zoneCovers(z, cx, cy)) inAt.add(z.id);
  const out: string[] = [];
  const seen = new Set(inAt);
  for (const [x, y] of path) for (const [cx, cy] of cellsOf(t, x, y))
    for (const z of S.zones) if (!seen.has(z.id) && zoneCovers(z, cx, cy)) { seen.add(z.id); out.push(z.id); }
  return out;
}

/** Kumulativní ft na každém indexu `path` (pro zelený/jantarový preview split). */
export function cumFt(t: Token, path: [number, number][], map: BattleMapData, S: StavBoje, settings: BattleSettings): number[] {
  const alt = settings.pohyb.uhlopricky === "5-10";
  const pass = settings.pohyb.pruchodNepratel === "povolit";
  const out: number[] = [0];
  let cum = 0, diagN = 0;
  for (let i = 1; i < path.length; i++) {
    const [px, py] = path[i - 1], [nx, ny] = path[i];
    const diag = px !== nx && py !== ny;
    const sc = stepCostM(t, nx, ny, map, S.tok, S.zones, S.teren, pass, false);
    const stepFt = diag && alt ? (diagN % 2 === 0 ? 5 : 10) : 5;
    if (diag) diagN++;
    cum += (sc === Infinity ? 1 : sc) * stepFt;
    out.push(cum);
  }
  return out;
}

export function planMovement(
  S: StavBoje, map: BattleMapData, t: Token,
  waypoints: [number, number][], target: [number, number],
  mode: MoveMode, settings: BattleSettings,
): MovementPlan {
  const { W, H } = mapSize(map);
  const set = settings.pohyb;
  const limitFt = moveLeft(S, t);
  const e = ecoOf(S, t);
  const actionFree = !e.a;
  // mimo mapu
  if (target[0] < 0 || target[1] < 0 || target[0] + t.s > W || target[1] + t.s > H)
    return { mode, path: [], ft: 0, limitFt, overFt: 0, withinLimit: false, dashFits: false, actionFree, blocked: "mimo_mapu", oas: [], oaIds: [], zonesEntered: [], spendsMovement: false, provokesOA: false };

  // teleport
  if (mode === "teleport") {
    const occ = cellsOf(t, target[0], target[1]).some(([cx, cy]) => occupantAt(S.tok, cx, cy, t));
    const outB = cellsOf(t, target[0], target[1]).some(([cx, cy]) => cx < 0 || cy < 0 || cx >= W || cy >= H);
    const blocked = outB ? "mimo_mapu" : occ ? "obsazeno" : null;
    return { mode, path: [target], ft: 0, limitFt, overFt: 0, withinLimit: true, dashFits: false, actionFree,
             blocked, oas: [], oaIds: [], zonesEntered: set.zonyPriPresunuDM ? zonesEntered(S, t, [target]) : [],
             spendsMovement: false, provokesOA: false };
  }

  const forced = mode === "nuceny";
  const passHostile = set.pruchodNepratel === "povolit" || forced;
  const pts = [...waypoints, target];
  const path: [number, number][] = [];
  let ft = 0, blocked: MovementPlan["blocked"] = null, farthest: [number, number] | undefined;

  // segmentová Dijkstra přes waypointy
  let cur: [number, number] = [t.x ?? 0, t.y ?? 0];
  for (const pt of pts) {
    const r = dijkstra(t, cur, map, S, set.uhlopricky, passHostile, forced);
    const k = bestKey(r, pt[0], pt[1]);
    if (!k) {
      // cíl nedosažitelný → rozhodni důvod
      const occ = cellsOf(t, pt[0], pt[1]).some(([cx, cy]) => occupantAt(S.tok, cx, cy, t));
      blocked = occ ? "obsazeno" : "zed";
      farthest = farthestCell(r, pt[0], pt[1]);
      break;
    }
    const seg = pathTo(r, k);
    ft += seg.ft;
    path.push(...(path.length ? seg.path.slice(1) : seg.path));
    cur = pt;
  }
  if (blocked == null) {
    // je koncová buňka legální pro zastavení?
    const occ = cellsOf(t, target[0], target[1]).some(([cx, cy]) => occupantAt(S.tok, cx, cy, t));
    if (occ) { blocked = "obsazeno"; farthest = path.length > 1 ? path[path.length - 2] : undefined; }
  }

  const dis = !!e.disengage || S.tok.some((x) => x.id === t.id && x.effects?.some((ef) => ef.mods?.noOA));
  const oaT = forced || blocked ? [] : oaAlong(t, path, S.tok, dis || set.oa === "vypnuto");
  const overFt = Math.max(0, ft - limitFt);
  const dashFits = !blocked && ft <= limitFt + spd(t) && actionFree;
  return {
    mode, path, ft, limitFt, overFt, withinLimit: !blocked && overFt <= 0, dashFits, actionFree,
    blocked, farthest, oas: oaT.map((h) => h.nazev), oaIds: oaT.map((h) => h.id),
    zonesEntered: blocked || (forced && !set.zonyPriPresunuDM) ? [] : zonesEntered(S, t, path),
    spendsMovement: !forced && !blocked,
    provokesOA: !forced && oaT.length > 0,
  };
}

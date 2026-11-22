/* Sdílený model bojové mapy v2 — používá ho i editor map i bojovník.
   Zpětně kompatibilní: staré mapy (jen `mrizka`) fungují beze změny;
   `migrateMap()` jen doplní výchozí struktury, mechanika se nemění. */
import type { BattleMapData } from "../types";

/* ---------- v2 rozšíření ---------- */

export type WallTyp = "wall" | "door" | "window" | "secret" | "half" | "curtain";

/** Úsečka zdi; souřadnice v buňkách, bez omezení úhlu. */
export interface MapWall {
  id: string;
  a: [number, number];
  b: [number, number];
  typ: WallTyp;
  open?: boolean;            // výchozí stav dveří
  locked?: boolean;
}

/** Objekt na mapě (stamp / vlastní obrázek). x,y = střed v buňkách (float). */
export interface MapObject {
  id: string;
  asset: string;             // id z knihovny nebo "img:<cesta>"
  x: number; y: number;
  w: number; h: number;      // velikost v buňkách
  rot?: number;              // stupně
  flip?: boolean;
  z?: number;
  tint?: string;
  blocks?: boolean;          // blokuje pohyb
  cover?: 2 | 3;             // krytí, které poskytuje
  difficult?: boolean;       // těžký terén
  light?: { bright: number; dim: number };
  dmOnly?: boolean;
}

export interface MapDrawing {
  id: string;
  kind: "free" | "line" | "rect" | "ellipse" | "poly" | "text";
  pts: [number, number][];   // body v buňkách
  stroke: string;
  fill?: string;
  width: number;             // px on-screen-ish (v buňkových jednotkách ×24)
  text?: string;
  size?: number;
  dmOnly?: boolean;
}

export interface MapLightV2 {
  id: string;
  x: number; y: number;
  bright: number; dim: number;
  nazev?: string;
  color?: string;
  intenzita?: number;
  blikani?: boolean;
}

export interface MapPaintStroke {
  id: string;
  t: string;
  b: number;
  o: number;
  h: number;
  r?: number;
  poly?: boolean;
  p: [number, number][];
}

export interface MapNote {
  id: string;
  x: number; y: number;
  text: string;
}

export interface MapKalibrace { cellPx: number; offX: number; offY: number }
export interface MapMrizkaStyl { typ: "lines" | "dots" | "none"; barva: string; opacita: number }

/** Plná v2 mapa = BattleMapData + volitelná pole. */
export interface MapV2 extends BattleMapData {
  malba?: MapPaintStroke[];
  atmosfera?: { amb: number; barva: string };
  textury?: Record<string, string>;          // "x,y" → textureId
  vyska?: Record<string, number>;            // "x,y" → ft
  steny?: MapWall[];
  objekty?: MapObject[];
  kresby?: MapDrawing[];
  svetla?: MapLightV2[];
  poznamky?: MapNote[];
  mrizkaStyl?: MapMrizkaStyl;
  kalibrace?: MapKalibrace;
}

export const wallUid = () => "w" + Math.random().toString(36).slice(2, 9);

/** Převede libovolný vstup na MapV2 s vyplněnými defaulty. Staré mapy projdou beze změny mechaniky. */
export function migrateMap(m: BattleMapData | MapV2 | any): MapV2 {
  const out: MapV2 = { ...(m as MapV2) };
  if (!out.mrizka) out.mrizka = ["...."];
  const finite = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  if (out.malba !== undefined) {
    out.malba = (Array.isArray(out.malba) ? out.malba : []).filter(s => s && typeof s.t === "string" && Array.isArray(s.p))
      .map((s, i) => ({ id: typeof s.id === "string" ? s.id : "malba" + i, t: s.t,
        b: finite(s.b, 1, .25, 8), o: finite(s.o, 1, 0, 1), h: finite(s.h, .5, 0, 1),
        ...(s.r !== undefined ? { r: finite(s.r, 0, -360000, 360000) } : {}),
        ...(s.poly === true ? { poly: true } : {}),
        p: s.p.filter(p => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === "number" && Number.isFinite(n))) }))
      .filter(s => s.p.length);
  }
  if (out.atmosfera !== undefined) {
    const a = out.atmosfera;
    out.atmosfera = { amb: finite(a?.amb, 1, 0, 1),
      barva: typeof a?.barva === "string" && /^#[0-9a-f]{6}$/i.test(a.barva) ? a.barva : "#101522" };
  }
  if (out.textury && typeof out.textury !== "object") delete out.textury;
  if (out.vyska && typeof out.vyska !== "object") delete out.vyska;
  if (Array.isArray(out.svetla)) out.svetla = out.svetla.filter(l => l && typeof l === "object");
  for (const k of ["steny", "objekty", "kresby", "svetla", "poznamky"] as const) {
    if (out[k] && !Array.isArray(out[k])) delete out[k];
    (out[k] as any[] | undefined)?.forEach((o: any, i: number) => { if (!o.id) o.id = `${k[0]}${i}`; });
  }
  // normalizace zdí na unit segmenty
  if (out.svetla) out.svetla = out.svetla.filter(l => l && typeof l === "object").map(l => ({
    ...l, intenzita: finite(l.intenzita, 1, 0, 1), blikani: l.blikani === true,
  }));
  if (out.steny) {
    const norm: MapWall[] = [];
    for (const w of out.steny) {
      const segs = unitWallSegs(w);
      norm.push(...segs.map((s, i) => ({ ...w, ...s, id: segs.length > 1 ? `${w.id}-${i}` : w.id })));
    }
    out.steny = norm;
  }
  return out;
}

/** Celočíselné osové zdi zachovávají starý unit index; ostatní zůstanou přesné. */
export function unitWallSegs(w: Pick<MapWall, "a" | "b"> & Partial<Pick<MapWall, "typ">>): { a: [number, number]; b: [number, number] }[] {
  const [ax, ay] = w.a, [bx, by] = w.b;
  if (![ax, ay, bx, by].every(Number.isFinite) || (ax === bx && ay === by)) return [];
  if (w.typ === "door" || ![ax, ay, bx, by].every(Number.isInteger) || (ax !== bx && ay !== by)) return [{ a: [...w.a], b: [...w.b] }];
  const out: { a: [number, number]; b: [number, number] }[] = [];
  if (ax === bx) {
    const [y0, y1] = ay < by ? [ay, by] : [by, ay];
    for (let y = y0; y < y1; y++) out.push({ a: [ax, y], b: [ax, y + 1] });
  } else if (ay === by) {
    const [x0, x1] = ax < bx ? [ax, bx] : [bx, ax];
    for (let x = x0; x < x1; x++) out.push({ a: [x, ay], b: [x + 1, ay] });
  }
  return out;
}

/* ---------- geometrie stěn ---------- */

const key2 = (x: number, y: number) => `${x},${y}`;
const freeWallCache = new WeakMap<Map<string, MapWall>, MapWall[]>();
const isGridWall = (w: MapWall) => [...w.a, ...w.b].every(Number.isInteger) &&
  Math.abs(w.a[0]-w.b[0]) + Math.abs(w.a[1]-w.b[1]) === 1;

export function segmentsIntersect(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const cross = (p: number[], q: number[], r: number[]) => (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const on = (p: number[], q: number[], r: number[]) => Math.abs(cross(p,q,r)) < 1e-9 &&
    r[0] >= Math.min(p[0],q[0])-1e-9 && r[0] <= Math.max(p[0],q[0])+1e-9 &&
    r[1] >= Math.min(p[1],q[1])-1e-9 && r[1] <= Math.max(p[1],q[1])+1e-9;
  return (cross(a,b,c)*cross(a,b,d) < 0 && cross(c,d,a)*cross(c,d,b) < 0) ||
    on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b);
}

export function crossedFreeWalls(idx: Map<string, MapWall>, a: [number, number], b: [number, number]): MapWall[] {
  const walls = freeWallCache.get(idx) || [...idx.values()].filter(w => !isGridWall(w));
  return walls.filter(w => segmentsIntersect(a, b, w.a, w.b));
}

/** Rychlý index stěn podle jejich hrany (sjednocený klíč rohů). */
export function wallIndex(steny?: MapWall[]): Map<string, MapWall> {
  const m = new Map<string, MapWall>();
  for (const w of steny || []) m.set(edgeKey(w.a, w.b), w);
  freeWallCache.set(m, (steny || []).filter(w => !isGridWall(w)));
  return m;
}
export const edgeKey = (a: [number, number], b: [number, number]) =>
  a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? key2(a[0], a[1]) + "|" + key2(b[0], b[1]) : key2(b[0], b[1]) + "|" + key2(a[0], a[1]);

/** Hrana mezi dvěma sousedními (ortogonálně) buňkami. */
export function edgeBetween(x: number, y: number, nx: number, ny: number): { a: [number, number]; b: [number, number] } | null {
  if (nx === x + 1 && ny === y) return { a: [x + 1, y], b: [x + 1, y + 1] };
  if (nx === x - 1 && ny === y) return { a: [x, y], b: [x, y + 1] };
  if (ny === y + 1 && nx === x) return { a: [x, y + 1], b: [x + 1, y + 1] };
  if (ny === y - 1 && nx === x) return { a: [x, y], b: [x + 1, y] };
  return null;
}

export type DoorStates = Record<string, boolean> | undefined; // wallId → open (S.dvere)

const isOpenDoor = (w: MapWall, doors: DoorStates) =>
  w.typ === "door" && (doors?.[w.id] ?? w.open);

/** Blokuje zeď pohyb mezi buňkami a→b? (window/half/wall/door-closed/secret ano; open door/curtain ne) */
export function wallBlocksMove(w: MapWall | undefined, doors: DoorStates): boolean {
  if (!w) return false;
  if (w.typ === "door") return !isOpenDoor(w, doors);
  if (w.typ === "curtain") return false;
  return true; // wall, window, secret, half
}

/** Blokuje zeď výhled? (wall, closed door, secret, curtain ano; window/half/open ne) */
export function wallBlocksSight(w: MapWall | undefined, doors: DoorStates): boolean {
  if (!w) return false;
  if (w.typ === "door") return !isOpenDoor(w, doors);
  return w.typ === "wall" || w.typ === "secret" || w.typ === "curtain";
}

/** Zeď na hraně mezi dvěma ortogonálně sousedními buňkami (nebo undefined). */
export function wallBetweenCells(idx: Map<string, MapWall>, x: number, y: number, nx: number, ny: number): MapWall | undefined {
  const e = edgeBetween(x, y, nx, ny);
  return e ? idx.get(edgeKey(e.a, e.b)) : undefined;
}

/** Je krok a→b (i diagonálně) zablokován hranovou zdí? Diagonála: obě ortogonální hrany zablokované. */
export function edgeBlocked(idx: Map<string, MapWall>, x: number, y: number, nx: number, ny: number, doors: DoorStates): boolean {
  if (crossedFreeWalls(idx, [x+.5,y+.5], [nx+.5,ny+.5]).some(w => wallBlocksMove(w, doors))) return true;
  if (nx === x || ny === y) {
    const w = wallBetweenCells(idx, x, y, nx, ny);
    return wallBlocksMove(w, doors);
  }
  // diagonála: nelze protáhnout rohem — blok, když je KTERÁKOLIV z přiléhajících
  // hran zdí (stejné chování jako Foundry walls u souvislé zdi)
  const w1 = wallBlocksMove(wallBetweenCells(idx, x, y, nx, y), doors);
  const w2 = wallBlocksMove(wallBetweenCells(idx, x, y, x, ny), doors);
  return w1 || w2;
}

/** Blokuje hranová zeď diagonální průchod pro výhled mezi dvěma buňkami? */
export function edgeBlocksSight(idx: Map<string, MapWall>, x: number, y: number, nx: number, ny: number, doors: DoorStates, skipFree = false): boolean {
  if (!skipFree && crossedFreeWalls(idx, [x+.5,y+.5], [nx+.5,ny+.5]).some(w => wallBlocksSight(w, doors))) return true;
  if (nx === x || ny === y) return wallBlocksSight(wallBetweenCells(idx, x, y, nx, ny), doors);
  const w1 = wallBlocksSight(wallBetweenCells(idx, x, y, nx, y), doors);
  const w2 = wallBlocksSight(wallBetweenCells(idx, x, y, x, ny), doors);
  return w1 || w2;
}

/* ---------- objekty / výška ---------- */

/** Objekty pokrývající buňku (x,y) — footprint elipsa/obdélník se započítanou rotací (approx bbox). */
export function objectsAt(map: MapV2, x: number, y: number): MapObject[] {
  const out: MapObject[] = [];
  for (const o of map.objekty || []) {
    const th = ((o.rot || 0) * Math.PI) / 180;
    const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
    const w = o.w * c + o.h * s, h = o.w * s + o.h * c;
    if (x + 0.5 >= o.x - w / 2 - 0.001 && x + 0.5 <= o.x + w / 2 + 0.001 &&
        y + 0.5 >= o.y - h / 2 - 0.001 && y + 0.5 <= o.y + h / 2 + 0.001) out.push(o);
  }
  return out;
}

export const elevAt = (map: MapV2, x: number, y: number): number => map.vyska?.[`${x},${y}`] ?? 0;

/** Výškově korigovaná vzdálenost (2024-friendly): max(horizontální ft, |Δelev|). */
export function distFt(map: MapV2, ax: number, ay: number, bx: number, by: number, gridFt: number): number {
  const de = Math.abs(elevAt(map, Math.floor(ax), Math.floor(ay)) - elevAt(map, Math.floor(bx), Math.floor(by)));
  return Math.max(gridFt, de);
}

/* ---------- cellInfo: jediný zdroj pravdy pro mechaniku buňky ---------- */

export interface CellInfo {
  tile: string;
  cost: number;            // 0 = neprůchodné
  cover: number;           // 0|2|3
  difficult: boolean;
  blocksSight: boolean;    // hustý porost apod.
  blocksMove: boolean;
  elev: number;
  objects: MapObject[];
}

import { TILES, type Token } from "../types";
import { tileAt } from "../rules/grid";

/** Mechanika buňky: dlaždice + objekty + výška (zdí se řeší hranově). */
export function cellInfo(map: MapV2, x: number, y: number, teren?: Record<string, string> | null): CellInfo {
  const c = tileAt(map, x, y, teren);
  const def = TILES[c] || TILES["."];
  const objs = objectsAt(map, x, y);
  let cost = def.cost, cover = def.cover || 0, difficult = !!def.difficult, blocksMove = !def.cost;
  let blocksSight = !!def.blocksSight;
  for (const o of objs) {
    if (o.blocks) blocksMove = true;
    if (o.cover) cover = Math.max(cover, o.cover);
    if (o.difficult) difficult = true;
  }
  return {
    tile: c, cost: blocksMove ? 0 : Math.max(cost, difficult ? 2 : 1), cover, difficult,
    blocksSight, blocksMove, elev: elevAt(map, x, y), objects: objs,
  };
}

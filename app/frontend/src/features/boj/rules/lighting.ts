/* Osvětlení a vidění (2024): globální světlo z map.osvetleni, zdroje světla,
   Darkness/oblak zóny, smysly (Darkvision/Blindsight/Truesight) a verdikt
   "útočník vidí cíl" pro evaluateAttack. */
import type { BattleMapData, LightSource, StavBoje, Token, Zone } from "../types";
import { cellsOf, gapFt } from "./grid";
import { coverOf } from "./los";
import { edgeBlocksSight, wallIndex, crossedFreeWalls, wallBlocksSight } from "../model/mapV2";
import { mapWalls } from "../model/mapRoutes";
import { hasCond, isIncap } from "./conditions";
import { normalizeLight } from "../model/mapV2";
import { mechanicalLights } from "../model/sourceState";

export type LightLevel = "bright" | "dim" | "dark";

/** Volný text `osvetleni` mapy → úroveň světla. */
export function parseLightLevel(osvetleni?: string): LightLevel {
  const t = (osvetleni || "").toLowerCase();
  if (/darkness|tma|temno|beze světla|pitch/.test(t)) return "dark";
  if (/dim|šero|polotma|slabé|slabe|měkké|lucern|pochodeň|pochoden|twilight|svíčk/.test(t)) return "dim";
  return "bright";
}

export interface Senses { darkvision: number; blindsight: number; truesight: number }

/** Smysly tokenu z `smysly` (strings "Darkvision 60 ft" / "Vidění ve tmě 60 ft"…). */
export function sensesOf(t: Token): Senses {
  const s: Senses = { darkvision: 0, blindsight: 0, truesight: 0 };
  for (const raw of t.smysly || []) {
    const str = String(raw);
    const ft = Number(str.match(/(\d+)\s*(?:ft|stop|′)/)?.[1]) || 60;
    if (/truesight/i.test(str)) s.truesight = Math.max(s.truesight, ft);
    else if (/blindsight/i.test(str)) s.blindsight = Math.max(s.blindsight, ft);
    else if (/tremorsense/i.test(str)) s.blindsight = Math.max(s.blindsight, ft);
    else if (/darkvision|ve tmě|tmavé vidění/i.test(str)) s.darkvision = Math.max(s.darkvision, ft);
  }
  return s;
}

const zoneCoversCell = (z: Zone, x: number, y: number, tokens: Token[]): boolean => {
  const { kind, size, w, h } = z.shape;
  const r = size / 5;
  if (kind === "emanation") {
    const src = tokens.find((t) => t.id === z.tokenId);
    if (!src || src.x == null) return false;
    const cx = src.x + src.s / 2, cy = src.y! + src.s / 2;
    return Math.max(Math.abs(x + 0.5 - cx), Math.abs(y + 0.5 - cy)) - src.s / 2 - 0.5 <= r;
  }
  const [ax, ay] = z.anchor;
  if (kind === "rect") return x >= ax && x < ax + (w || 1) && y >= ay && y < ay + (h || 1);
  const cx = ax + 0.5, cy = ay + 0.5;
  return Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r + 0.001;
};

/** Je buňka v oblasti heavily obscured (Darkness, Fog, Wall of Fire…)? */
export const obscuredAt = (S: StavBoje, x: number, y: number): boolean =>
  (S.zones || []).some((z) => z.blocksLos && zoneCoversCell(z, x, y, S.tok));

/** Úroveň světla na buňce: Darkness/obscured zóny > zdroje > globální. */
export function lightAt(S: StavBoje, map: BattleMapData, x: number, y: number): LightLevel {
  if (obscuredAt(S, x, y)) return "dark";
  const global = S.lightLevel || parseLightLevel(map.osvetleni);
  let lvl: LightLevel = global;
  const rank = { dark: 0, dim: 1, bright: 2 };
  const wIdx = wallIndex(mapWalls(map));
  for (const L of mechanicalLights(S,map)) {
    const src = L.tokenId ? S.tok.find((t) => t.id === L.tokenId) : undefined;
    const ax = src ? src.x! : L.anchor?.[0];
    const ay = src ? src.y! : L.anchor?.[1];
    if (ax == null || ay == null) continue;
    if (![ax,ay].every(Number.isFinite)) continue;
    const shape=normalizeLight({...L,x:ax,y:ay});
    const shaped=shape.tvar!=="bod",exact=!src && L.anchorExact,offset=shaped && src ? (src.s || 1)/2 : 0;
    const ox=ax+offset,oy=ay+offset;
    const dx=x+(shaped || exact ? .5 : 0)-ox,dy=y+(shaped || exact ? .5 : 0)-oy,radians=shape.smer*Math.PI/180;
    const along=dx*Math.cos(radians)+dy*Math.sin(radians);
    const across=-dx*Math.sin(radians)+dy*Math.cos(radians);
    if(shape.tvar==="kuzel" && Math.hypot(dx,dy)>1e-9 && Math.abs((Math.atan2(dy,dx)*180/Math.PI-shape.smer+540)%360-180)>shape.sirka/2+1e-9) continue;
    const d = (shape.tvar==="pruh" ? Math.hypot(Math.max(0,Math.abs(along)-shape.delka/2),across)
      : shape.tvar==="kuzel" ? Math.hypot(dx,dy) : Math.max(Math.abs(dx),Math.abs(dy))) * 5;
    const inDark = obscuredAt(S, ax, ay); // světlo ve tmě nesvítí (Darkness 2024)
    if (inDark) continue;
    if (wIdx.size && sightBlocked(idxOr(wIdx), ox + (shaped || exact?0:.5), oy + (shaped || exact?0:.5), x + .5, y + .5, (S as any).dvere)) continue; // světlo skrz zeď nesvítí
    if (d <= L.bright) return "bright";
    if (d <= L.bright + L.dim && rank[lvl] < 1) lvl = "dim";
  }
  return lvl;
}

const idxOr = (i: Map<string, any>) => i;
/** Zjednodušená kontrola, zda přímka A(x,y)→B(x,y) kříží zdi blokující výhled (po buňkách). */
export function sightBlocked(wIdx: Map<string, import("../model/mapV2").MapWall>, ax: number, ay: number, bx: number, by: number, doors?: Record<string, boolean>): boolean {
  if (crossedFreeWalls(wIdx, [ax, ay], [bx, by]).some(w => wallBlocksSight(w, doors))) return true;
  let px = Math.floor(ax), py = Math.floor(ay);
  const ex = Math.floor(bx), ey = Math.floor(by);
  const dx = bx - ax, dy = by - ay, sx = Math.sign(dx), sy = Math.sign(dy);
  const stepX = dx ? 1 / Math.abs(dx) : Infinity, stepY = dy ? 1 / Math.abs(dy) : Infinity;
  let tx = dx ? (sx > 0 ? px + 1 - ax : ax - px) * stepX : Infinity;
  let ty = dy ? (sy > 0 ? py + 1 - ay : ay - py) * stepY : Infinity;
  while (px !== ex || py !== ey) {
    const crossX = px !== ex && (py === ey || tx <= ty + 1e-10);
    const crossY = py !== ey && (px === ex || ty <= tx + 1e-10);
    const cx = px + (crossX ? sx : 0), cy = py + (crossY ? sy : 0);
    if (edgeBlocksSight(wIdx, px, py, cx, cy, doors, true)) return true;
    if (crossX && crossY && edgeBlocksSight(wIdx, cx, cy, px, py, doors, true)) return true;
    if (crossX) tx += stepX;
    if (crossY) ty += stepY;
    px = cx; py = cy;
  }
  return false;
}

export interface Verdict { see: boolean; reason?: string; sense?: string }

/** Vidí útočník `a` cíl `b`? (zón, tma, invisible, krytí). */
export function canSeeTarget(S: StavBoje, map: BattleMapData, a: Token, b: Token): Verdict {
  if (hasCond(a, "Blinded")) return { see: false, reason: "útočník Blinded" };
  if (isIncap(a)) return { see: false, reason: "útočník Incapacitated" };
  const dist = gapFt({ s: a.s, x: a.x ?? 0, y: a.y ?? 0 }, { s: b.s, x: b.x ?? 0, y: b.y ?? 0 });
  const sn = sensesOf(a);
  // perfektní smysly jdou skrz tmu i neviditelnost
  if (dist <= sn.truesight) return { see: true, sense: "Truesight" };
  if (dist <= sn.blindsight) return { see: true, sense: "Blindsight" };
  // LOS přes zeď / total cover
  if (coverOf(a, b, map, S.tok, undefined, undefined, S.teren, (S as any).dvere) === 9)
    return { see: false, reason: "mimo dohled (Total Cover)" };
  // Invisible cíl
  if (hasCond(b, "Invisible")) return { see: false, reason: "cíl Invisible" };
  // heavily obscured zóna na cíli nebo útočníkovi
  const bCells = cellsOf(b), aCells = cellsOf(a);
  const bDark = bCells.some(([x, y]) => obscuredAt(S, x, y));
  const aDark = aCells.some(([x, y]) => obscuredAt(S, x, y));
  if (bDark || aDark) return { see: false, reason: "heavily obscured (tma/mlha)" };
  // normální osvětlení: darkness → Darkvision jako dim; dim → OK; bez DV v tmě nevidí
  const bL = Math.min(...bCells.map(([x, y]) => ({ dark: 0, dim: 1, bright: 2 })[lightAt(S, map, x, y)]));
  if (bL === 0) return dist <= sn.darkvision ? { see: true, sense: "Darkvision" } : { see: false, reason: "cíl ve tmě (bez Darkvision)" };
  return { see: true };
}

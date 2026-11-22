import type { BattleMapData, StavBoje, Token } from "../types";
import { hasCond, isIncap } from "../rules/conditions";
import { lightAt, sensesOf, sightBlocked } from "../rules/lighting";
import { cellInfo, wallIndex, type MapV2 } from "./mapV2";
import { mapWalls } from "./mapRoutes";
import { pointInPolygon } from "./lightGeometry";
import { sourceAssets } from "./sourceState";

export type CellSet = Record<string, 1>;
export type Fog = NonNullable<StavBoje["fog"]>;
export function normalizeFog(value: unknown): Fog | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const cells = (set: unknown): CellSet => Object.fromEntries(Object.entries(set && typeof set === "object" && !Array.isArray(set) ? set : {})
    .filter(([key, v]) => /^\d{1,4},\d{1,4}$/.test(key) && (v === 1 || v === true)).map(([key]) => [key, 1]));
  return { on: input.on === true, revealed: cells(input.revealed),
    ...(input.visible !== undefined ? { visible: cells(input.visible) } : {}),
    ...(input.manual !== undefined ? { manual: cells(input.manual) } : {}),
    ...(input.hidden !== undefined ? { hidden: cells(input.hidden) } : {}) };
}
export function fogState(fog: Fog | undefined, x: number, y: number): "visible" | "memory" | "unknown" {
  if (!fog?.on) return "visible";
  const key = `${Math.floor(x)},${Math.floor(y)}`;
  if (fog.hidden?.[key]) return "unknown";
  if ((fog.visible ?? fog.revealed)[key]) return "visible";
  return fog.revealed[key] ? "memory" : "unknown";
}
export function fogTokenVisible(fog: Fog | undefined, t: Token): boolean {
  if (t.skryty || (t as Token & { hidden?: boolean }).hidden) return false;
  if (!fog?.on || t.side === "druzina") return true;
  if (t.x == null || t.y == null) return false;
  for (let dx = 0; dx < t.s; dx++) for (let dy = 0; dy < t.s; dy++)
    if (fogState(fog, t.x + dx, t.y + dy) !== "visible") return false;
  return true;
}
export function mapCells(map: BattleMapData, poly?: [number, number][]): [number, number][] {
  return map.mrizka.flatMap((row, y) => [...row].flatMap((_, x) =>
    !poly || pointInPolygon([x + .5, y + .5], poly) ? [[x, y] as [number, number]] : []));
}

export function updateFog(S: StavBoje, map: BattleMapData): void {
  if (!S.fog?.on) return;
  const fog = S.fog, visible: CellSet = {}, revealed = { ...fog.revealed };
  const walls = wallIndex(mapWalls(map)), opaque = new Set<string>();
  for (const [x, y] of mapCells(map)) {
    const cell = cellInfo(map, x, y, S.teren);
    if (cell.tile === "#" || cell.blocksSight) opaque.add(`${x},${y}`);
  }
  const blocked = (ax: number, ay: number, bx: number, by: number) => {
    if (sightBlocked(walls, ax, ay, bx, by, S.dvere)) return true;
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
    let px = Math.floor(ax), py = Math.floor(ay);
    for (let i = 1; i < n; i++) {
      const x = Math.floor(ax + (bx - ax) * i / n), y = Math.floor(ay + (by - ay) * i / n);
      if (px !== x && py !== y && opaque.has(`${px},${y}`) && opaque.has(`${x},${py}`)) return true;
      px = x; py = y;
      if ((x === Math.floor(ax) && y === Math.floor(ay)) || (x === Math.floor(bx) && y === Math.floor(by))) continue;
      if (opaque.has(`${x},${y}`)) return true;
    }
    return false;
  };
  const levels = new Map<string, ReturnType<typeof lightAt>>();
  for (const t of S.tok.filter(t => t.side === "druzina" && !t.dead && !t.skryty && t.x != null && t.y != null && !hasCond(t, "Blinded") && !isIncap(t))) {
    const senses = sensesOf(t), radius = Math.max(12, Math.ceil(Math.max(...Object.values(senses)) / 5));
    const ax = t.x! + t.s / 2, ay = t.y! + t.s / 2;
    for (let y = Math.max(0, Math.floor(ay - radius)); y < Math.min(map.mrizka.length, Math.ceil(ay + radius)); y++)
      for (let x = Math.max(0, Math.floor(ax - radius)); x < Math.min(map.mrizka[y].length, Math.ceil(ax + radius)); x++) {
        const key = `${x},${y}`, distance = Math.max(0, Math.max(Math.abs(x + .5 - ax), Math.abs(y + .5 - ay)) - (t.s - 1) / 2) * 5;
        if (distance > radius * 5 || fog.hidden?.[key] || blocked(ax, ay, x + .5, y + .5)) continue;
        let level = levels.get(key);
        if (!level) { level = lightAt(S, map, x, y); levels.set(key, level); }
        if (distance > 0 && level === "dark" && distance > Math.max(...Object.values(senses))) continue;
        visible[key] = 1;
      }
  }
  for (const key of Object.keys(fog.manual || {})) if (!fog.hidden?.[key]) visible[key] = 1;
  for (const key of Object.keys(visible)) revealed[key] = 1;
  for (const key of Object.keys(fog.hidden || {})) delete revealed[key];
  S.fog = { ...fog, visible, revealed };
}

export function fogMemoryMap(map: MapV2): MapV2 {
  return { ...map, svetla: [], pocasi: undefined,
    objekty: map.objekty?.filter(o => !o.dmOnly && !sourceAssets[o.asset]?.blend).map(o => ({ ...o, anim: false })) };
}

export function fogPlayerState(S: StavBoje): StavBoje {
  const tok = S.tok.filter(t => fogTokenVisible(S.fog, t)), ids = new Set(tok.map(t => t.id));
  const ord = S.ord.filter(id => ids.has(id)), active = S.ord[S.turn];
  return { ...S, tok, ord, turn: ord.indexOf(active), log: S.log.filter(l => !l.pj) };
}

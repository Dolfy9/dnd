/* Oblasti účinku (2024): Sphere/Cylinder, Cube, Cone (délka = šířka na konci),
   Line, Emanation (kolem žetonu, size-aware). Vrací buňky + pokryté žetony. */
import type { AreaShape, Token } from "../types";

export interface AreaSpec {
  shape: AreaShape;
  size: number;                 // ft (radius / délka / hrana)
  w?: number;                   // line šířka ft
  h?: number;
  anchor: [number, number];     // střed (sphere), apex (cone), start (line), roh (rect)
  dir?: number;                 // stupně, 0 = +x
}

/** Buňky pokryté oblastí (pro preview/zóny). */
export function areaCells(a: AreaSpec): [number, number][] {
  const r = a.size / 5;
  const out: [number, number][] = [];
  const [ax, ay] = a.anchor;
  const R = Math.ceil(r) + 2;
  if (a.shape === "rect") {
    for (let x = ax; x < ax + (a.w || 1); x++) for (let y = ay; y < ay + (a.h || 1); y++) out.push([x, y]);
    return out;
  }
  for (let x = Math.floor(ax) - R; x <= Math.floor(ax) + R; x++)
    for (let y = Math.floor(ay) - R; y <= Math.floor(ay) + R; y++)
      if (cellCovers(a, x, y)) out.push([x, y]);
  return out;
}

export function cellCovers(a: AreaSpec, x: number, y: number): boolean {
  const r = a.size / 5;
  const [ax, ay] = a.anchor;
  const cx = x + 0.5, cy = y + 0.5;
  switch (a.shape) {
    case "sphere":
    case "cylinder":
      return Math.hypot(cx - (ax + 0.5), cy - (ay + 0.5)) <= r + 0.001;
    case "cube": {
      const half = Math.max(1, Math.round(r / 2));
      return x >= ax - half && x <= ax + half && y >= ay - half && y <= ay + half;
    }
    case "cone": {
      const dir = ((a.dir ?? 0) * Math.PI) / 180;
      const dx = cx - (ax + 0.5), dy = cy - (ay + 0.5);
      const along = dx * Math.cos(dir) + dy * Math.sin(dir);
      const perp = Math.abs(dx * Math.sin(dir) - dy * Math.cos(dir));
      // 2024: cone je dlouhý L a na konci široký L (perp <= along/2)
      return along > -0.5 && along <= r + 0.5 && perp <= Math.max(0, along) / 2 + 0.5;
    }
    case "line": {
      const dir = ((a.dir ?? 0) * Math.PI) / 180;
      const dx = cx - (ax + 0.5), dy = cy - (ay + 0.5);
      const along = dx * Math.cos(dir) + dy * Math.sin(dir);
      const perp = Math.abs(dx * Math.sin(dir) - dy * Math.cos(dir));
      return along >= -0.5 && along <= r + 0.5 && perp <= (a.w ? a.w / 10 : 0.5) + 0.001;
    }
    case "rect":
      return x >= ax && x < ax + (a.w || 1) && y >= ay && y < ay + (a.h || 1);
    case "emanation":
      return false; // vyhodnocuje se přes token
    default:
      return false;
  }
}

/** Žetony pokryté oblastí. `source` je potřeba pro emanation (centrum) a self-cone. */
export function tokensInArea(a: AreaSpec, tokens: Token[], source?: Token): Token[] {
  if (a.shape === "emanation" && source) {
    const sz = a.size / 5;
    const cx = (source.x ?? 0) + source.s / 2, cy = (source.y ?? 0) + source.s / 2;
    return tokens.filter((t) => {
      if (t.x == null || t.dead || t === source) return false;
      const px = t.x + t.s / 2, py = t.y! + t.s / 2;
      return Math.max(Math.abs(px - cx), Math.abs(py - cy)) - (t.s + source.s) / 2 <= sz;
    });
  }
  return tokens.filter((t) => {
    if (t.x == null || t.dead) return false;
    for (let i = 0; i < t.s; i++)
      for (let j = 0; j < t.s; j++)
        if (cellCovers(a, (t.x ?? 0) + i, (t.y ?? 0) + j)) return true;
    return false;
  });
}

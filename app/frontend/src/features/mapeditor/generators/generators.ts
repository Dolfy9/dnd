/* Deterministické generátory map (seeded) — dungeon / jeskyně / venkov.
   Výstup: částečná MapV2 (mrizka + textury + stěny), aplikuje se přes editor. */
import type { MapV2, MapWall } from "../../boj/model/mapV2";

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

const blank = (W: number, H: number, ch = "#") => Array.from({ length: H }, () => ch.repeat(W));

export interface GenOut { mrizka: string[]; textury: Record<string, string>; steny: MapWall[]; objekty?: any[] }
let wid = 0;
const W_ = (a: [number, number], b: [number, number], typ: MapWall["typ"] = "wall"): MapWall => ({ id: `g${++wid}`, a, b, typ });

/** Dungeon: místnosti + chodby, zdi po obvodu, dveře na vstupech. */
export function genDungeon(W: number, H: number, seed: number): GenOut {
  wid = 0;
  const R = rng(seed);
  const m = blank(W, H).map((r) => r.split(""));
  const tex: Record<string, string> = {};
  const steny: MapWall[] = [];
  const rooms: [number, number, number, number][] = [];
  const tries = 200;
  for (let i = 0; i < tries && rooms.length < 12; i++) {
    const w = 4 + Math.floor(R() * 8), h = 3 + Math.floor(R() * 6);
    const x = 1 + Math.floor(R() * (W - w - 2)), y = 1 + Math.floor(R() * (H - h - 2));
    if (rooms.some(([rx, ry, rw, rh]) => x < rx + rw + 1 && rx < x + w + 1 && y < ry + rh + 1 && ry < y + h + 1)) continue;
    rooms.push([x, y, w, h]);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      m[yy][xx] = "."; tex[`${xx},${yy}`] = R() < .15 ? "kocici-hlavy" : "dlazba";
    }
  }
  // chodby L mezi centry po sobě jdoucích místností
  const ctr = rooms.map(([x, y, w, h]) => [x + (w >> 1), y + (h >> 1)]);
  for (let i = 1; i < ctr.length; i++) {
    let [x, y] = ctr[i - 1]; const [tx, ty] = ctr[i];
    const carve = (xx: number, yy: number) => { if (m[yy]?.[xx] === "#") { m[yy][xx] = "."; tex[`${xx},${yy}`] = "dlazba"; } };
    while (x !== tx) { x += Math.sign(tx - x); carve(x, y); }
    while (y !== ty) { y += Math.sign(ty - y); carve(x, y); }
  }
  // obvodové zdi podél hranice podlaha/nepodlaha + dveře (podlaha sousedící se 2+ stran s #)
  const floor = (x: number, y: number) => m[y]?.[x] === ".";
  const doorCand: [number, number, number, number][] = [];
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) {
    if (x < W && (floor(x - 1, y - 1) || floor(x - 1, y)) !== (floor(x, y - 1) || floor(x, y)))
      doorCand.push([x, y, x + 1, y]);
    if (y < H && (floor(x - 1, y - 1) || floor(x, y - 1)) !== (floor(x - 1, y) || floor(x, y)))
      doorCand.push([x, y, x, y + 1]);
  }
  const doors = new Set<string>();
  for (const [x, y, w, h] of rooms) {
    // dveře = chodba těsně u obvodu místnosti
    const spots: [number, number, number, number][] = [];
    for (let xx = x; xx < x + w; xx++) {
      if (floor(xx, y - 1)) spots.push([xx, y, xx + 1, y]);
      if (floor(xx, y + h)) spots.push([xx, y + h, xx + 1, y + h]);
    }
    for (let yy = y; yy < y + h; yy++) {
      if (floor(x - 1, yy)) spots.push([x, yy, x, yy + 1]);
      if (floor(x + w, yy)) spots.push([x + w, yy, x + w, yy + 1]);
    }
    // fallback: žádná chodba u obvodu → dveře na náhodný úsek obvodu místnosti
    if (!spots.length) {
      const side = Math.floor(R() * 4);
      if (side < 2) { const xx = x + Math.floor(R() * w); spots.push([xx, side === 0 ? y : y + h, xx + 1, side === 0 ? y : y + h]); }
      else { const yy = y + Math.floor(R() * h); spots.push([side === 2 ? x : x + w, yy, side === 2 ? x : x + w, yy + 1]); }
    }
    const n = Math.min(spots.length, 1 + Math.floor(R() * 2));
    for (let i = 0; i < n; i++) {
      const s = spots[Math.floor(R() * spots.length)];
      if (s) doors.add(s.join(","));
    }
  }
  const emitted = new Set<string>();
  for (const [ax, ay, bx, by] of doorCand) {
    const kk = [ax, ay, bx, by].join(",");
    emitted.add(kk);
    steny.push(W_([ax, ay], [bx, by], doors.has(kk) ? "door" : "wall"));
  }
  // dveře na úsecích, kde doorCand nevydal hranu (např. mezi dvěma podlahami)
  for (const kk of doors) {
    if (emitted.has(kk)) continue;
    const [ax, ay, bx, by] = kk.split(",").map(Number) as [number, number, number, number];
    steny.push(W_([ax, ay], [bx, by], "door"));
  }
  return { mrizka: m.map((r) => r.join("")), textury: tex, steny };
}

/** Jeskyně: celulární automat. */
export function genCave(W: number, H: number, seed: number): GenOut {
  wid = 0;
  const R = rng(seed);
  let g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) =>
    (x === 0 || y === 0 || x === W - 1 || y === H - 1 || R() < .45) ? 1 : 0));
  for (let it = 0; it < 5; it++) {
    g = g.map((row, y) => row.map((v, x) => {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        if (g[y + dy]?.[x + dx] !== 0) n++;
      return n >= 5 ? 1 : 0;
    }));
  }
  const tex: Record<string, string> = {};
  const m = g.map((row, y) => row.map((v, x) => {
    if (v) return "#";
    tex[`${x},${y}`] = R() < .6 ? "jeskyne" : "hlina";
    return ".";
  }).join(""));
  const steny = wallsFromGrid(m, W, H);
  return { mrizka: m, textury: tex, steny };
}

/** Venkov: mýtina se stromy a kameny. */
export function genOutdoor(W: number, H: number, seed: number): GenOut {
  wid = 0;
  const R = rng(seed);
  const tex: Record<string, string> = {};
  const m: string[][] = [];
  for (let y = 0; y < H; y++) {
    const row: string[] = [];
    for (let x = 0; x < W; x++) {
      const dx = x - W / 2, dy = y - H / 2;
      const d = Math.hypot(dx / (W / 2), dy / (H / 2));
      const r = R();
      if (d > .95) { row.push("T"); }
      else if (d > .8 && r < .5) { row.push("T"); }
      else if (r < .04) { row.push("o"); }
      else if (r < .1) { row.push("f"); }
      else { row.push("g"); }
      tex[`${x},${y}`] = "trava";
    }
    m.push(row);
  }
  return { mrizka: m.map((r2) => r2.join("")), textury: tex, steny: [] };
}

/** Hranové zdi podél přechodu průchozí/neprůchozí. */
export function wallsFromGrid(m: string[], W: number, H: number): MapWall[] {
  const f = (x: number, y: number) => m[y]?.[x] === "." || m[y]?.[x] === "g";
  const out: MapWall[] = [];
  for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++)
    if (f(x - 1, y - 1) || f(x - 1, y) || f(x, y - 1) || f(x, y)) {
      if ((f(x - 1, y - 1) || f(x - 1, y)) !== (f(x, y - 1) || f(x, y))) out.push(W_([x, y], [x + 1, y]));
    }
  for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) {
    if ((f(x - 1, y - 1) || f(x - 1, y)) !== (f(x, y - 1) || f(x, y))) {
      if (!out.some((w) => w.a[0] === x && w.a[1] === y)) out.push(W_([x, y], [x, y + 1]));
    }
  }
  return out;
}

export const GENERATORS = [
  { id: "dungeon", nazev: "Dungeon (místnosti + chodby)", fn: genDungeon },
  { id: "cave", nazev: "Jeskyně (celulární automat)", fn: genCave },
  { id: "outdoor", nazev: "Venkov (mýtina)", fn: genOutdoor },
];

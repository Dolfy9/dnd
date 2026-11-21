/* Operace nástrojů editoru — čisté funkce nad MapV2 (volá EditorPage). */
import type { MapV2, MapWall } from "../../boj/model/mapV2";
import { wallUid } from "../../boj/model/mapV2";
import type { GenOut } from "../generators/generators";

export const k2 = (x: number, y: number) => `${x},${y}`;

export function pointToSeg(px: number, py: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

export const setTile = (m: MapV2, x: number, y: number, ch: string) => {
  if (m.mrizka[y] != null && x >= 0 && x < m.mrizka[y].length)
    m.mrizka[y] = m.mrizka[y].slice(0, x) + ch + m.mrizka[y].slice(x + 1);
};

export function brushCells(cx: number, cy: number, size: number, shape: "sq" | "circ"): [number, number][] {
  const out: [number, number][] = [];
  const r = (size - 1) / 2;
  for (let y = cy - Math.ceil(r); y <= cy + Math.ceil(r); y++)
    for (let x = cx - Math.ceil(r); x <= cx + Math.ceil(r); x++)
      if (shape === "sq" || Math.hypot(x - cx, y - cy) <= r + .5) out.push([x, y]);
  return out;
}

export function fillRect(m: MapV2, a: [number, number], b: [number, number], tile: string) {
  for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++)
    for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) setTile(m, x, y, tile);
}

export function floodFill(m: MapV2, x0: number, y0: number, tile: string) {
  const tgt = m.mrizka[y0]?.[x0];
  if (tgt == null || tgt === tile) return;
  const seen = new Set<string>(); const q: [number, number][] = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.pop()!; const kk = k2(x, y);
    if (seen.has(kk) || m.mrizka[y]?.[x] !== tgt) continue;
    seen.add(kk); setTile(m, x, y, tile);
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

/** Místnost: podlaha + textura + obvodové zdi (+ dveře náhodně na severní straně). */
export function roomRect(m: MapV2, a: [number, number], b: [number, number], tex: string) {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  m.textury = { ...(m.textury || {}) };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    setTile(m, x, y, "."); m.textury[k2(x, y)] = tex;
  }
  const steny = m.steny || [];
  for (let x = x0; x <= x1; x++) {
    steny.push({ id: wallUid(), a: [x, y0], b: [x + 1, y0], typ: "wall" });
    steny.push({ id: wallUid(), a: [x, y1 + 1], b: [x + 1, y1 + 1], typ: "wall" });
  }
  for (let y = y0; y <= y1; y++) {
    steny.push({ id: wallUid(), a: [x0, y], b: [x0, y + 1], typ: "wall" });
    steny.push({ id: wallUid(), a: [x1 + 1, y], b: [x1 + 1, y + 1], typ: "wall" });
  }
  m.steny = steny;
}

/** Polyline bodů → unit segmenty zdí. */
export function wallChain(m: MapV2, pts: [number, number][], typ: MapWall["typ"], locked: boolean, close = false) {
  if (pts.length < 2) return;
  const chain = close ? [...pts, pts[0]] : pts;
  const steny = m.steny || [];
  for (let i = 0; i < chain.length - 1; i++)
    steny.push({ id: wallUid(), a: chain[i], b: chain[i + 1], typ, locked: typ === "door" && locked });
  m.steny = steny;
}

/** Guma: smaže nejvrchnější prvek pod kurzorem (buňkové souřadnice). */
export function eraseAt(m: MapV2, cx: number, cy: number) {
  const P = (o: any) => Math.abs((o.x ?? -9) - cx - .5) < ((o.w ?? 1) / 2 + .01) && Math.abs((o.y ?? -9) - cy - .5) < ((o.h ?? 1) / 2 + .01);
  let i = (m.poznamky || []).findIndex(P); if (i >= 0) { m.poznamky!.splice(i, 1); return; }
  i = (m.svetla || []).findIndex((l) => Math.hypot(l.x - cx - .5, l.y - cy - .5) < .6); if (i >= 0) { m.svetla!.splice(i, 1); return; }
  i = (m.kresby || []).findIndex((k) => k.pts.some(([x, y]) => Math.hypot(x - cx - .5, y - cy - .5) < .5));
  if (i >= 0) { m.kresby!.splice(i, 1); return; }
  i = (m.objekty || []).findIndex(P); if (i >= 0) { m.objekty!.splice(i, 1); return; }
  i = (m.steny || []).findIndex((w) => pointToSeg(cx + .5, cy + .5, w.a, w.b) < .35);
  if (i >= 0) { m.steny!.splice(i, 1); return; }
  if (m.vyska?.[k2(cx, cy)] != null) { delete m.vyska[k2(cx, cy)]; return; }
  if (m.textury?.[k2(cx, cy)]) { delete m.textury[k2(cx, cy)]; return; }
}

/** Aplikace generátoru na mapu (nahradí mřížku do velikosti, sloučí textury+zdi). */
export function applyGen(m: MapV2, g: GenOut) {
  const H = m.mrizka.length, W = m.mrizka[0]?.length || 0;
  const Hh = Math.min(H, g.mrizka.length), Ww = Math.min(W, g.mrizka[0].length);
  for (let y = 0; y < Hh; y++) m.mrizka[y] = g.mrizka[y].slice(0, Ww) + m.mrizka[y].slice(Ww);
  m.textury = { ...(m.textury || {}), ...g.textury };
  m.steny = [...(m.steny || []), ...(g.steny || [])];
  if (g.objekty?.length) m.objekty = [...(m.objekty || []), ...g.objekty];
}

/** Hit-test prvky v bodě (buňky) pro select nástroj. */
export function pickAt(m: MapV2, cx: number, cy: number) {
  const px = cx + .5, py = cy + .5;
  const o = (m.objekty || []).find((o) => Math.abs(o.x - px) < Math.max(o.w, 1) / 2 && Math.abs(o.y - py) < Math.max(o.h, 1) / 2);
  if (o) return { kind: "objekt" as const, id: o.id };
  const n = (m.poznamky || []).find((n) => Math.hypot(n.x - px, n.y - py) < .5);
  if (n) return { kind: "poznamka" as const, id: n.id };
  const l = (m.svetla || []).find((l) => Math.hypot(l.x - px, l.y - py) < .5);
  if (l) return { kind: "svetlo" as const, id: l.id };
  const w = (m.steny || []).find((w) => pointToSeg(px, py, w.a, w.b) < .3);
  if (w) return { kind: "stena" as const, id: w.id };
  const d = (m.kresby || []).find((k) => k.pts.some(([x, y]) => Math.hypot(x - px, y - py) < .4));
  if (d) return { kind: "kresba" as const, id: d.id };
  return null;
}

/** Marquee: prvky zcela uvnitř obdélníku (buňky). */
export function pickInRect(m: MapV2, a: [number, number], b: [number, number]) {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  const out: { kind: "objekt" | "svetlo" | "poznamka" | "kresba" | "stena"; id: string }[] = [];
  for (const o of m.objekty || []) if (o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) out.push({ kind: "objekt", id: o.id });
  for (const l of m.svetla || []) if (l.x >= x0 && l.x <= x1 && l.y >= y0 && l.y <= y1) out.push({ kind: "svetlo", id: l.id });
  for (const n of m.poznamky || []) if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1) out.push({ kind: "poznamka", id: n.id });
  for (const w of m.steny || [])
    if (w.a[0] >= x0 && w.b[0] <= x1 && w.a[1] >= y0 && w.b[1] <= y1) out.push({ kind: "stena", id: w.id });
  for (const k of m.kresby || [])
    if (k.pts.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) out.push({ kind: "kresba", id: k.id });
  return out;
}

/** Posun výběru o (dx,dy) buňek. */
export function moveSel(m: MapV2, sel: { kind: string; id: string }[], dx: number, dy: number) {
  const ids = new Set(sel.map((s) => s.id));
  for (const o of m.objekty || []) if (ids.has(o.id)) { o.x += dx; o.y += dy; }
  for (const l of m.svetla || []) if (ids.has(l.id)) { l.x += dx; l.y += dy; }
  for (const n of m.poznamky || []) if (ids.has(n.id)) { n.x += dx; n.y += dy; }
  for (const w of m.steny || []) if (ids.has(w.id)) { w.a = [w.a[0] + dx, w.a[1] + dy]; w.b = [w.b[0] + dx, w.b[1] + dy]; }
  for (const k of m.kresby || []) if (ids.has(k.id)) k.pts = k.pts.map(([x, y]) => [x + dx, y + dy]);
}

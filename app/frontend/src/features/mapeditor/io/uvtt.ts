/* Universal VTT (.uvtt/.dd2vtt/.df2vtt) import/export + map JSON + PNG export. */
import type { MapV2, MapWall } from "../../boj/model/mapV2";
import { wallUid } from "../../boj/model/mapV2";

export interface UvttDoc {
  resolution: { map_size: { x: number; y: number }; pixels_per_grid: number; map_origin?: { x: number; y: number } };
  line_of_sight?: { x: number; y: number }[][];
  objects_line_of_sight?: { x: number; y: number }[][];
  portals?: { position: { x: number; y: number }; bounds: { x: number; y: number }[]; closed?: boolean; rotation?: number }[];
  lights?: { position: { x: number; y: number }; range: number; intensity?: number; color?: string }[];
  image?: string; // base64 data URL
}

const W = (a: [number, number], b: [number, number], typ: MapWall["typ"], extra: Partial<MapWall> = {}): MapWall =>
  ({ id: wallUid(), a, b, typ, ...extra });

/** Import UVTT → částečná MapV2 (mrizka, steny, svetla, kalibrace, image). */
export function importUvtt(doc: UvttDoc): Partial<MapV2> & { _image?: string } {
  const cols = doc.resolution.map_size.x, rows = doc.resolution.map_size.y;
  const ppg = doc.resolution.pixels_per_grid || 150;
  const ox = doc.resolution.map_origin?.x ?? 0, oy = doc.resolution.map_origin?.y ?? 0;
  const toCell = (v: { x: number; y: number }): [number, number] =>
    [Math.round((v.x - ox) * 2) / 2, Math.round((v.y - oy) * 2) / 2]; // UVTT už je v grid jednotkách
  const mrizka = Array.from({ length: rows }, () => ".".repeat(cols));
  const steny: MapWall[] = [];
  const segs = (pts: { x: number; y: number }[], typ: MapWall["typ"], closed = true) => {
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
      const a = toCell(pts[i]), b = toCell(pts[(i + 1) % pts.length]);
      if (a[0] === b[0] || a[1] === b[1]) steny.push(W(a, b, typ));
      else { // diagonála → schody
        const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
        for (let s = 0; s < n; s++) {
          const t0 = s / n, t1 = (s + 1) / n;
          steny.push(W([Math.round((a[0] + (b[0] - a[0]) * t0) * 2) / 2, Math.round((a[1] + (b[1] - a[1]) * t0) * 2) / 2],
                       [Math.round((a[0] + (b[0] - a[0]) * t1) * 2) / 2, Math.round((a[1] + (b[1] - a[1]) * t1) * 2) / 2], typ));
        }
      }
    }
  };
  for (const poly of doc.line_of_sight || []) segs(poly, "wall");
  for (const poly of doc.objects_line_of_sight || []) segs(poly, "wall");
  for (const p of doc.portals || []) {
    if (p.bounds?.length >= 2) segs(p.bounds, "door", false);
    steny[steny.length - 1] && (steny[steny.length - 1].open = p.closed === false);
    steny[steny.length - 1] && (steny[steny.length - 1].locked = !!p.closed);
  }
  const svetla = (doc.lights || []).map((l, i) => ({
    id: `ul${i}`, x: l.position.x - ox, y: l.position.y - oy,
    bright: Math.round(l.range / 2), dim: Math.round(l.range / 2), color: l.color,
  }));
  return { mrizka, steny, svetla, kalibrace: { cellPx: ppg, offX: ox, offY: oy }, _image: doc.image };
}

/** Export MapV2 → UVTT JSON. */
export function exportUvtt(map: MapV2): string {
  const W = map.mrizka[0]?.length || 1, H = map.mrizka.length;
  // seskupit unit segmenty do polyline (jednoduché: každý segment jako pár)
  const los: { x: number; y: number }[][] = [];
  const portals: any[] = [];
  for (const w of map.steny || []) {
    if (w.typ === "wall" || w.typ === "secret") los.push([{ x: w.a[0], y: w.a[1] }, { x: w.b[0], y: w.b[1] }]);
    else if (w.typ === "door") portals.push({ position: { x: (w.a[0] + w.b[0]) / 2, y: (w.a[1] + w.b[1]) / 2 }, bounds: [{ x: w.a[0], y: w.a[1] }, { x: w.b[0], y: w.b[1] }], closed: !(w.open) });
  }
  const doc: UvttDoc = {
    resolution: { map_size: { x: W, y: H }, pixels_per_grid: map.kalibrace?.cellPx || 150, map_origin: { x: 0, y: 0 } },
    line_of_sight: los, portals,
    lights: (map.svetla || []).map((l) => ({ position: { x: l.x, y: l.y }, range: l.bright + l.dim, color: l.color })),
  };
  return JSON.stringify(doc, null, 2);
}

/** PNG export mapy přes offscreen canvas (vytvoř SVG snapshot → drawImage). */
export async function exportPng(svgEl: SVGSVGElement, pxPerCell: number, filename: string) {
  svgEl = svgEl.cloneNode(true) as SVGSVGElement;
  svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const sources = new Map<string, Promise<string>>();
  await Promise.all(Array.from(svgEl.querySelectorAll("image")).map(async image => {
    const href = image.getAttribute("href");
    if (!href || href.startsWith("data:")) return;
    if (!sources.has(href)) sources.set(href, (async () => {
      const response = await fetch(href);
      if (!response.ok) throw new Error("Obrázek nelze načíst: " + href);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    })());
    image.setAttribute("href", await sources.get(href)!);
  }));
  const W = svgEl.viewBox.baseVal.width, H = svgEl.viewBox.baseVal.height;
  const cell = 24; // náš px/cell v SVG
  const scale = pxPerCell / cell;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const cv = document.createElement("canvas");
  cv.width = W * scale; cv.height = H * scale;
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  const a = document.createElement("a");
  a.href = cv.toDataURL("image/png");
  a.download = filename;
  a.click();
}

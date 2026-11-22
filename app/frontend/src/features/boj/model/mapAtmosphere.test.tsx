import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateMap, type MapV2, type MapPaintStroke } from "./mapV2";
import { appendPaintPoint, paintStroke } from "../../mapeditor/tools/ops";
import { MapPaintLayer, MapAtmosphereLayer, visualLights, GLOW } from "../components/MapAtmoLayers";
import { TerenLayer } from "../components/MapLayers";
import { setManifests } from "../components/MapV2Layers";

const base = (): MapV2 => ({ id: "test", nazev: "Les", podklad: "les", mrizka: ["ggg", "g~g", "grg"] });
const stroke = (p: [number, number][] = [[.1, .2], [2.8, 2.2]]): MapPaintStroke =>
  ({ id: "s", t: "hlina", b: .5, o: .8, h: .4, p });

describe("visual map migration", () => {
  it("keeps legacy defaults without adding darkness or painting", () => {
    const m = migrateMap(base());
    expect(m.atmosfera).toBeUndefined();
    expect(m.malba).toBeUndefined();
    expect(renderToStaticMarkup(<MapAtmosphereLayer map={m} />)).toBe("");
  });
  it("round-trips valid optional fields without affecting rules", () => {
    const m = { ...base(), atmosfera: { amb: .2, barva: "#09152f" }, malba: [stroke()],
      svetla: [{ id: "l", x: 1.2, y: 2.3, bright: 15, dim: 20, intenzita: .6, blikani: true }] };
    expect(migrateMap(JSON.parse(JSON.stringify(m)))).toEqual(m);
    expect(migrateMap(m).mrizka).toEqual(base().mrizka);
  });
  it("tolerates null, malformed, non-finite and out-of-range visual values", () => {
    const m = migrateMap({ ...base(), atmosfera: { amb: NaN, barva: "url(bad)" },
      malba: [null, { ...stroke(), b: 99, o: -1, h: Infinity, p: [[NaN, 2], [1, 2], ["1", 2]] }],
      svetla: [null, { id: "l", intenzita: -1, blikani: "yes" }] });
    expect(m.atmosfera).toEqual({ amb: 1, barva: "#101522" });
    expect(m.malba).toEqual([{ ...stroke([[1, 2]]), b: 8, o: 0, h: .5 }]);
    expect(m.svetla![0]).toMatchObject({ intenzita: 0, blikani: false });
    expect(migrateMap({ ...base(), malba: {}, atmosfera: null }).malba).toEqual([]);
    expect(migrateMap({ ...base(), malba: [{ ...stroke(), p: [] }] }).malba).toEqual([]);
  });
});

describe("free texture stroke operations", () => {
  it("decimates points and commits a stroke as one operation", () => {
    const pts: [number, number][] = [];
    appendPaintPoint(pts, [0, 0]); appendPaintPoint(pts, [.01, .01]); appendPaintPoint(pts, [.5, .5]);
    expect(pts).toEqual([[0, 0], [.5, .5]]);
    const m = base(); paintStroke(m, stroke(pts));
    expect(m.malba).toHaveLength(1);
    expect(m.mrizka).toEqual(base().mrizka);
    paintStroke(m, stroke([])); expect(m.malba).toHaveLength(1);
  });
  it("erases entire intersected strokes including sparse crossings, dots and parallel segments", () => {
    const m = base();
    paintStroke(m, stroke([[0, 0], [4, 4]]));
    paintStroke(m, { ...stroke([[0, 4], [4, 0]]), b: .25 }, true);
    expect(m.malba).toEqual([]);
    paintStroke(m, stroke([[1, 1]]));
    paintStroke(m, stroke([[1, 1.2]]), true);
    expect(m.malba).toEqual([]);
    paintStroke(m, stroke([[0, 0], [4, 0]]));
    paintStroke(m, stroke([[0, 2], [4, 2]]), true);
    expect(m.malba).toHaveLength(1);
    paintStroke(m, stroke([[2, .2]]), true);
    expect(m.malba).toEqual([]);
    paintStroke(m, stroke([]), true);
    expect(m.malba).toEqual([]);
  });
});

describe("shared image compositing", () => {
  it("renders soft texture strokes, dots and missing image fallbacks safely", () => {
    setManifests({}, { hlina: { id: "hlina", nazev: "Hlína", src: "hlina.webp", cells: 4 } });
    const m = { ...base(), malba: [stroke([[1, 1]]), { ...stroke(), id: "missing", t: "missing" }] };
    const svg = renderToStaticMarkup(<MapPaintLayer map={m} />);
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain("feGaussianBlur");
    expect(svg).toContain("hlina.webp");
    expect(svg).not.toContain("missing.webp");
    expect(svg).toContain("filterUnits");
    setManifests({}, {});
    expect(renderToStaticMarkup(<MapPaintLayer map={base()} />)).not.toContain("<path");
  });
  it("uses the glow image for light holes and colored screen glow, including emitting objects", () => {
    const m = { ...base(), atmosfera: { amb: .1, barva: "#101522" },
      svetla: [{ id: "l", x: 1, y: 1, bright: 10, dim: 15, color: "#a9ceff", intenzita: .4, blikani: true }],
      objekty: [{ id: "fire", asset: "ohen", x: 2, y: 2, w: 1, h: 1, light: { bright: 10, dim: 10 } }] };
    expect(visualLights(m)[0]).toMatchObject({ bright: 48, radius: 120, intenzita: .4 });
    expect(visualLights(m)).toHaveLength(2);
    const svg = renderToStaticMarkup(<MapAtmosphereLayer map={m} />);
    expect(svg).toContain(GLOW);
    expect(svg).toContain("mix-blend-mode:screen");
    expect(svg).toContain("map-light-flicker");
    expect(svg).not.toContain("radialGradient");
    expect(svg).toContain('opacity="0.9"');
  });
  it("groups organic masks by terrain rather than cell on a 40×40 map", () => {
    const m = { ...base(), mrizka: Array.from({ length: 40 }, (_, y) => (y % 2 ? "g~" : "r~").repeat(20)) };
    const svg = renderToStaticMarkup(<svg><TerenLayer map={m} px={24} /></svg>);
    expect((svg.match(/<mask /g) || []).length).toBe(3);
    expect((svg.match(/<filter /g) || []).length).toBe(1);
    expect(svg).toContain("feDisplacementMap");
  });
});

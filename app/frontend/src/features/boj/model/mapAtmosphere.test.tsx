import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateMap, normalizeLight, type MapV2, type MapPaintStroke } from "./mapV2";
import { appendPaintPoint, paintStroke } from "../../mapeditor/tools/ops";
import { MapPaintLayer, MapAtmosphereArtwork, MapAtmosphereLayer, BakedAtmosphere, visualLights, GLOW } from "../components/MapAtmoLayers";
import { TerenLayer } from "../components/MapLayers";
import { setManifests } from "../components/MapV2Layers";

const base = (): MapV2 => ({ id: "test", nazev: "Les", podklad: "les", mrizka: ["ggg", "g~g", "grg"] });
it("screens only the baked glow so colored light cannot darken light terrain", () => {
  const svg=renderToStaticMarkup(<BakedAtmosphere dark="dark.png" glow="glow.png" width={240} height={240}/>);
  const images=svg.match(/<image[^>]*>/g)!;
  expect(images).toHaveLength(2);
  expect(images[0]).not.toContain("mix-blend-mode");
  expect(images[1]).toContain("mix-blend-mode:screen");
  expect(svg).not.toMatch(/<mask|<filter/);
  const screen=(base:number,glow:number,alpha:number)=>255-(255-base)*(1-alpha*glow/255);
  for(const base of [0,140,227,255])for(const glow of [0,70,180,255])expect(screen(base,glow,.48)).toBeGreaterThanOrEqual(base);
});
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
    expect(migrateMap(JSON.parse(JSON.stringify(m)))).toEqual({...m,svetla:m.svetla.map(normalizeLight)});
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
    const svg = renderToStaticMarkup(<MapAtmosphereArtwork map={m} />);
    expect(svg).toContain(GLOW);
    expect(svg).toContain("mix-blend-mode:screen");
    expect(svg).not.toContain("map-light-flicker");
    expect(svg).not.toContain("map-light-effect");
    expect(svg).toContain('opacity="0.9"');
  });
  it("keeps amber chroma through the floor projection rather than using a white light", () => {
    const m = {...base(), atmosfera:{amb:.26,barva:"#010102"}, svetla:[{id:"lantern",x:1,y:1,bright:3,dim:9,color:"#ff9f45",intenzita:1}]};
    const glow=renderToStaticMarkup(<MapAtmosphereArtwork map={m} layer="glow"/>);
    const light=visualLights(m)[0];
    expect(light.color).toBe("#ff9f45");
    expect(light.bright).toBeCloseTo(14.4);
    expect(light.radius).toBeCloseTo(57.6);
    expect(glow).toContain('flood-color="#ff9f45"');
    expect(glow).toContain('in2="SourceAlpha" operator="in"');
    expect(glow).toContain('mix-blend-mode:screen');
    const dark=renderToStaticMarkup(<MapAtmosphereArtwork map={m} layer="darkness"/>);
    expect(dark).toContain('fill="#010102" opacity="0.74"');
  });
  it("shares feathered cones, oriented strips and wall clipping between glow and darkness", () => {
    const m: MapV2={...base(),atmosfera:{amb:.2,barva:"#101522"},steny:[{id:"wall",a:[1.5,0],b:[1.5,3],typ:"door"}],svetla:[
      {id:"cone",x:1,y:1,bright:5,dim:5,tvar:"kuzel",smer:45,sirka:70,efekt:"plamen",rychlost:2},
      {id:"strip",x:2,y:2,bright:5,dim:5,tvar:"pruh",smer:90,efekt:"pulz",stiny:false},
    ]};
    const svg=renderToStaticMarkup(<MapAtmosphereArtwork map={m} />);
    expect(svg).toContain('data-light-shape="kuzel"'); expect(svg).toContain('data-light-shape="pruh"');
    expect(svg).toContain('rotate(90)'); expect(svg).toContain('rotate(45)');
    expect(svg).toContain('feGaussianBlur'); expect(svg).toContain('linearGradient');
    expect(svg).toContain('data-cone-feather="0.30"'); expect(svg).toContain('apexMask');
    expect(svg).not.toContain('animation-duration');
    expect((svg.match(/<polygon /g)||[])).toHaveLength(1);
    expect((svg.match(/<use /g)||[])).toHaveLength(4);
    expect(renderToStaticMarkup(<MapAtmosphereArtwork map={m} doors={{wall:true}} />)).not.toContain('<polygon');
    expect(renderToStaticMarkup(<MapAtmosphereLayer map={{...base(),svetla:[{id:"bad",x:NaN,y:1,bright:5,dim:5}]}} />)).toBe("");
  });
  it("keeps filters and masks out of the live atmosphere while bitmaps are pending", () => {
    const m: MapV2 = {...base(), atmosfera:{amb:.2,barva:"#101522"}, svetla:[{id:"l",x:1,y:1,bright:5,dim:5}]};
    const pending = renderToStaticMarkup(<MapAtmosphereLayer map={m} />);
    expect(pending).toContain('data-atmosphere-baked="false"');
    expect(pending).toContain('opacity="0.8"');
    expect(pending).not.toMatch(/<mask|<filter|mix-blend-mode/);
    const dark = renderToStaticMarkup(<MapAtmosphereArtwork map={m} layer="darkness" />);
    const glow = renderToStaticMarkup(<MapAtmosphereArtwork map={m} layer="glow" />);
    expect(dark).toContain('opacity="0.8"');
    expect(dark).not.toContain('mix-blend-mode');
    expect(glow).not.toContain('opacity="0.8"');
    expect(glow).toContain('mix-blend-mode:screen');
  });
  it("defaults classified fire emitters to flame, respecting explicit static objects", () => {
    const o={id:"fire",asset:"fire",x:1,y:1,w:1,h:1,light:{bright:5,dim:5}};
    const assets={fire:{id:"fire",nazev:"Oheň",src:"fire.webp",anim:"ohen" as const}};
    expect(visualLights({...base(),objekty:[o]},assets)[0].efekt).toBe("plamen");
    expect(visualLights({...base(),objekty:[{...o,anim:false}]},assets)[0].efekt).toBe("zadny");
    expect(visualLights({...base(),objekty:[{...o,dmOnly:true}]},assets)).toEqual([]);
  });
  it("groups organic masks by terrain rather than cell on a 40×40 map", () => {
    const m = { ...base(), mrizka: Array.from({ length: 40 }, (_, y) => (y % 2 ? "g~" : "r~").repeat(20)) };
    const svg = renderToStaticMarkup(<svg><TerenLayer map={m} px={24} /></svg>);
    expect((svg.match(/<mask /g) || []).length).toBe(3);
    expect((svg.match(/<filter /g) || []).length).toBe(1);
    expect(svg).toContain("feDisplacementMap");
  });
});

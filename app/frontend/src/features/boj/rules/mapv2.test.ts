/* Map v2: hranové zdi (pohyb/LoS/krytí), typy (window/half/curtain/door/secret),
   objekty (rasterizace), výška (dist = max(horiz, |Δelev|)), UVTT import,
   generátory (determinismus), migrateMap na všech 30 mapách. */
import { describe, it, expect } from "vitest";
import doc from "../../../../../../11_Mapy/bojove_mapy.json";
import { reachable } from "./grid";
import { coverOf } from "./los";
import { planMovement } from "./movement";
import { defaultSettings, mergeSettings } from "./settings";
import { migrateMap, wallIndex, edgeBlocked, objectsAt, cellInfo, distFt, type MapV2 } from "../model/mapV2";
import { genDungeon, genCave } from "../../mapeditor/generators/generators";
import { importUvtt } from "../../mapeditor/io/uvtt";
import type { Token, StavBoje } from "../types";
import { uid } from "../types";

const mkTok = (o: Partial<Token> = {}): Token => ({
  id: o.id || uid(), nazev: "T", kind: "pc", side: "druzina", s: 1,
  x: 0, y: 0, hp: 20, max: 20, tmp: 0, ac: 15, initB: 0, init: null,
  speed: 30, swim: 0, fly: 0, climb: 0,
  saves: {}, mods: {}, atk: [], cond: [], effects: [], conc: false,
  react: true, spent: {}, slots: [], zdroje: [], ds: { s: 0, f: 0 },
  dead: false, xp: 0, odolnosti: [], imunity: [], zranitelnosti: [],
  imunity_stavu: [], smysly: [], ...o,
});
const mkS = (tok: Token[], extra: Partial<StavBoje> = {}): StavBoje =>
  ({ tok, ord: tok.map((t) => t.id), turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], ...extra });
const st = () => mergeSettings({});

// mapa 6×5: dvě místnosti dělené zdí na x=3 (hrany x=3, y=0..5)
const wallMap = (typ: "wall" | "door" | "window" | "half" | "curtain" | "secret", open = false, locked = false): MapV2 => ({
  id: "t", nazev: "t", podklad: "mesto",
  mrizka: ["......", "......", "......", "......", "......"],
  steny: Array.from({ length: 5 }, (_, y) => ({ id: `w${y}`, a: [3, y] as [number, number], b: [3, y + 1] as [number, number], typ, open, locked })),
});

describe("hranové zdi — pohyb", () => {
  it("zeď blokuje krok mezi buňkami", () => {
    const m = wallMap("wall");
    const idx = wallIndex(m.steny);
    expect(edgeBlocked(idx, 2, 2, 3, 2, undefined)).toBe(true);
    expect(edgeBlocked(idx, 0, 2, 1, 2, undefined)).toBe(false);
    const t = mkTok({ x: 1, y: 2 });
    const r = reachable(t, 30, m, [t], [], undefined);
    expect(r.dist["4,2"]).toBeUndefined();          // za zdí nedosažitelné
    expect(r.dist["2,2"]).toBeDefined();
  });
  it("zavřené dveře blokují, otevřené ne; stav v S.dvere vyhrává", () => {
    const m = wallMap("door", false);
    const t = mkTok({ x: 1, y: 2 });
    expect(reachable(t, 30, m, [t]).dist["4,2"]).toBeUndefined();
    const m2 = wallMap("door", true);
    expect(reachable(t, 30, m2, [t]).dist["4,2"]).toBeDefined();
    // stav v boji přebije výchozí open
    expect(reachable(t, 30, wallMap("door", false), [t], [], undefined, { w0: true, w1: true, w2: true, w3: true, w4: true }).dist["4,2"]).toBeDefined();
    expect(reachable(t, 30, wallMap("door", true), [t], [], undefined, { w0: false, w1: false, w2: false, w3: false, w4: false }).dist["4,2"]).toBeUndefined();
  });
  it("okno blokuje pohyb, curtina ne", () => {
    const t = mkTok({ x: 1, y: 2 });
    expect(reachable(t, 30, wallMap("window"), [t]).dist["4,2"]).toBeUndefined();
    expect(reachable(t, 30, wallMap("curtain"), [t]).dist["4,2"]).toBeDefined();
    expect(reachable(t, 30, wallMap("secret"), [t]).dist["4,2"]).toBeUndefined();
  });
  it("planMovement hlásí blocked u zdi", () => {
    const m = wallMap("wall");
    const t = mkTok({ x: 1, y: 2 });
    const p = planMovement(mkS([t]), m, t, [], [4, 2], "pravidla", st());
    expect(p.blocked).toBeTruthy();
  });
});

describe("hranové zdi — LoS a krytí", () => {
  const a = mkTok({ id: "a", x: 0, y: 2 });
  const b = mkTok({ id: "b", side: "nepratele", x: 4, y: 2 });
  it("zeď = plné krytí (block), curtina taky blokuje výhled", () => {
    expect(coverOf(a, b, wallMap("wall"), [a, b])).toBe(9);
    expect(coverOf(a, b, wallMap("curtain"), [a, b])).toBe(9);
    expect(coverOf(a, b, wallMap("secret"), [a, b])).toBe(9);
  });
  it("okno neblokuje výhled → žádné krytí; nízká zeď = half", () => {
    expect(coverOf(a, b, wallMap("window"), [a, b])).toBe(0);
    // hranová 'half' zeď: neblokuje výhled, ale dává Half Cover
    expect(coverOf(a, b, wallMap("half"), [a, b])).toBe(2);
    expect(coverOf(a, b, wallMap("door", true), [a, b])).toBe(0);
    expect(coverOf(a, b, wallMap("door", false), [a, b])).toBe(9);
  });
});

describe("objekty — rasterizace", () => {
  it("objekt s blocks/cover/difficult ovlivní cellInfo", () => {
    const m: MapV2 = { id: "t", nazev: "t", podklad: "mesto", mrizka: ["....", "....", "....", "...."],
      objekty: [{ id: "o1", asset: "strom", x: 1.5, y: 1.5, w: 1, h: 1, blocks: true, cover: 3, difficult: true }] };
    expect(objectsAt(m, 1, 1).length).toBe(1);
    const ci = cellInfo(m, 1, 1);
    expect(ci.blocksMove).toBe(true);
    expect(ci.cover).toBe(3);
    expect(ci.difficult).toBe(true);
    expect(cellInfo(m, 0, 0).blocksMove).toBe(false);
  });
});

describe("výška — distFt", () => {
  it("dist = max(horizontální ft, |Δelev|)", () => {
    const m: MapV2 = { id: "t", nazev: "t", podklad: "mesto", mrizka: ["....", "...."],
      vyska: { "0,0": 0, "2,0": 20 } };
    expect(distFt(m, 0, 0, 2, 0, 10)).toBe(20);   // horiz 10 vs elev 20
    expect(distFt(m, 0, 0, 1, 0, 5)).toBe(5);
  });
});

describe("UVTT import", () => {
  it("převede LoS polygony na zdi, portály na dveře, světla", () => {
    const doc = {
      resolution: { map_size: { x: 4, y: 4 }, pixels_per_grid: 100 },
      line_of_sight: [[{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }]],
      portals: [{ position: { x: 2, y: 0 }, bounds: [{ x: 2, y: 0 }, { x: 3, y: 0 }], closed: true }],
      lights: [{ position: { x: 1.5, y: 1.5 }, range: 30, color: "#ffaa00" }],
    };
    const r = importUvtt(doc as any);
    expect(r.mrizka?.length).toBe(4);
    expect(r.steny!.some((w) => w.typ === "wall")).toBe(true);
    expect(r.steny!.some((w) => w.typ === "door" && w.locked)).toBe(true);
    expect(r.svetla![0].bright).toBe(15);
  });
});

describe("generátory", () => {
  it("stejný seed → stejný výstup", () => {
    const a = genDungeon(30, 20, 42), b = genDungeon(30, 20, 42);
    expect(a.mrizka).toEqual(b.mrizka);
    expect(a.steny.length).toBe(b.steny.length);
    const c = genDungeon(30, 20, 43);
    expect(c.mrizka).not.toEqual(a.mrizka);
    const ca = genCave(30, 20, 7), cb = genCave(30, 20, 7);
    expect(ca.mrizka).toEqual(cb.mrizka);
  });
});

describe("migrateMap — uložené mapy", () => {
  it("původních 30 i nově přidané mapy migrují beze změny dlaždic", () => {
    expect(doc.mapy.length).toBeGreaterThanOrEqual(30);
    for (const m of doc.mapy) {
      const mig = migrateMap(m);
      expect(mig.mrizka).toEqual(m.mrizka);           // dlaždice netknuté
      const t = mkTok({ x: 0, y: 0 });
      // reachable nesmí havarovat (neověřujeme cesty — jen stabilitu)
      expect(() => reachable(t, 5, mig, [t])).not.toThrow();
    }
  });
});

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateMap, wallIndex, edgeBlocked, edgeBlocksSight, segmentsIntersect, type MapV2, type MapWall } from "./mapV2";
import { roomPolygon, rectanglePoints, pickAt, paintStroke } from "../../mapeditor/tools/ops";
import { sightBlocked } from "../rules/lighting";
import { coverOf } from "../rules/los";
import type { Token } from "../types";
import { MapPaintLayer } from "../components/MapAtmoLayers";
import { MapWallLayer } from "../components/MapV2Layers";
import { setManifests } from "../components/MapV2Layers";

const base = (): MapV2 => ({ id:"t", nazev:"Test", podklad:"les", mrizka:Array(10).fill("..........") });
const wall = (typ: MapWall["typ"] = "wall"): MapWall => ({ id:"w", a:[2.1,.2], b:[3.2,5.8], typ });

describe("arbitrary wall geometry", () => {
  it("preserves diagonal and fractional endpoints and door identity over repeated migration", () => {
    const m = { ...base(), steny:[wall("door"), { ...wall(), id:"f", a:[1.2,1.25], b:[4.8,1.25] }] };
    expect(migrateMap(migrateMap(m)).steny).toEqual(m.steny);
    expect(migrateMap({ ...base(), steny:[{ ...wall(), b:[2.1,.2] }] }).steny).toEqual([]);
    const door: MapWall = {id:"door", a:[3,0], b:[3,8], typ:"door"};
    expect(migrateMap({...base(),steny:[door]}).steny).toEqual([door]);
    expect(edgeBlocked(wallIndex([door]),2,2,3,2,undefined)).toBe(true);
    expect(edgeBlocked(wallIndex([door]),2,2,3,2,{door:true})).toBe(false);
    const rect = base();
    roomPolygon(rect,rectanglePoints([2,2],[6,6]));
    expect(edgeBlocked(wallIndex(rect.steny),1,3,2,3,undefined)).toBe(true);
  });
  it("blocks crossing steps, but not parallel/missing walls; door state controls move and sight", () => {
    for (const typ of ["wall","door","window","half","curtain","secret"] as const) {
      const idx = wallIndex([wall(typ)]);
      expect(edgeBlocked(idx,2,2,3,2,undefined)).toBe(typ !== "curtain");
      expect(edgeBlocksSight(idx,2,2,3,2,undefined)).toBe(["wall","door","curtain","secret"].includes(typ));
      expect(edgeBlocked(idx,0,0,1,0,undefined)).toBe(false);
    }
    const idx = wallIndex([wall("door")]);
    expect(edgeBlocked(idx,2,2,3,2,{w:true})).toBe(false);
    expect(sightBlocked(idx,.5,2.5,6.5,2.5,{w:true})).toBe(false);
    expect(sightBlocked(idx,.5,2.5,6.5,2.5,{w:false})).toBe(true);
    expect(edgeBlocked(wallIndex(),2,2,3,2,undefined)).toBe(false);
    expect(segmentsIntersect([0,0],[1,1],[2,2],[3,3])).toBe(false);
    expect(segmentsIntersect([0,0],[1,1],[1,1],[2,0])).toBe(true);
    expect(segmentsIntersect([0,0],[3,3],[1,1],[2,2])).toBe(true);
  });
  it("cover and rendered doors follow the exact angled segment", () => {
    const a = { id:"a", x:0,y:2,s:1 } as Token, b = { id:"b",x:6,y:2,s:1 } as Token;
    const m = { ...base(), steny:[wall()] };
    expect(coverOf(a,b,m,[])).toBe(9);
    expect(coverOf(a,b,{...m,steny:[wall("window")]},[])).toBe(0);
    expect(coverOf(a,b,{...m,steny:[wall("half")]},[])).toBe(2);
    const svg = renderToStaticMarkup(<MapWallLayer map={{...m,steny:[wall("door")]}} />);
    expect(Number(svg.match(/rotate\(([^)]+)/)?.[1])).toBeCloseTo(Math.atan2(5.6,1.1)*180/Math.PI);
  });
});

describe("rotated rooms, objects and textures", () => {
  it("creates a rotated rectangle or polygon in one operation, with optional image floor", () => {
    const m = base(), p = rectanglePoints([2,2],[6,4],30);
    roomPolygon(m,p,"hlina",30);
    expect(m.steny).toHaveLength(4);
    expect(m.steny![0].a).toEqual(p[0]);
    expect(m.malba![0]).toMatchObject({poly:true,r:30,p});
    expect(migrateMap(m).malba).toEqual(m.malba);
    expect(m.mrizka).toEqual(base().mrizka);
    const empty = base();
    roomPolygon(empty,[], "hlina");
    roomPolygon(empty,[[1,1],[1,1],[1,1]], "hlina");
    expect(empty.steny).toBeUndefined();
    roomPolygon(empty,p);
    expect(empty.malba).toBeUndefined();
    paintStroke(m,{id:"e",t:"hlina",b:.25,o:1,h:1,p:[[4,3]]},true);
    expect(m.malba).toEqual([]);
  });
  it("hit-tests the rotated local bounds at sub-cell precision", () => {
    const m = {...base(),objekty:[{id:"o",asset:"stul",x:3,y:3,w:4,h:.5,rot:90}]};
    expect(pickAt(m,3,4.7,true)).toEqual({kind:"objekt",id:"o"});
    expect(pickAt(m,4.7,3,true)).toBeNull();
    expect(pickAt({...base(),steny:[wall()]},2.65,3,true)).toEqual({kind:"stena",id:"w"});
  });
  it("migrates optional angles, rejects invalid angles and renders rotated image polygon masks", () => {
    const m = base();
    roomPolygon(m,rectanglePoints([1,1],[4,4]),"hlina",27);
    setManifests({}, {hlina:{id:"hlina",nazev:"Hlína",src:"hlina.webp",cells:4}});
    const svg = renderToStaticMarkup(<MapPaintLayer map={m} />);
    expect(svg).toContain('patternTransform="rotate(27)"');
    expect(svg).toContain('fill="white"');
    expect(migrateMap({...base(),malba:[{...m.malba![0],r:NaN}]}).malba![0].r).toBe(0);
    setManifests({}, {});
  });
});

import React from "react";
import mapStore from "../../../../../../11_Mapy/bojove_mapy.json";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateMap, cellInfo, wallIndex, edgeBlocked, type MapV2 } from "./mapV2";
import { terrainTexture } from "./terrainArt";
import { TILES } from "../types";
import { MapWallLayer, setManifests } from "../components/MapV2Layers";
import { MapPaintLayer } from "../components/MapAtmoLayers";

const maps = (mapStore.mapy as unknown as MapV2[]).filter(m => m.id.startsWith("epic-"));
const goals = [[18,10],[22,12],[12,11],[26,14],[27,13],[9,15]];

describe("saved epic map gallery", () => {
  it.each(maps.map((m,i) => [m.id,m,i] as const))("%s has playable starts and a route to its focal point", (_id, raw, i) => {
    const map = migrateMap(raw), H = map.mrizka.length, W = map.mrizka[0].length;
    expect(map).toEqual(migrateMap(map));
    for (const row of map.mrizka) for (const tile of row) expect(TILES[tile]).toBeDefined();
    for (const starts of Object.values(map.start || {})) for (const [x,y] of starts) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(W);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(H);
      expect(cellInfo(map,x,y).blocksMove, `blocked start ${x},${y}`).toBe(false);
    }
    const idx = wallIndex(map.steny), doors = Object.fromEntries((map.steny || []).filter(w => w.typ === "door").map(w => [w.id,true]));
    const start = map.start!.druzina![0], queue = [start], visited = new Set([start.join(",")]);
    for (let n=0;n<queue.length;n++) {
      const [x,y] = queue[n];
      for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
        const key = nx+","+ny;
        if (nx<0 || ny<0 || nx>=W || ny>=H || visited.has(key) || cellInfo(map,nx,ny).blocksMove || edgeBlocked(idx,x,y,nx,ny,doors)) continue;
        visited.add(key);queue.push([nx,ny]);
      }
    }
    expect(visited.has(goals[i].join(",")), "focal point unreachable with doors open").toBe(true);
    expect(visited.size).toBeGreaterThan(60);
  });
  it("uses image-backed lava, ice, rubble and pits, with textured walls and legacy fallback", () => {
    expect(terrainTexture("l","jeskyne")).toBe("lava");
    expect(terrainTexture("i","snih")).toBe("led");
    expect(terrainTexture("u","ruiny")).toBe("teren-rubble");
    expect(terrainTexture("h","ruiny")).toBe("teren-rubble");
    expect(terrainTexture("p","jeskyne")).toBe("teren-propast");
    setManifests({},{"teren-wall":{id:"teren-wall",nazev:"Zdivo",src:"wall.webp",cells:4}});
    const map = {...maps[0],steny:[{id:"w",a:[1,1] as [number,number],b:[5,2] as [number,number],typ:"wall" as const}]};
    expect(renderToStaticMarkup(<MapWallLayer map={map} />)).toContain("wall.webp");
    expect(renderToStaticMarkup(<MapWallLayer map={{...map,steny:[]}} />)).toBe("");
    setManifests({}, {});
    expect(renderToStaticMarkup(<MapWallLayer map={map} />)).toContain('stroke="#292524"');
  });
  it("paints crisp polygons directly and uses explicit alpha masks for soft paint", () => {
    setManifests({}, {floor:{id:"floor",nazev:"Podlaha",src:"floor.webp",cells:4}});
    const stroke = {id:"p",t:"floor",b:2,o:.8,h:1,poly:true,p:[[1,1],[5,1],[5,4]] as [number,number][]};
    const crisp = renderToStaticMarkup(<MapPaintLayer map={{...maps[0],malba:[stroke]}} />);
    expect(crisp).toMatch(/<path d="M24,24 L120,24 L120,96Z" fill="url\(#[^)]+tex\)" opacity="0.8"/);
    const soft = renderToStaticMarkup(<MapPaintLayer map={{...maps[0],malba:[{...stroke,h:.3}]}} />);
    expect(soft).toContain("mask-type:alpha");
    expect(soft).toContain('maskContentUnits="userSpaceOnUse"');
    expect(soft).toMatch(/<rect[^>]+mask="url/);
    setManifests({}, {});
    expect(renderToStaticMarkup(<MapPaintLayer map={{...maps[0],malba:[stroke]}} />)).not.toContain("<pattern");
  });
});

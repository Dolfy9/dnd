import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateMap, type MapV2 } from "./mapV2";
import { interiorPolygon, removeInteriorAt } from "../../mapeditor/tools/ops";
import { MapWeatherLayer, weatherExposureMask, weatherPreviewTexture, WeatherPicker } from "../components/MapMotion";
import { MapWallLayer, MapObjectLayer, setManifests } from "../components/MapV2Layers";
import { MapAnimatedScene } from "../components/MapAnimatedScene";

const base = (): MapV2 => ({ id:"roof",nazev:"Dům",podklad:"mesto",mrizka:["....","....","...."] });
const poly: [number,number][] = [[.5,.5],[3,.5],[3,2],[.5,2]];

describe("optional roof polygons", () => {
  it("preserves legacy maps and round-trips arbitrary floats without changing mechanics", () => {
    expect(migrateMap(base()).interiery).toBeUndefined();
    const m={...base(),interiery:[{id:"r",poly}]};
    expect(migrateMap(JSON.parse(JSON.stringify(m)))).toEqual(m);
    expect(migrateMap(m).mrizka).toEqual(base().mrizka);
  });
  it("rejects malformed, non-finite, empty and degenerate regions tolerantly", () => {
    for (const interiery of [null,{},[],[null], [{poly:[]}], [{poly:[[0,0],[1,1],[2,2]]}]])
      expect(migrateMap({...base(),interiery}).interiery).toEqual([]);
    const m=migrateMap({...base(),interiery:[{poly:[...poly,[NaN,2],["2",2],[3],[2,Infinity]]}]});
    expect(m.interiery).toEqual([{id:"interier0",poly}]);
    expect(migrateMap(m)).toEqual(m);
  });
  it("marks and unmarks only hit regions and owns its point data", () => {
    const m=base(), points=structuredClone(poly);
    interiorPolygon(m,points);points[0][0]=99;
    expect(m.interiery![0].poly).toEqual(poly);
    interiorPolygon(m,[]);interiorPolygon(m,[[0,0],[1,1],[2,2]]);
    interiorPolygon(m,[[0,0],[NaN,1],[2,0]]);
    expect(m.interiery).toHaveLength(1);
    removeInteriorAt(m,0,0);expect(m.interiery).toHaveLength(1);
    removeInteriorAt(m,1,1);expect(m.interiery).toEqual([]);
    removeInteriorAt(m,1,1);expect(m.interiery).toEqual([]);
  });
  it("cuts overlapping roofs out of all shared DOM weather, without changing pan/zoom geometry", () => {
    expect(weatherExposureMask(base())).toBeUndefined();
    const m={...base(),pocasi:{typ:"bourka" as const},interiery:[{id:"a",poly},{id:"b",poly}]};
    const svg=decodeURIComponent(weatherExposureMask(m)!);
    expect(svg).toContain('width="96" height="72"');
    expect(svg).toContain("mask-type:luminance");
    expect(svg.match(/<polygon/g)).toHaveLength(2);
    expect(svg).toContain('points="12,12 72,12 72,48 12,48" fill="black"');
    expect(renderToStaticMarkup(<MapWeatherLayer map={m} />)).toContain("mask-image:");
    expect(renderToStaticMarkup(<MapWeatherLayer map={{...m,interiery:[]}} />)).not.toContain("mask-image:");
  });
  it("themes weather cards and renders textured walls, aligned doors and shadow-free floor decals", () => {
    const html=renderToStaticMarkup(<WeatherPicker map={{...base(),malba:[{id:"p",t:"led",b:1,o:1,h:1,poly:true,p:poly}]}} onChange={()=>{}} />);
    expect(html).toContain("textury/led.webp");
    expect(weatherPreviewTexture()).toBe("teren-g");
    expect(weatherPreviewTexture({...base(),mrizka:["~~~~"]})).toBe("teren-voda");
    setManifests({"gen2-dvere":{id:"gen2-dvere",nazev:"Dveře",src:"door.webp"}, "d-mech":{id:"d-mech",nazev:"Mech",src:"moss.webp",z:-20}},
      {"teren-wall":{id:"teren-wall",nazev:"Kámen",src:"stone.webp",cells:4}});
    const walls=renderToStaticMarkup(<svg><MapWallLayer map={{...base(),steny:[
      {id:"w",a:[0,0],b:[4,0],typ:"wall"}, {id:"d",a:[1,1],b:[2,2],typ:"door"},
      {id:"v",a:[2,1],b:[3,2],typ:"window"}]}} /></svg>);
    expect(walls).toContain("data-wall-ao");expect(walls).toContain('stroke-width="7.8"');
    expect(walls).toContain("door.webp");expect(walls).toContain("rotate(45)");
    expect(walls).toContain('fill="#77a7b1"');
    const decal=renderToStaticMarkup(<svg><MapObjectLayer map={{...base(),objekty:[{id:"o",asset:"d-mech",x:1,y:1,w:2,h:2}]}} /></svg>);
    expect(decal).toContain("moss.webp");expect(decal).not.toContain("drop-shadow");
    const tone=renderToStaticMarkup(<svg><MapObjectLayer map={{...base(),objekty:[{id:"o",asset:"d-mech",x:1,y:1,w:2,h:2,tint:"#754c4c"}]}} /></svg>);
    expect(tone).toContain("feColorMatrix");
    const layered={...base(),objekty:[{id:"door",asset:"gen2-dvere",x:1,y:1,w:2,h:2},{id:"moss",asset:"d-mech",x:1,y:1,w:2,h:2}]};
    for (const html of [
      renderToStaticMarkup(<svg><MapObjectLayer map={layered} /></svg>),
      renderToStaticMarkup(<MapAnimatedScene map={layered} view={{x:0,y:0,k:1}}>{null}</MapAnimatedScene>),
    ]) expect(html.indexOf("moss.webp")).toBeLessThan(html.indexOf("door.webp"));
    setManifests({},{});
  });
});

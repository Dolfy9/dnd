import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateMap, normalizeWeather, WEATHER, type MapV2 } from "./mapV2";
import { resolveAnimation, animationPhase, MapWeatherLayer, MapWaterLayer, WeatherPicker } from "../components/MapMotion";
import { MapAnimatedScene, waterMask } from "../components/MapAnimatedScene";
import { setManifests } from "../components/MapV2Layers";

const base = (): MapV2 => ({id:"t",nazev:"Test",podklad:"les",mrizka:["gg~~","gggg"]});
describe("weather migration", () => {
  it("preserves legacy maps and accepts strings and optional fields", () => {
    expect(migrateMap(base()).pocasi).toBeUndefined();
    for (const [typ] of WEATHER) {
      expect(migrateMap({...base(),pocasi:typ}).pocasi).toEqual({typ,sila:.65,vitr:90});
    }
    const m = migrateMap({...base(),pocasi:{typ:"snih",sila:.8,vitr:125}});
    expect(migrateMap(m).pocasi).toEqual(m.pocasi);
  });
  it("sanitizes missing, malformed and non-finite weather", () => {
    for (const v of [null, undefined, {}, [], 7, "unknown"]) expect(normalizeWeather(v).typ).toBe("");
    expect(normalizeWeather({typ:"bourka",sila:4,vitr:-90})).toEqual({typ:"bourka",sila:1,vitr:270});
    expect(normalizeWeather({typ:"dest",sila:NaN,vitr:Infinity})).toEqual({typ:"dest",sila:.65,vitr:90});
  });
});
describe("image motion", () => {
  it("keeps animated imagery in HTML, static objects in SVG, and preserves visibility and transforms", () => {
    setManifests({portal:{id:"portal",nazev:"Portál",src:"portal.webp",anim:"portal"}},{});
    const map = {...base(),objekty:[
      {id:"p",asset:"portal",x:1,y:1,w:2,h:2,rot:37,flip:true},
      {id:"hidden",asset:"portal",x:2,y:1,w:1,h:1,dmOnly:true},
      {id:"static",asset:"portal",x:3,y:1,w:1,h:1,anim:false as const},
    ]};
    const html = renderToStaticMarkup(<MapAnimatedScene map={map} view={{x:12,y:8,k:2}}><rect /></MapAnimatedScene>);
    expect(html).toContain("translate(12px,8px) scale(2)");
    expect(html).toContain("rotate(37deg) scaleX(-1)");
    expect(html.match(/class="map-dom-sprite"/g)).toHaveLength(1);
    expect(html).toContain('class="map-anim-portal"');
    expect(html).toContain("<image");
    expect(renderToStaticMarkup(<MapAnimatedScene map={base()} view={{x:0,y:0,k:1}}>{null}</MapAnimatedScene>)).not.toContain("map-dom-sprite");
    expect(waterMask({...base(),mrizka:["gg"]})).toBe("");
    expect(decodeURIComponent(waterMask(base()))).toContain('x="48"');
    expect(decodeURIComponent(waterMask({...base(),malba:[{id:"p",t:"hlina",b:1,o:1,h:1,p:[[1,1]]}]}))).toContain('stroke="black"');
  });
  it("resolves explicit overrides, manifest metadata and disabled/unknown assets", () => {
    const asset = {id:"p",nazev:"Portál",src:"p.webp",anim:"portal" as const};
    expect(resolveAnimation({},asset)).toBe("portal");
    expect(resolveAnimation({}, {...asset,anim:undefined,tags:["zare"]})).toBe("zare");
    expect(resolveAnimation({}, {...asset,id:"custom-portal",anim:undefined})).toBe("portal");
    expect(resolveAnimation({anim:false},asset)).toBe("");
    expect(resolveAnimation({anim:"vitr"},asset)).toBe("vitr");
    expect(resolveAnimation({anim:"bad"},asset)).toBe("");
    expect(resolveAnimation({})).toBe("");
    expect(animationPhase("tree")).toBe(animationPhase("tree"));
    expect(animationPhase("tree")).not.toBe(animationPhase("other"));
  });
  it("renders generated weather images, wind, no empty weather, and water-only caustic masks", () => {
    expect(renderToStaticMarkup(<MapWeatherLayer map={base()} />)).toBe("");
    expect(renderToStaticMarkup(<MapWeatherLayer map={{...base(),pocasi:{typ:"dest",sila:0}}} />)).toBe("");
    const storm = renderToStaticMarkup(<MapWeatherLayer map={{...base(),pocasi:{typ:"bourka",sila:1,vitr:120}}} />);
    expect(storm).toContain("blesk.webp");
    expect(storm).toContain("dest2-svetly.webp");
    expect(storm).toContain("--wind:30deg");
    const water = renderToStaticMarkup(<MapWaterLayer map={base()} />);
    expect(water).toContain("vlny.webp");
    expect(water).toContain('x="48"');
    expect(renderToStaticMarkup(<MapWaterLayer map={{...base(),mrizka:["gggg"]}} />)).toBe("");
    expect(renderToStaticMarkup(<WeatherPicker value={{typ:"snih"}} onChange={() => {}} />)).toContain('aria-pressed="true"');
  });
});

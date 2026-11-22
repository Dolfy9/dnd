import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateMap, normalizeWeather, WEATHER, type MapV2 } from "./mapV2";
import { resolveAnimation, animationPhase, MapWeatherLayer, MapWaterLayer, WeatherPicker } from "../components/MapMotion";

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
    expect(storm).toContain("dest2.webp");
    expect(storm).toContain("--wind:30deg");
    const water = renderToStaticMarkup(<MapWaterLayer map={base()} />);
    expect(water).toContain("vlny.webp");
    expect(water).toContain('x="48"');
    expect(renderToStaticMarkup(<MapWaterLayer map={{...base(),mrizka:["gggg"]}} />)).toBe("");
    expect(renderToStaticMarkup(<WeatherPicker value={{typ:"snih"}} onChange={() => {}} />)).toContain('aria-pressed="true"');
  });
});

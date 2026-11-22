import React from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BattleTerrain } from "./BattleTerrain";
import { setManifests } from "./MapV2Layers";
import type { MapV2 } from "../model/mapV2";
import { tileAt, tileDef } from "../rules/grid";

it("renders battle-painted walls over opaque saved paint without changing collision", () => {
  const map: MapV2 = { id:"p", nazev:"P", podklad:"mesto", mrizka:["..."],
    malba:[{id:"floor", t:"drevo", b:1, o:1, h:1, poly:true, p:[[0,0],[3,0],[3,1],[0,1]]}] };
  setManifests({}, Object.fromEntries(["drevo","teren-wall"].map(id => [id, {id,nazev:id,src:id+".webp",cells:2}])));
  const S = { teren:{"1,0":"#"} };
  for (const illustration of [false,true]) {
    const html = renderToStaticMarkup(<svg><BattleTerrain map={map} S={S} illustration={illustration} /></svg>);
    expect(html.lastIndexOf("teren-wall.webp")).toBeGreaterThan(html.indexOf("data-map-paint"));
    expect(tileDef(tileAt(map,1,0,S.teren)).cost).toBe(0);
  }
  const empty = renderToStaticMarkup(<svg><BattleTerrain map={map} S={{}} illustration={false} /></svg>);
  expect(empty.lastIndexOf("data-terrain-art")).toBeLessThan(empty.indexOf("data-map-paint"));
  setManifests({}, {});
});

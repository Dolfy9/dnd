import React from "react";
import manifest from "../../../../../../11_Mapy/bojove/assets/assety.json";
import textureManifest from "../../../../../../11_Mapy/bojove/textury/textury.json";
import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {MapObjectLayer,setManifests} from "../../boj/components/MapV2Layers";
import {MapAnimatedScene} from "../../boj/components/MapAnimatedScene";
import {MapPreview} from "../components/MapPreview";
import {VariantStrip} from "../components/VariantStrip";
import {castsShadow} from "../../boj/model/objectShadows";
import type {AssetEntry} from "./manifest";

const entries=manifest.assety as AssetEntry[];
const assets=Object.fromEntries(entries.map(e=>[e.id,e]));
it("imports stable contiguous reference variants, intact replacement slots and solid metadata",()=>{
 const added=entries.filter(e=>/^(p-|z-)/.test(e.id));expect(added).toHaveLength(21);
 for(const a of added){
  expect(a.varianty?.length || 0).toBe(["z-jezirko-fontana","z-rotunda-ruina"].includes(a.id)?0:3);
  a.varianty?.forEach((src,i)=>expect(src).toMatch(new RegExp(`/${a.id}-v${i+1}\\.webp$`)));
 }
 for(const id of ["p-lodni-kolik","z-socha-kral","z-sloup-zlomeny","z-jezirko-fontana","z-rotunda-ruina","z-urna-kamen"]){
  expect(castsShadow({id:"o",asset:id,x:1,y:1,w:1,h:1},assets[id])).toBe(true);
 }
 for(const id of ["p-site","z-brectan-previs","z-kvetinovy-zahon"])expect(castsShadow({id:"o",asset:id,x:1,y:1,w:1,h:1},assets[id])).toBe(false);
 expect(assets["p-lodka"]).toMatchObject({w:1.5,h:4});expect(assets["p-nastenna-lucerna"].light).toEqual({bright:15,dim:15});
});
it("indexes usable reference textures and four firefly slots without importing rejected tiles",()=>{
 const textures=textureManifest.textury;
 const added=textures.filter((t:{id:string})=>t.id.startsWith("t-"));expect(added).toHaveLength(8);
 for(const t of added)expect(t.cells).toBe(4);
 expect(textures.some((t:{id:string})=>["t-molo-prkna","t-zed-brectan"].includes(t.id))).toBe(false);
 expect(assets["ov-svetlusky"].varianty).toHaveLength(3);
 for(const a of entries.filter(a=>a.id.startsWith("ov-"))){expect(a.blend).toBe("screen");expect(a.z).toBe(-1);}
});
it("screens effects against terrain in static previews and the live scene, leaving ordinary objects unchanged",()=>{
 setManifests(assets,{});
 const map={id:"m",nazev:"M",podklad:"dungeon" as const,mrizka:["........"],objekty:[{id:"effect",asset:"ov-svetlusky",x:2,y:2,w:3,h:3,z:-1}]};
 expect(renderToStaticMarkup(<svg><MapObjectLayer map={map}/></svg>)).toContain("mix-blend-mode:screen");
 expect(renderToStaticMarkup(<MapAnimatedScene map={map} view={{x:0,y:0,k:1}} lights={false}>{null}</MapAnimatedScene>)).toMatch(/class="map-scene-static"[^>]*style="mix-blend-mode:screen"/);
 const ordinary={...map,objekty:[{...map.objekty[0],asset:"p-lodka"}]};
 expect(renderToStaticMarkup(<svg><MapObjectLayer map={ordinary}/></svg>)).not.toContain("mix-blend-mode:screen");
 expect(renderToStaticMarkup(<VariantStrip entry={assets["ov-svetlusky"]} onChange={()=>{}}/>).match(/mix-blend-mode:screen/g)).toHaveLength(4);
 expect(renderToStaticMarkup(<svg><MapObjectLayer map={{...map,objekty:[]}}/></svg>)).not.toContain("mix-blend-mode");
});
it("screens every D1 effect when animation selects the DOM sprite path, also in static exports",()=>{
 setManifests(assets,{});
 for(const asset of ["ov-svetlusky","ov-mlha-chuchvalec","ov-mesic-odlesk","ov-paprsky"]){
  const map={id:"m",nazev:"M",podklad:"dungeon" as const,mrizka:["........"],objekty:[{id:"animated-effect",asset,x:2,y:2,w:3,h:3,anim:"vitr"}]};
  const scene=renderToStaticMarkup(<MapAnimatedScene map={map} view={{x:0,y:0,k:1}} lights={false}>{null}</MapAnimatedScene>);
  expect(scene).toMatch(/class="map-dom-sprite"[^>]*style="[^"]*mix-blend-mode:screen/);
  expect(renderToStaticMarkup(<MapPreview map={map} staticLighting/>)).toContain("mix-blend-mode:screen");
  const ordinary={...map,objekty:[{...map.objekty[0],asset:"p-lodka"}]};
  expect(renderToStaticMarkup(<MapAnimatedScene map={ordinary} view={{x:0,y:0,k:1}} lights={false}>{null}</MapAnimatedScene>)).not.toContain("mix-blend-mode:screen");
 }
});

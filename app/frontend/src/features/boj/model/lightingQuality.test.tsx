import React from "react";
import {afterEach,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import manifest from "../../../../../../11_Mapy/bojove/assets/assety.json";
import profiles from "../../../../../../11_Mapy/bojove/assets/stiny.json";
import type {AssetEntry} from "../../mapeditor/assets/manifest";
import {castsShadow,objectHeight,objectFootprint,finiteLightShadows,directionalShadow} from "./objectShadows";
import {migrateMap,type MapObject,type MapV2} from "./mapV2";
import {setManifests} from "../components/MapV2Layers";
import {MapAtmosphereArtwork} from "../components/MapAtmoLayers";
import {ObjectArtworkMask,ObjectShadowMask} from "../components/ObjectLightMask";
import {contactShadowPlan} from "../components/MapContactShadows";
import {ObjectInspector} from "../../mapeditor/components/ObjectInspector";

const assets=Object.fromEntries((manifest.assety as AssetEntry[]).map(a=>[a.id,a]));
const object:MapObject={id:"o",asset:"bedna",x:5,y:5,w:2,h:2};
const light={id:"l",x:2,y:5,bright:20,dim:30};
afterEach(()=>setManifests({},{}));

it("classifies flat, low and tall artwork independently of movement blocking",()=>{
 for(const id of ["z-kvetinovy-zahon","p-site","z-brectan-previs","ov-svetlusky"]){
  expect(castsShadow({...object,asset:id,blocks:true},assets[id])).toBe(false);
 }
 for(const id of ["z-lavicka-kamen","bedna","sud","z-ruze-ker"])expect(objectHeight({...object,asset:id},assets[id])).toBe(.6);
 for(const id of ["z-socha-kral","z-sloup-zlomeny","z-strom-koruna","z-rotunda-ruina"])expect(objectHeight({...object,asset:id},assets[id])).toBe(3);
 expect(castsShadow({...object,vyska:0,stin:true},assets.bedna)).toBe(false);
 expect(castsShadow({...object,vyska:3,stin:false},assets.bedna)).toBe(false);
 expect(castsShadow({...object,vyska:NaN},assets.bedna)).toBe(false);
 expect(castsShadow({...object,asset:"img:custom.png",stin:true})).toBe(true);
 expect(objectHeight({...object,vyska:Infinity})).toBe(0);
});

it("ships bounded opaque hulls for every sprite variant and transforms the actual aspect-fitted outline",()=>{
 const all=profiles as Record<string,{hulls:number[][][];ratios:number[]}>;
 for(const a of Object.values(assets)){
  const p=all[a.id];expect(p.hulls).toHaveLength(1+(a.varianty?.length || 0));
  for(const hull of p.hulls){expect(hull.length).toBeLessThanOrEqual(20);expect(hull.length).toBeGreaterThanOrEqual(3);expect(hull.flat().every(n=>n>=0 && n<=1)).toBe(true);}
 }
 const points=objectFootprint(object,assets.bedna),rotated=objectFootprint({...object,rot:90,flip:true},assets.bedna);
 points.forEach(([x,y],i)=>{expect(rotated[i][0]).toBeCloseTo(10-y);expect(rotated[i][1]).toBeCloseTo(10-x);});
 expect(objectFootprint({...object,v:NaN},assets.bedna)).toEqual(points);
 expect(objectFootprint({...object,v:1},assets.bedna)).not.toEqual(points);
});

it("casts finite fading shadows, with short partial low occlusion and long strong tall occlusion",()=>{
 const low=finiteLightShadows(light,[object],assets),tall=finiteLightShadows(light,[{...object,vyska:3}],assets);
 expect(low).toHaveLength(1);expect(tall).toHaveLength(1);
 expect(low[0].to[0]-5).toBeLessThan(1);expect(tall[0].to[0]-5).toBeGreaterThan(3);
 expect(low[0].opacity).toBeLessThan(tall[0].opacity);expect(low[0].softness).toBeGreaterThan(tall[0].softness);
 expect(Math.max(...tall[0].polygon.map(p=>p[0]))).toBeLessThan(13);
 expect(low[0].outline).toEqual(objectFootprint(object,assets.bedna));
 const html=renderToStaticMarkup(<ObjectShadowMask id="s" shadows={tall} width={480} height={480}/>);
 expect(html).toContain('fill-rule="evenodd"');expect(html).toContain('offset="1" stop-color="black" stop-opacity="0"');
 expect(finiteLightShadows(light,[{...object,tint:"#ff0000"}],assets)).toBe(low);
 expect(finiteLightShadows(light,[{...object,v:1}],assets)).not.toBe(low);
 expect(finiteLightShadows(light,[{...object,vyska:0}],assets)).toEqual([]);
 expect(finiteLightShadows(light,[],assets)).toEqual([]);
 expect(finiteLightShadows({...light,stiny:false},[object],assets)).toEqual([]);
 expect(finiteLightShadows({...light,x:500},[object],assets)).toEqual([]);
 expect(finiteLightShadows({...light,x:5},[object],assets)).toEqual([]);
 expect(directionalShadow(object,[{...light,stiny:false}])).toBeUndefined();
 const plan=contactShadowPlan({id:"m",nazev:"M",podklad:"jine",mrizka:[".........."],objekty:[object],svetla:[light]},assets);
 expect(plan[0].outline).toEqual(low[0].outline);
});

it("removes glow by sprite alpha without excluding objects from ambient darkness",()=>{
 setManifests(assets,{});
 const map:MapV2={id:"m",nazev:"M",podklad:"jine",mrizka:Array(10).fill(".........."),objekty:[object],svetla:[light],atmosfera:{amb:.2,barva:"#101522"}};
 const glow=renderToStaticMarkup(<MapAtmosphereArtwork map={map} layer="glow"/>),dark=renderToStaticMarkup(<MapAtmosphereArtwork map={map} layer="darkness"/>);
 expect(glow).toContain('data-glow-exclusion="o"');expect(glow).toContain('data-finite-object-shadow="o"');
 expect(glow).toContain('artwork)" style="mix-blend-mode:screen"');
 expect(dark).not.toContain('data-glow-exclusion');expect(dark).toContain('data-finite-object-shadow="o"');
 expect(glow).toContain('mask-type:luminance');expect(glow).toContain('preserveAspectRatio="xMidYMid meet"');
 const empty=renderToStaticMarkup(<ObjectArtworkMask id="e" objects={[]} assets={assets} width={24} height={24}/>);
 expect(empty).not.toContain('<image');
 const hidden=renderToStaticMarkup(<ObjectArtworkMask id="e" objects={[{...object,dmOnly:true}]} assets={assets} width={24} height={24}/>);
 expect(hidden).not.toContain('<image');
 const html=renderToStaticMarkup(<ObjectInspector objects={[object]} assets={assets} push={()=>{}} onVariant={()=>{}} onAction={()=>{}} onDelete={()=>{}}/>);
 expect(html).toContain('aria-label="Výška pro stíny"');expect(html).toContain('Nízké · krátký měkký stín');
 expect(migrateMap(JSON.parse(JSON.stringify({...map,objekty:[{...object,vyska:3}]}))).objekty![0].vyska).toBe(3);
});

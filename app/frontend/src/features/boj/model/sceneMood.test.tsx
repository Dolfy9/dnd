import React from "react";
import {afterEach,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {migrateMap,type MapV2} from "./mapV2";
import {MapObjectLayer,setManifests} from "../components/MapV2Layers";
import {MapAnimatedScene} from "../components/MapAnimatedScene";
import {MapAtmosphereArtwork} from "../components/MapAtmoLayers";
import {ObjectInspector} from "../../mapeditor/components/ObjectInspector";

const map:MapV2={id:"m",nazev:"Noc",podklad:"les",mrizka:["....","...."],objekty:[{id:"mist",asset:"mist",x:2,y:1,w:2,h:2,opacity:.2,stin:false}]};
const assets={mist:{id:"mist",nazev:"Mlha",src:"mist.webp",blend:"screen" as const}};
afterEach(()=>setManifests({},{}));

it("round-trips optional mood controls without changing legacy defaults",()=>{
 const input={...map,atmosfera:{amb:.25,barva:"#081421",vineta:.6}};
 expect(migrateMap(JSON.parse(JSON.stringify(input)))).toEqual(input);
 expect(migrateMap({...map,objekty:undefined}).objekty).toBeUndefined();
 expect(migrateMap({...map,objekty:[]}).objekty).toEqual([]);
 expect(migrateMap({...map,objekty:[{...map.objekty![0],opacity:NaN}],atmosfera:{amb:1,barva:"#101522",vineta:Infinity}})).toMatchObject({objekty:[{opacity:1}],atmosfera:{vineta:0}});
 for(const [value,want] of [[-2,0],[2,1]])expect(migrateMap({...map,objekty:[{...map.objekty![0],opacity:value}],atmosfera:{amb:1,barva:"#101522",vineta:value}})).toMatchObject({objekty:[{opacity:want}],atmosfera:{vineta:want}});
});

it("uses object opacity in static export and animated scene artwork, including GM ghosting",()=>{
 setManifests(assets,{});
 const html=renderToStaticMarkup(<MapObjectLayer map={map}/>);
 expect(html).toContain('opacity="0.2"');
 expect(html).toContain('mix-blend-mode:screen');
 setManifests({mist:{...assets.mist,anim:"vitr"}},{});
 const animated=renderToStaticMarkup(<MapAnimatedScene map={map} view={{x:0,y:0,k:1}}><g/></MapAnimatedScene>);
 expect(animated).toContain('opacity:0.2');
 const ghost=renderToStaticMarkup(<MapObjectLayer map={{...map,objekty:[{...map.objekty![0],dmOnly:true}]}} dm/>);
 expect(ghost).toContain('opacity="0.11000000000000001"');
 const inspector=renderToStaticMarkup(<ObjectInspector objects={map.objekty!} assets={assets} push={()=>{}} onVariant={()=>{}} onAction={()=>{}} onDelete={()=>{}}/>);
 expect(inspector).toContain('aria-label="Neprůhlednost objektu"');
});

it("bakes vignette only into darkness and keeps it available without ambient darkness or lights",()=>{
 const input={...map,objekty:[],atmosfera:{amb:1,barva:"#101522",vineta:.7}};
 const dark=renderToStaticMarkup(<MapAtmosphereArtwork map={input} layer="darkness"/>);
 expect(dark).toContain('data-map-vignette="true"');
 expect(dark).toContain('stop-opacity="0.7"');
 expect(renderToStaticMarkup(<MapAtmosphereArtwork map={input} layer="glow"/>)).not.toContain('data-map-vignette');
 expect(renderToStaticMarkup(<MapAtmosphereArtwork map={{...input,atmosfera:{...input.atmosfera,vineta:0}}}/>)).toBe("");
});

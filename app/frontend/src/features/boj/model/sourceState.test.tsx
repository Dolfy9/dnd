import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {migrateMap,type MapObject,type MapV2} from "./mapV2";
import {mechanicalLights,objectLights,sourceAssets,sourceAt,sourceMap,sourceOn,toggleable,toggleBattleSource,toggleSources} from "./sourceState";
import {migrate} from "../rules/migrate";
import {lightAt} from "../rules/lighting";
import {toggleSource} from "../state/commands/sources";
import {SourceArtwork} from "../components/SourceArtwork";
import {MapAnimatedScene} from "../components/MapAnimatedScene";
import {MapObjectLayer,MapWallLayer,setManifests} from "../components/MapV2Layers";
import {visualLights} from "../components/MapAtmoLayers";
import {resolveAnimation} from "../components/MapMotion";
import {ObjectArtworkMask} from "../components/ObjectLightMask";

const torch:MapObject={id:"torch",asset:"gen2-pochoden",x:3,y:3,w:1,h:2};
const map:MapV2={id:"m",nazev:"M",podklad:"dungeon",mrizka:Array(15).fill("..............."),objekty:[torch],svetla:[{id:"light",x:12,y:12,bright:5,dim:5,zap:false}]};
const state=()=>migrate({lightLevel:"dark"});

it("defaults legacy sources on and round-trips explicit map and battle source state",()=>{
 expect(sourceOn(torch)).toBe(true);
 expect(sourceOn({...torch,zap:false})).toBe(false);
 const saved=migrateMap(JSON.parse(JSON.stringify({...map,objekty:[{...torch,zap:false}]})));
 expect(saved.objekty![0].zap).toBe(false);expect(saved.svetla![0].zap).toBe(false);
 expect(sourceMap(saved,{torch:true,light:true}).objekty![0].zap).toBe(true);
 expect(sourceMap(saved,{torch:true,light:true}).svetla![0].zap).toBe(true);
 expect(saved.objekty![0].zap).toBe(false);
 expect(sourceMap(map)).toBe(map);
 expect(migrate({zdroje:{torch:false}}).zdroje).toEqual({torch:false});
});

it("classifies all manifest lights/animations and supplied off artwork as toggleable",()=>{
 const imported=Object.values(sourceAssets).filter(a=>a.srcVyp);
 expect(imported).toHaveLength(20);
 for(const a of Object.values(sourceAssets))if(a.light || a.anim || a.srcVyp)expect(a.prepinatelny).toBe(true);
 for(const a of imported){expect(toggleable({...torch,asset:a.id},a)).toBe(true);expect(a.srcVyp).toMatch(/-vyp\.webp$/);}
 expect(toggleable({...torch,asset:"bedna"},sourceAssets.bedna)).toBe(false);
 expect(toggleable({...torch,asset:"custom",anim:"portal"})).toBe(true);
 expect(toggleable({...torch,asset:"custom",light:{bright:5,dim:5}})).toBe(true);
});

it("batch toggles only selected sources, turning a mixed selection on together",()=>{
 const m=structuredClone({...map,objekty:[torch,{...torch,id:"other",zap:false},{...torch,id:"box",asset:"bedna"}]}),ids=new Set(["torch","box","light"]);
 toggleSources(m,ids,sourceAssets);
 expect(m.objekty!.map(o=>o.zap)).toEqual([true,false,undefined]);expect(m.svetla![0].zap).toBe(true);
 toggleSources(m,ids,sourceAssets);
 expect(m.objekty!.map(o=>o.zap)).toEqual([false,false,undefined]);expect(m.svetla![0].zap).toBe(false);
 const empty=structuredClone(map);toggleSources(empty,new Set(),sourceAssets);expect(empty).toEqual(map);
});

it("suppresses map, object and carried mechanical lights off, and keeps legacy seeded map defaults",()=>{
 const S=state();
 expect(lightAt(S,map,3,3)).toBe("bright");
 S.zdroje={torch:false};expect(lightAt(S,map,3,3)).toBe("dark");
 S.zdroje={light:true};expect(lightAt(S,map,12,12)).toBe("bright");
 expect(lightAt(S,sourceMap(map,{torch:false}),3,3)).toBe("dark");
 S.lights=[{id:"light",nazev:"Old seed",anchor:[12,12],bright:5,dim:5}];S.zdroje={torch:false};
 expect(lightAt(S,map,12,12)).toBe("dark");
 S.lights=[{id:"carried",nazev:"Lantern",anchor:[3,3],bright:5,dim:5,zap:false}];
 expect(mechanicalLights(S,map)).toEqual([]);
 expect(objectLights({...map,objekty:[{...torch,dmOnly:true}]})).toEqual([]);
 expect(mechanicalLights(state(),{...map,objekty:[],svetla:[]})).toEqual([]);
});

it("lets only the GM change known sources, logs in Czech, and never mutates the map",()=>{
 const S=state(),original=structuredClone(map);
 expect(toggleBattleSource(S,map,"torch",false)).toBeUndefined();
 expect(toggleBattleSource(S,map,"missing",true)).toBeUndefined();
 expect(S.zdroje).toBeUndefined();
 toggleSource(S,map,"torch",true);
 expect(S.zdroje).toEqual({torch:false});
 expect(S.log[S.log.length-1]).toMatchObject({typ:"system",kdo:"PJ",t:sourceAssets[torch.asset].nazev+": vypnuto"});
 expect(S.log[S.log.length-1]?.pj).toBeUndefined();
 toggleSource(S,map,"torch",true);expect(S.zdroje!.torch).toBe(true);
 toggleSource(S,map,"light",true);expect(S.zdroje!.light).toBe(true);
 const count=S.log.length;toggleSource(S,map,"torch",false);toggleSource(S,map,"invalid",true);expect(S.log).toHaveLength(count);
 expect(map).toEqual(original);
});

it("hit tests rotated source footprints and standalone lights, not ordinary objects",()=>{
 expect(sourceAt(map,3,3)?.id).toBe("torch");expect(sourceAt(map,12,12)?.id).toBe("light");
 expect(sourceAt(map,6,6)).toBeUndefined();expect(sourceAt({...map,objekty:[{...torch,rot:90}]},3.8,3)?.id).toBe("torch");
 expect(sourceAt({...map,objekty:[{...torch,asset:"bedna"}]},3,3)).toBeUndefined();
});

it("uses one off image across variants, darkens unsupported/custom artwork, and stops portal animation and light",()=>{
 setManifests(sourceAssets,{});
 const asset=sourceAssets[torch.asset],off={...torch,zap:false,v:1};
 for(const svg of [true,false]){
  const art=renderToStaticMarkup(<SourceArtwork object={off} asset={asset} svg={svg}/>);
  expect(art).toContain(asset.srcVyp);expect(art).toMatch(/opacity:0[^>]*data-source-art="on"/);expect(art).toMatch(/opacity:1[^>]*data-source-art="off"/);
 }
 const fallback=renderToStaticMarkup(<SourceArtwork object={off} src="/repo/custom.webp"/>);
 expect(fallback).toContain("brightness(.35) saturate(.25)");expect(fallback).toContain("/repo/custom.webp");
 const motion=renderToStaticMarkup(<SourceArtwork object={torch} asset={asset} className="map-anim-ohen"/>);
 expect(motion).toMatch(/<span[^>]+opacity:1[^>]+data-source-art="on"><img class="map-anim-ohen"/);
 const portal={...off,asset:"gen2-portal",light:{bright:10,dim:10}},m={...map,objekty:[portal]};
 expect(resolveAnimation(portal,sourceAssets[portal.asset])).toBe("");
 expect(visualLights(m,sourceAssets)).toEqual([]);
 expect(visualLights({...m,objekty:[{...portal,zap:true}]},sourceAssets)).not.toHaveLength(0);
 const staticArt=renderToStaticMarkup(<MapObjectLayer map={m}/>),animated=renderToStaticMarkup(<MapAnimatedScene map={m} view={{x:0,y:0,k:1}}>{null}</MapAnimatedScene>);
 expect(staticArt).toContain('data-source-state="off"');expect(animated).toContain('data-source-state="off"');
 expect(animated).not.toContain('class="map-anim-portal"');expect(animated).not.toContain('data-animated-light');
 const mask=renderToStaticMarkup(<ObjectArtworkMask id="off" objects={[portal]} assets={sourceAssets} width={360} height={360}/>);
 expect(mask).toContain(sourceAssets[portal.asset].srcVyp);
});

it("swings straight and angled door leaves about their first endpoint, using battle overrides",()=>{
 for(const b of [[5,3],[5,5]] as [number,number][]){
  const m={...map,steny:[{id:"door",a:[3,3] as [number,number],b,typ:"door" as const}]};
  const closed=renderToStaticMarkup(<MapWallLayer map={m}/>),open=renderToStaticMarkup(<MapWallLayer map={m} doors={{door:true}}/>);
  expect(closed).toContain('data-door-open="false"');expect(open).toContain('data-door-open="true"');
  expect(open).toContain('translate(72,72) rotate(');expect(open).toContain('transform:rotate(-85deg);transform-origin:0px 0px');
 }
 expect(renderToStaticMarkup(<MapWallLayer map={{...map,steny:[]}}/>)).not.toContain('source-door-leaf');
});

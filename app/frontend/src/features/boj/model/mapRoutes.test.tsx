import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {cellInfo,migrateMap,wallIndex,edgeBlocked,type MapV2,type MapRoute} from "./mapV2";
import {deckAt,mapWalls,normalizeRoutes,routeGeometry,routeContains,sampleRoute,smoothRoute} from "./mapRoutes";
import {tileAt} from "../rules/grid";
import {lightAt,sightBlocked} from "../rules/lighting";
import {coverOf} from "../rules/los";
import type {StavBoje,Token} from "../types";
import {MapRouteLayer} from "../components/MapRouteLayer";
import {MapPreview} from "../../mapeditor/components/MapPreview";
import {MapAnimatedScene} from "../components/MapAnimatedScene";
import {setManifests} from "../components/MapV2Layers";
import {pickAt,pickInRect,moveSel,duplicateRoutes,eraseAt} from "../../mapeditor/tools/ops";
import {lightBlockers,visibilityPolygon,pointInPolygon} from "./lightGeometry";
import assets from "../../../../../../11_Mapy/bojove/assets/assety.json";
import textures from "../../../../../../11_Mapy/bojove/textury/textury.json";
import type {AssetEntry} from "../../mapeditor/assets/manifest";

const route:MapRoute={id:"r",druh:"plot",pts:[[4,0],[4,8]],sirka:.75,hladke:false,seed:42};
const map:MapV2={id:"m",nazev:"M",podklad:"les",mrizka:Array(9).fill("........."),trasy:[route]};
it("migrates routes without modifying legacy maps and rejects invalid or degenerate routes",()=>{
 expect(migrateMap({...map,trasy:undefined}).trasy).toBeUndefined();
 expect(normalizeRoutes(null)).toEqual([]);
 expect(normalizeRoutes([null,{...route,druh:"bad"},{...route,pts:[[NaN,0],[1,1]]},{...route,pts:[[1,1],[1,1]]}])).toEqual([]);
 const result=migrateMap({...map,trasy:[{...route,id:undefined,sirka:Infinity,hladke:undefined,pts:[[1.25,2.1],[1.25,2.1],[4,3]]}]});
 expect(result.trasy![0]).toMatchObject({id:"trasa0",sirka:1,hladke:true,pts:[[1.25,2.1],[4,3]]});
 expect(migrateMap(JSON.parse(JSON.stringify(result)))).toEqual(result);
 expect(normalizeRoutes([{...route,sirka:100},{...route,sirka:-2}]).map(r=>r.sirka)).toEqual([12,.25]);
});
it("smooths through control points, keeps endpoints and caches deterministic tangent layouts",()=>{
 const pts:MapRoute["pts"]=[[1,1],[4,3],[7,1]];
 const smooth=smoothRoute(pts);expect(smooth[0]).toEqual(pts[0]);expect(smooth[smooth.length-1]).toEqual(pts[pts.length-1]);expect(smooth).toContainEqual(pts[1]);expect(smooth.length).toBeGreaterThan(3);
 expect(smooth.flat().every(Number.isFinite)).toBe(true);expect(smoothRoute([],true)).toEqual([]);expect(smoothRoute(pts,false)).toEqual(pts);
 expect(sampleRoute(pts,0)).toEqual([]);expect(sampleRoute([[1,1],[1,1]],1)).toEqual([]);
 const a=routeGeometry({...route,pts,hladke:true});expect(routeGeometry({...route,pts,hladke:true})).toBe(a);
 expect(routeGeometry({...route,pts,hladke:true,seed:43}).sprites).not.toEqual(a.sprites);
 const straight=routeGeometry(route);expect(straight.sprites.every(s=>s.angle===90)).toBe(true);
 const pier=routeGeometry({...route,druh:"molo",pts,hladke:true});expect(pier.planks.length).toBeGreaterThan(3);
 expect(pier.planks.every(s=>s.width>0&&s.height>0&&[s.x,s.y,s.angle,s.width,s.height].every(Number.isFinite))).toBe(true);
 for(let i=1;i<straight.sprites.length;i++)expect(straight.sprites[i].distance-straight.sprites[i-1].distance).toBeLessThanOrEqual(route.sirka*.55+1e-8);
 expect(routeContains(route,4,3)).toBe(true);expect(routeContains(route,6,3)).toBe(false);
});
it("derives cached hedge walls blocking movement, LOS and light; low walls give half cover but transmit light",()=>{
 const walls=mapWalls(map);expect(mapWalls(map)).toBe(walls);expect(map.steny).toBeUndefined();
 expect(edgeBlocked(wallIndex(walls),3,3,4,3,undefined)).toBe(true);
 expect(sightBlocked(wallIndex(walls),1.5,3.5,7.5,3.5)).toBe(true);
 const state={tok:[],zones:[],lights:[{id:"l",anchor:[1,3],bright:50,dim:0}],lightLevel:"dark"} as unknown as StavBoje;
 expect(lightAt(state,map,7,3)).toBe("dark");
 expect(pointInPolygon([7,3],visibilityPolygon([1,3],lightBlockers(walls),9,9))).toBe(false);
 const low={...map,trasy:[{...route,druh:"zidka" as const}]};
 expect(mapWalls(low).every(w=>w.typ==="half")).toBe(true);
 expect(lightBlockers(mapWalls(low))).toEqual([]);
 expect(lightAt(state,low,7,3)).toBe("bright");
 const a={id:"a",x:1,y:3,s:1},b={id:"b",x:7,y:3,s:1};
 expect(coverOf(a as Token,b as Token,map,[])).toBe(9);expect(coverOf(a as Token,b as Token,low,[])).toBe(2);
 expect(cellInfo({...map,trasy:[{...route,pts:[[4.5,0],[4.5,8]]}]},4,3).blocksMove).toBe(true);
});
it("derives walkable deck cells only over water/chasms, without rewriting stored terrain",()=>{
 const water={...map,mrizka:Array(9).fill("~~~~~~~~~"),trasy:[{...route,druh:"molo" as const,sirka:2,pts:[[4.5,.5],[4.5,8.5]] as MapRoute["pts"]}]};
 expect(deckAt(water,4,3)).toBe(true);expect(tileAt(water,4,3)).toBe(".");expect(cellInfo(water,4,3)).toMatchObject({cost:1,blocksMove:false});expect(tileAt(water,1,3)).toBe("~");
 expect(tileAt(water,4,3,{"4,3":"_"})).toBe(".");expect(tileAt(water,4,3,{"4,3":"#"})).toBe("#");expect(water.mrizka[3][4]).toBe("~");
 expect(mapWalls(water)).toEqual([]);expect(mapWalls({...water,trasy:[{...water.trasy[0],druh:"cesta"}]})).toEqual([]);
});
it("renders generated image textures and sprites in the editor, shared battle scene and static export",()=>{
 setManifests(Object.fromEntries(assets.assety.map(a=>[a.id,a as AssetEntry])),Object.fromEntries(textures.textury.map(t=>[t.id,t])));
 for(const druh of ["cesta","molo","plot","zidka"] as const){
  const m={...map,trasy:[{...route,druh,brectan:true}]},html=renderToStaticMarkup(<MapRouteLayer map={m}/>);
  expect(html).toContain(`data-route-kind="${druh}"`);expect(html).toContain(".webp");expect(html).not.toContain("t-molo-prkna");
  if(druh==="molo"){
   expect(html).toContain("data-deck-board");expect(html).toContain("prkno-");expect(html).toContain('data-deck-shadow="true"');expect(html).toContain('stroke-linecap="butt"');expect(html).toContain("data-waterline");
   expect(renderToStaticMarkup(<MapRouteLayer map={{...m,trasy:[{...m.trasy[0],t:"t-zahradni-cesta"}]}}/>)).not.toContain("t-zahradni-cesta.webp");
  }
  if(druh==="plot"){expect(html).toContain("listovi-");expect(html).toContain("data-hedge-side");expect(html).toContain("data-hedge-top");}
  expect(renderToStaticMarkup(<MapPreview map={m} staticLighting/>)).toContain(`data-route-kind="${druh}"`);
  expect(renderToStaticMarkup(<MapAnimatedScene map={m} view={{x:0,y:0,k:1}} lights={false}>{null}</MapAnimatedScene>)).toContain(`data-route-kind="${druh}"`);
 }
 expect(renderToStaticMarkup(<MapRouteLayer map={{}}/>)).not.toContain("data-route-kind");
});
it("lays long boards across the deck with stable varied tones, small gaps and occasional worn ends",()=>{
 const r={...route,druh:"molo" as const,sirka:2,pts:[[1,1],[1,12]] as MapRoute["pts"]},g=routeGeometry(r);
 expect(routeGeometry(structuredClone(r)).planks).toEqual(g.planks);
 expect(g.planks.every(p=>p.angle===180&&p.width>p.height*4)).toBe(true);
 expect(new Set(g.planks.map(p=>p.tone)).size).toBeGreaterThan(3);
 expect(g.planks.some(p=>p.width<47)).toBe(true);
 expect(routeGeometry({...r,pts:[]}).planks).toEqual([]);
 expect(routeGeometry({...r,pts:[[1,1],[1,1]]}).planks).toEqual([]);
});
it("selects routes by stroke and marquee and moves control points without losing their metadata",()=>{
 const m=structuredClone(map);expect(pickAt(m,4,3,true)).toEqual({kind:"trasa",id:"r"});expect(pickInRect(m,[0,0],[8,8])).toContainEqual({kind:"trasa",id:"r"});
 moveSel(m,[{kind:"trasa",id:"r"}],.5,1);expect(m.trasy![0].pts).toEqual([[4.5,1],[4.5,9]]);expect(m.trasy![0].seed).toBe(42);
 expect(routeContains(m.trasy![0],4.5,3)).toBe(true);expect(routeContains(m.trasy![0],4,0)).toBe(false);
 const copies=duplicateRoutes(m.trasy!);expect(copies[0]).toMatchObject({seed:42,sirka:.75,pts:[[5.5,2],[5.5,10]]});expect(copies[0].id).not.toBe("r");expect(duplicateRoutes([])).toEqual([]);
 eraseAt(m,4,3);expect(m.trasy).toEqual([]);
});

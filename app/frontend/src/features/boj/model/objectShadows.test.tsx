import React from "react";
import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {castsShadow,objectFootprint,objectBlockers,directionalShadow} from "./objectShadows";
import {contactShadowPlan,ContactShadowArtwork} from "../components/MapContactShadows";
import {pointInPolygon,visibilityPolygon} from "./lightGeometry";
import {migrateMap,type MapObject} from "./mapV2";
import {ObjectInspector} from "../../mapeditor/components/ObjectInspector";
const box:MapObject={id:"box",asset:"crate",x:5,y:5,w:2,h:1,blocks:true};
it("offsets and elongates away from the strongest reaching light, ignoring blocked or wrongly aimed lights",()=>{
 const left={id:"left",x:2,y:5,bright:20,dim:20,intenzita:1},right={...left,id:"right",x:7,intenzita:.1};
 const shadow=directionalShadow(box,[left,right])!;
 expect(shadow.x).toBeGreaterThan(0);expect(shadow.y).toBe(0);expect(shadow.length).toBeGreaterThan(1);
 expect(directionalShadow(box,[left,{...right,intenzita:1}])!.x).toBeLessThan(0);
 expect(directionalShadow(box,[{...left,tvar:"kuzel",smer:180}])).toBeUndefined();
 expect(directionalShadow(box,[left],[{a:[3,0],b:[3,10]}])).toBeUndefined();
 expect(directionalShadow(box,[])).toBeUndefined();expect(directionalShadow(box,[{...left,x:NaN}])).toBeUndefined();
 expect(directionalShadow(box,[{...left,intenzita:0}])).toBeUndefined();
 const map={id:"m",nazev:"M",podklad:"dungeon" as const,mrizka:[".........."],objekty:[box],svetla:[left]};
 const plan=contactShadowPlan(map,{});expect(plan).toHaveLength(1);
 expect(contactShadowPlan({...map,objekty:[{...box,tint:"#ff0000"}]},{})).toBe(plan);
 expect(contactShadowPlan({...map,objekty:[{...box,stin:false}]},{})).toEqual([]);
 expect(contactShadowPlan({...map,svetla:[]},{})).toMatchObject([{x:5,y:5+2/24,angle:0}]);
 const svg=renderToStaticMarkup(<ContactShadowArtwork plan={plan} width={240} height={240}/>);
 expect(svg).toContain('data-contact-shadow="box"');expect(svg).toContain("radialGradient");expect(svg).not.toMatch(/<filter|animation/);
});
it("uses solid/cover metadata, respects explicit overrides and ignores hidden or invalid props",()=>{
 expect(castsShadow(box)).toBe(true);expect(castsShadow({...box,blocks:false,cover:2})).toBe(true);
 expect(castsShadow({...box,stin:false})).toBe(false);expect(castsShadow({...box,blocks:false,stin:true})).toBe(true);
 expect(castsShadow({...box,dmOnly:true,stin:true})).toBe(false);expect(castsShadow({...box,w:NaN})).toBe(false);
 expect(castsShadow({...box,blocks:false})).toBe(false);expect(castsShadow({...box,z:-1})).toBe(false);
 expect(castsShadow({...box,blocks:undefined},{id:"crate",nazev:"Bedna",src:"crate.png",blocks:true})).toBe(true);
});
it("rotates inset rectangles and approximates pillars/trees with octagons",()=>{
 const rectangle=objectFootprint(box);expect(rectangle).toHaveLength(4);
 expect(rectangle[0][0]).toBeGreaterThan(4);
 const rotated=objectFootprint({...box,rot:90});expect(rotated[0][0]).toBeCloseTo(5.42);expect(rotated[0][1]).toBeCloseTo(4.16);
 expect(objectFootprint({...box,asset:"strom"})).toHaveLength(8);
 expect(objectFootprint({...box,asset:"pillar"})).toHaveLength(8);
});
it("occludes behind footprints, lets origin lights escape their supporting object, and caches irrelevant edits",()=>{
 const blockers=objectBlockers([box]);const poly=visibilityPolygon([2,5],blockers,12,12);
 expect(pointInPolygon([7,5],poly)).toBe(false);expect(pointInPolygon([3,5],poly)).toBe(true);
 expect(pointInPolygon([7,5],visibilityPolygon([5,5],blockers,12,12))).toBe(true);
 expect(objectBlockers([{...box,tint:"#ffffff"}])).toBe(blockers);
 expect(objectBlockers([{...box,rot:15}])).not.toBe(blockers);
 expect(objectBlockers([{...box,stin:false}])).toEqual([]);expect(objectBlockers()).toEqual([]);
});
it("round-trips the override and exposes a Czech automatic/yes/no inspector control",()=>{
 const map={id:"m",nazev:"M",podklad:"dungeon" as const,mrizka:[".."],objekty:[{...box,stin:false}]};
 expect(migrateMap(JSON.parse(JSON.stringify(map))).objekty![0].stin).toBe(false);
 const html=renderToStaticMarkup(<ObjectInspector objects={map.objekty} assets={{}} push={()=>{}} onVariant={()=>{}} onAction={()=>{}} onDelete={()=>{}}/>);
 expect(html).toContain('aria-label="Vrhání stínů"');expect(html).toContain("Nevrhat stín");
});

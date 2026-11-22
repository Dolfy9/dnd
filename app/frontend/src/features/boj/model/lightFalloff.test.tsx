import React from "react";
import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {LightDefinition} from "../components/MapLightProjection";
import {normalizeLight} from "./mapV2";

it("envelopes the generated point sprite once, with monotonic zero-edge falloff shared by all light shapes",()=>{
 for(const tvar of ["bod","kuzel","pruh"] as const){
  const light={...normalizeLight({id:"lamp",x:5,y:5,bright:3,dim:9,tvar}),radius:120,bright:30};
  const svg=renderToStaticMarkup(<LightDefinition id="lamp" light={light} blockers={[]} width={480} height={480}/>);
  const radial=svg.match(/<radialGradient id="lampradial"[\s\S]*?<\/radialGradient>/)![0];
  const stops=[...radial.matchAll(/offset="([\d.]+)" stop-color="white" stop-opacity="([\d.e-]+)"/g)].map(m=>[Number(m[1]),Number(m[2])]);
  expect(stops.length).toBeGreaterThan(10);
  expect(stops[0]).toEqual([0,1]);expect(stops[stops.length-1]).toEqual([1,0]);
  stops.forEach(([r,a],i)=>{if(i)expect(a).toBeLessThanOrEqual(stops[i-1][1]);if(r>=.95)expect(a).toBeLessThan(.01);});
  if(tvar==="bod"){
   expect(svg.match(/<image /g)).toHaveLength(1);
   expect(svg).toContain('mask="url(#lampfalloff)"');
  }
 }
});

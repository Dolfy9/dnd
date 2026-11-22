import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateMap, normalizeLight, type MapLightV2 } from "../../boj/model/mapV2";
import { LIGHT_PRESETS, applyLightPreset, editedLight, updateLight, dragLightHandle, aimPlacedLight, lightHandlePoints, lightRotationDelta } from "./lightEditing";
import { LightInspector } from "../components/LightInspector";
import { LightHandles } from "../components/LightHandles";

const light:MapLightV2={id:"a",x:8,y:8,bright:10,dim:10};
describe("light editing operations",()=>{
  it("applies every preset without replacing identity or position",()=>{
    expect(LIGHT_PRESETS).toHaveLength(12);
    for(const preset of LIGHT_PRESETS){
      const next=applyLightPreset(light,preset.id);
      expect(next).toMatchObject({id:"a",x:8,y:8,nazev:preset.name});
      expect(next).toEqual(normalizeLight(next));
      expect(next.bright+next.dim).toBeGreaterThan(0);
    }
    expect(applyLightPreset(light,"missing")).toBe(light);
  });
  it("updates only the requested light and preserves no-op identity",()=>{
    const map=migrateMap({id:"m",nazev:"M",mrizka:["...."],svetla:[light,{...light,id:"b"}]});
    const before=map.svetla;
    expect(updateLight(map,"missing",{smer:40})).toBe(false);
    expect(updateLight(map,"a",{bright:10})).toBe(false);
    expect(map.svetla).toBe(before);
    expect(updateLight(map,"a",{tvar:"kuzel",efekt:"magie",smer:375})).toBe(true);
    expect(map.svetla![0]).toMatchObject({tvar:"kuzel",efekt:"magie",smer:15});
    expect(map.svetla![1]).toBe(before![1]);
    expect(updateLight(migrateMap({mrizka:["."]}),"a",{})).toBe(false);
    expect(editedLight(light,{dim:-10,bright:Infinity})).toMatchObject({dim:0,bright:10});
    expect(editedLight(light,{})).toBe(light);
  });
  it("places and aims all shapes, preserving presets on a click or tiny drag",()=>{
    expect(aimPlacedLight(light,[8,8])).toBe(light);
    expect(aimPlacedLight(light,[8.05,8.05])).toBe(light);
    expect(aimPlacedLight(light,[NaN,10])).toBe(light);
    const point=aimPlacedLight(light,[8,12]);
    expect(point).toMatchObject({smer:90,bright:10,dim:10});
    const cone=aimPlacedLight({...light,tvar:"kuzel"},[11,12]);
    expect(cone.bright+cone.dim).toBe(25);
    expect(cone.smer).toBeCloseTo(53.13,2);
    expect(aimPlacedLight({...light,tvar:"pruh"},[8,13])).toMatchObject({smer:90,delka:5,bright:10,dim:10});
    expect(aimPlacedLight({...light,bright:0,dim:0},[8,10])).toMatchObject({bright:0,dim:10});
    expect(aimPlacedLight(light,[11,12],true).smer).toBe(60);
  });
  it("moves, rotates, snaps, changes both ranges, cone angle and either strip end",()=>{
    expect(dragLightHandle(light,"origin",[30,-2],false,20,20)).toMatchObject({x:19.99,y:0});
    expect(dragLightHandle(light,"direction",[11,12],true).smer).toBe(60);
    expect(dragLightHandle(light,"direction",[8,8])).toBe(light);
    expect(dragLightHandle(light,"bright",[8,11]).bright).toBe(15);
    expect(dragLightHandle(light,"dim",[8,14]).dim).toBe(20);
    expect(dragLightHandle(light,"dim",[8,8]).dim).toBe(0);
    const cone={...light,tvar:"kuzel" as const,smer:350};
    const p:[number,number]=[8+Math.cos(20*Math.PI/180)*4,8+Math.sin(20*Math.PI/180)*4];
    expect(normalizeLight(dragLightHandle(cone,"edge",p)).sirka).toBeCloseTo(60);
    const strip={...light,tvar:"pruh" as const,smer:90};
    expect(dragLightHandle(strip,"end-a",[8,12]).delka).toBeCloseTo(8);
    expect(dragLightHandle(strip,"end-b",[8,4]).delka).toBeCloseTo(8);
    expect(dragLightHandle(strip,"bright",[11,10]).bright).toBe(15);
    expect(dragLightHandle(light,"origin",[Infinity,8])).toBe(light);
  });
  it("supports one history entry per completed drag, no-op preserves redo",()=>{
    const map=migrateMap({mrizka:["."],svetla:[light]});
    const history:typeof map[]=[],redo=[structuredClone(map)];
    const commit=(next:MapLightV2)=>{
      if(next===light)return;
      history.push(structuredClone(map));redo.length=0;updateLight(map,light.id,next);
    };
    commit(dragLightHandle(light,"origin",[8,8]));
    expect(history).toHaveLength(0);expect(redo).toHaveLength(1);
    const next=dragLightHandle(light,"origin",[9,9]);
    commit(next);
    expect(history).toHaveLength(1);expect(redo).toHaveLength(0);
    expect(history[0].svetla![0].x).toBe(8);
    expect(map.svetla![0].x).toBe(9);
  });
  it("provides shape-specific handle geometry and free bracket shortcuts",()=>{
    expect(lightHandlePoints(light).map(h=>h.kind)).toEqual(["origin","bright","dim"]);
    expect(lightHandlePoints({...light,tvar:"kuzel"})).toHaveLength(5);
    expect(lightHandlePoints({...light,tvar:"pruh"})).toHaveLength(6);
    const key={key:"]",code:"BracketRight",shiftKey:false,ctrlKey:false,metaKey:false,altKey:false};
    expect(lightRotationDelta(key)).toBe(15);
    expect(lightRotationDelta({...key,key:"{",code:"BracketLeft",shiftKey:true})).toBe(-1);
    expect(lightRotationDelta({...key,ctrlKey:true})).toBe(0);
    expect(lightRotationDelta({...key,key:"q",code:"KeyQ"})).toBe(0);
  });
  it("renders Czech cards, fields and accessible shape-specific handles",()=>{
    for(const preset of LIGHT_PRESETS){
      const html=renderToStaticMarkup(<LightInspector value={preset.light} onChange={()=>{}} placement/>);
      expect(html).toContain('aria-label="Tvar světla"');
      expect(html).toContain('aria-label="Efekt světla"');
      expect(html).toContain('aria-label="Předloha Měsíční svit"');
      expect(html).toContain('aria-label="Stíny světla"');
    }
    const handles=renderToStaticMarkup(<svg><LightHandles light={{...light,tvar:"kuzel"}} zoom={1} onBegin={()=>{}}/></svg>);
    expect(handles).toContain('data-light-handle="edge"');
    expect(handles).toContain('aria-label="Směr světla"');
  });
});

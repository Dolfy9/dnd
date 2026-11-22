import {expect,it} from "vitest";
import {lightAt} from "./lighting";
import type {LightSource,StavBoje} from "../types";
import type {MapV2} from "../model/mapV2";
const map:MapV2={id:"m",nazev:"M",podklad:"dungeon",mrizka:Array(15).fill("...............")};
const source:LightSource={id:"l",nazev:"L",anchor:[5,5],bright:10,dim:10};
const at=(patch:Partial<LightSource>,x:number,y:number)=>lightAt({tok:[],zones:[],lightLevel:"dark",lights:[{...source,...(patch.tvar?{anchor:[5.5,5.5] as [number,number]}:{}),...patch}]} as unknown as StavBoje,map,x,y);
it("preserves legacy point range and handles empty or invalid sources",()=>{
 expect(at({},7,7)).toBe("bright");expect(at({},9,9)).toBe("dim");expect(at({},10,10)).toBe("dark");
 expect(at({anchor:undefined},5,5)).toBe("dark");expect(at({anchor:[NaN,5]},5,5)).toBe("dark");
});
it("tests target centres against map-light cones and strip end caps, without changing legacy points",()=>{
 expect(at({anchor:[5,5],tvar:"kuzel",sirka:10,bright:20,dim:0},7,5)).toBe("dark");
 expect(at({anchor:[5,5],tvar:"pruh",delka:4,bright:5,dim:0},8,5)).toBe("dark");
 expect(at({bright:5,dim:0},6,5)).toBe("bright");
 const state={tok:[],zones:[],lightLevel:"dark",lights:[{...source,tvar:"kuzel",sirka:90}]} as unknown as StavBoje;
 expect(lightAt(state,{...map,steny:[{id:"w",a:[5.25,4],b:[5.25,5.25],typ:"wall"}]},7,5)).toBe("dark");
});
it("aims cones clockwise, includes angular edges and uses radial range",()=>{
 expect(at({tvar:"kuzel",smer:0,sirka:90},7,5)).toBe("bright");
 expect(at({tvar:"kuzel",smer:0,sirka:90},7,7)).toBe("dim");
 expect(at({tvar:"kuzel",smer:0,sirka:60},6,7)).toBe("dark");
 expect(at({tvar:"kuzel",smer:90},5,8)).toBe("dim");
 expect(at({tvar:"kuzel",smer:450},5,8)).toBe("dim");
 expect(at({tvar:"kuzel",smer:180},8,5)).toBe("dark");
 expect(at({tvar:"kuzel"},5,5)).toBe("bright");
});
it("measures strips from an oriented finite segment including round ends",()=>{
 expect(at({tvar:"pruh",delka:6},8,7)).toBe("bright");
 expect(at({tvar:"pruh",delka:6},10,5)).toBe("bright");
 expect(at({tvar:"pruh",delka:6},10,7)).toBe("dim");
 expect(at({tvar:"pruh",delka:6},12,6)).toBe("dark");
 expect(at({tvar:"pruh",delka:6,smer:90},7,8)).toBe("bright");
 expect(at({tvar:"pruh",delka:6,smer:45},8,8)).toBe("bright");
});
it("keeps wall occlusion for shaped token-carried lights",()=>{
 const state={tok:[{id:"t",x:5,y:5}],zones:[],lightLevel:"dark",lights:[{...source,tvar:"kuzel",tokenId:"t",anchor:undefined}]} as unknown as StavBoje;
 expect(lightAt(state,map,7,5)).toBe("bright");
 expect(lightAt(state,{...map,steny:[{id:"w",a:[6,0],b:[6,15],typ:"wall"}]},7,5)).toBe("dark");
 const large={...state,tok:[{id:"t",x:5,y:5,s:2}],lights:[{...state.lights![0],sirka:10}]} as unknown as StavBoje;
 expect(lightAt(large,map,7,5)).toBe("dark");
 expect(lightAt({...large,lights:[{...large.lights![0],smer:45}]},map,6,6)).toBe("bright");
});

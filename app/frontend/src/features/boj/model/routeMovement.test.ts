import {expect,it} from "vitest";
import type {MapV2} from "./mapV2";
import type {Token,StavBoje} from "../types";
import {planMovement} from "../rules/movement";
import {defaultSettings} from "../rules/settings";
import {reachable} from "../rules/grid";
import {deckCoversStep} from "./mapRoutes";

const token={id:"t",s:1,x:0,y:0,speed:30,side:"druzina",cond:[],effects:[],spent:{},atk:[]} as unknown as Token;
const state={tok:[token],zones:[],eco:{},turn:0,ord:["t"]} as unknown as StavBoje;
it("crosses a narrow diagonal deck even when both adjacent side cells are chasm",()=>{
 const map:MapV2={id:"m",nazev:"M",podklad:"jine",mrizka:["___","___","___"],trasy:[{id:"pier",druh:"molo",pts:[[.5,.5],[2.5,2.5]],sirka:.5,hladke:false}]};
 const p=planMovement(state,map,token,[],[2,2],"pravidla",defaultSettings());
 expect(p.blocked).toBeNull();expect(p.path).toEqual([[0,0],[1,1],[2,2]]);
 expect(reachable(token,30,map,[token]).dist["2,2"]).toBe(10);
 expect(deckCoversStep(map,0,0,0,0)).toBe(true);
 expect(deckCoversStep({...map,trasy:[]},0,0,1,1)).toBe(false);
 const split={...map,trasy:[{...map.trasy![0],pts:[[.5,.5],[.7,.7]] as [number,number][]},{...map.trasy![0],id:"other",pts:[[1.3,1.3],[1.5,1.5]] as [number,number][]}]};
 expect(deckCoversStep(split,0,0,1,1)).toBe(false);
 const gap={...map,trasy:map.trasy!.map(r=>({...r,pts:[[.5,.5],[.6,.6]] as [number,number][]}))};
 expect(planMovement(state,gap,token,[],[2,2],"pravidla",defaultSettings()).blocked).not.toBeNull();
 const wall={...map,steny:[{id:"wall",a:[1,0] as [number,number],b:[1,3] as [number,number],typ:"wall" as const}]};
 expect(planMovement(state,wall,token,[],[2,2],"pravidla",defaultSettings()).blocked).not.toBeNull();
});

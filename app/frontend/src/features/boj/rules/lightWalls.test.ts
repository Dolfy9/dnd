import { expect, it } from "vitest";
import { lightAt, sightBlocked } from "./lighting";
import { wallIndex, type MapV2, type MapWall } from "../model/mapV2";
import type { StavBoje } from "../types";

it("traces anchor and token lights to cell centers behind fractional and angled walls", () => {
  const map: MapV2 = { id:"l", nazev:"L", podklad:"mesto", mrizka:["....","...."] };
  const wall: MapWall = { id:"w", a:[1.1,.2], b:[1.4,.8], typ:"wall" };
  const state = { tok:[], lightLevel:"dark", lights:[{id:"l",anchor:[0,0],bright:20,dim:20}] } as unknown as StavBoje;
  expect(sightBlocked(wallIndex([wall]),0,0,2,0)).toBe(false);
  expect(sightBlocked(wallIndex([wall]),.5,.5,2.5,.5)).toBe(true);
  expect(lightAt(state,{...map,steny:[wall]},2,0)).toBe("dark");
  expect(lightAt(state,map,2,0)).toBe("bright");
  expect(lightAt(state,{...map,steny:[{...wall,typ:"window"}]},2,0)).toBe("bright");
  const doorMap = {...map,steny:[{...wall,typ:"door" as const}]};
  expect(lightAt({...state,dvere:{w:false}},doorMap,2,0)).toBe("dark");
  expect(lightAt({...state,dvere:{w:true}},doorMap,2,0)).toBe("bright");
  const tokenState = {...state,tok:[{id:"t",x:0,y:0}],lights:[{...state.lights![0],anchor:undefined,tokenId:"t"}]} as StavBoje;
  expect(lightAt(tokenState,{...map,steny:[wall]},2,0)).toBe("dark");
  expect(lightAt({...state,lights:[]},map,2,0)).toBe("dark");
});

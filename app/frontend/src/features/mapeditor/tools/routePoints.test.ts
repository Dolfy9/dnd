import {expect,it} from "vitest";
import {moveRoutePoint} from "./ops";
import {migrateMap,type MapV2} from "../../boj/model/mapV2";
it("rejects collapsed or non-finite node drags and preserves a route through reload",()=>{
 const m:MapV2={id:"m",nazev:"M",podklad:"jine",mrizka:["...."],trasy:[{id:"r",druh:"cesta",pts:[[0,0],[2,0]],sirka:1,hladke:true}]};
 moveRoutePoint(m,"r",1,[0,0]);expect(m.trasy![0].pts).toEqual([[0,0],[2,0]]);
 moveRoutePoint(m,"r",1,[NaN,0]);expect(m.trasy![0].pts).toEqual([[0,0],[2,0]]);
 moveRoutePoint(m,"r",1,[3,.25]);expect(m.trasy![0].pts).toEqual([[0,0],[3,.25]]);
 expect(migrateMap(JSON.parse(JSON.stringify(m))).trasy).toEqual(m.trasy);
 moveRoutePoint(m,"r",9,[0,0]);expect(m.trasy![0].pts).toHaveLength(2);
 moveRoutePoint({...m,trasy:undefined},"r",1,[1,1]);
});

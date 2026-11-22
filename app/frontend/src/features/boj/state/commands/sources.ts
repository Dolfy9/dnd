import type {BattleMapData,StavBoje} from "../../types";
import {toggleBattleSource} from "../../model/sourceState";
import {log} from "../../rules/turn";

export function toggleSource(S:StavBoje,map:BattleMapData,id:string,gm:boolean) {
  const message=toggleBattleSource(S,map,id,gm);
  const source=map.objekty?.find(o=>o.id===id) || map.svetla?.find(l=>l.id===id);
  if(message)log(S,"system",message,"PJ",undefined,!!source?.dmOnly);
}

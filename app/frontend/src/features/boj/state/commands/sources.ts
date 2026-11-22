import type {BattleMapData,StavBoje} from "../../types";
import {toggleBattleSource} from "../../model/sourceState";
import {log} from "../../rules/turn";

export function toggleSource(S:StavBoje,map:BattleMapData,id:string,gm:boolean) {
  const message=toggleBattleSource(S,map,id,gm);
  if(message)log(S,"system",message,"PJ");
}

import type { BattleMapData, StavBoje } from "../types";
import { lightAt } from "../rules/lighting";

export function updateLightState(S: StavBoje, map: BattleMapData) {
  const privateLights = [...(map.svetla || []), ...(S.lights || [])].filter(l => l.dmOnly);
  S.privateSourceIds = [...new Set([...privateLights, ...(map.objekty || []).filter(o => o.dmOnly)].map(s => s.id))];
  delete S.playerLightCells;
  delete S.lightCells;
  if (!privateLights.length) return;
  S.lightCells = {};
  for (let y = 0; y < map.mrizka.length; y++) for (let x = 0; x < map.mrizka[y].length; x++) {
    S.lightCells[`${x},${y}`] = lightAt(S, map, x, y);
  }
}

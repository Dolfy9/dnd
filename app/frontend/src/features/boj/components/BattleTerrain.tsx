import type { MapV2 } from "../model/mapV2";
import type { StavBoje } from "../types";
import { TerenLayer } from "./MapLayers";
import { MapTextureLayer } from "./MapV2Layers";
import { MapPaintLayer } from "./MapAtmoLayers";

export function BattleTerrain({ map, S, illustration }: { map: MapV2; S: Pick<StavBoje, "teren">; illustration: boolean }) {
  return <>
    <TerenLayer staticOnly map={map} px={24} illustration={illustration} />
    <MapTextureLayer map={map} />
    <MapPaintLayer map={map} />
    <TerenLayer staticOnly S={S} map={map} px={24} illustration />
  </>;
}

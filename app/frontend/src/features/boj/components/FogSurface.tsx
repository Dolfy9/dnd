import { memo, useMemo, useRef } from "react";
import type { MapV2 } from "../model/mapV2";
import type { StavBoje } from "../types";
import { fogMemoryMap, type Fog } from "../model/fog";
import { FogRaster } from "../model/fogRaster";
import { TerenLayer } from "./MapLayers";
import { MapObjectLayer, MapTextureLayer, MapElevationLayer, MapGridLayer, MapDrawingLayer, MapWallLayer } from "./MapV2Layers";
import { MapPaintLayer } from "./MapAtmoLayers";
import { MapRouteLayer } from "./MapRouteLayer";
import "./fog.css";

export function useFogRaster(fog: Fog | undefined, width: number, height: number) {
  const raster = useRef<FogRaster>();
  const key = JSON.stringify(fog);
  return useMemo(() => {
    if (!fog?.on || typeof document === "undefined") return undefined;
    if (raster.current?.width !== width || raster.current?.height !== height) raster.current = new FogRaster(width, height);
    return raster.current.update(fog);
  }, [key, width, height]);
}

export const FogMemory = memo(function FogMemory({ map, S, image, base }: {
  map: MapV2; S: Pick<StavBoje, "teren" | "dvere">; image?: string; base: string;
}) {
  const memory = useMemo(() => fogMemoryMap(map), [map]);
  const W = (map.mrizka[0]?.length || 1) * 24, H = map.mrizka.length * 24;
  return <svg className="battle-fog-memory" width={W} height={H} data-fog-memory>
    <rect width={W} height={H} fill={base} />
    {image && <image href={image} width={W} height={H} preserveAspectRatio="none" />}
    <TerenLayer map={memory} px={24} illustration={!!image} />
    <MapTextureLayer map={memory} /><MapPaintLayer map={memory} />
    <TerenLayer S={S} map={memory} px={24} illustration />
    <MapElevationLayer map={memory} /><MapGridLayer map={memory} W={W / 24} H={H / 24} />
    <MapDrawingLayer map={memory} /><MapRouteLayer map={memory} />
    <MapWallLayer map={memory} doors={S.dvere} /><MapObjectLayer map={memory} />
  </svg>;
});

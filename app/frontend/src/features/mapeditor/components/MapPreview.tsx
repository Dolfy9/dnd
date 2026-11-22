import { memo } from "react";
import {MapRouteLayer} from "../../boj/components/MapRouteLayer";
import type { MapV2 } from "../../boj/model/mapV2";
import { TerenLayer } from "../../boj/components/MapLayers";
import { MapObjectLayer, MapTextureLayer, MapWallLayer } from "../../boj/components/MapV2Layers";
import { MapPaintLayer, MapAtmosphereLayer, MapAtmosphereArtwork } from "../../boj/components/MapAtmoLayers";

export const MapPreview = memo(function MapPreview({ map, staticLighting=false }: { map: MapV2; staticLighting?:boolean }) {
  const W = (map.mrizka[0]?.length || 1)*24, H = map.mrizka.length*24;
  return <svg xmlns="http://www.w3.org/2000/svg" className="me-map-preview" viewBox={`0 0 ${W} ${H}`} aria-label={map.nazev}>
    {map.obrazek && <image href={`/repo/11_Mapy/${map.obrazek}`} width={W} height={H} preserveAspectRatio="none" />}
    <TerenLayer map={map} px={24} illustration={!!map.obrazek} />
    <MapTextureLayer map={map} /><MapPaintLayer map={map} /><MapWallLayer map={map} />
    <MapRouteLayer map={map}/><MapObjectLayer map={map} />{staticLighting ? <MapAtmosphereArtwork map={map} animated={false}/> : <MapAtmosphereLayer map={map} animated={false} />}
  </svg>;
});

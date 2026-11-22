import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import type { MapV2 } from "../model/mapV2";
import type { StavBoje } from "../types";
import { assetUrl } from "../../mapeditor/assets/manifest";
import { terrainProp, terrainTexture } from "../model/terrainArt";
import { MapObjectLayer, useMapManifests } from "./MapV2Layers";
import { animationPhase, FX, resolveAnimation } from "./MapMotion";
import { visualLights } from "./MapAtmoLayers";

const water = (id: string) => /voda|melcina|more|vlny/.test(id);
export function waterMask(map: MapV2) {
  const shapes: string[] = [];
  map.mrizka.forEach((row,y) => [...row].forEach((c,x) => {
    if (water(map.textury?.[x+","+y] || terrainTexture(c,map.podklad))) shapes.push(`<rect x="${x*24}" y="${y*24}" width="24.5" height="24.5" fill="white"/>`);
  }));
  if (!shapes.length && !map.malba?.some(s => water(s.t))) return "";
  for (const s of map.malba || []) {
    const d = s.p.map(([x,y],i) => `${i ? "L" : "M"}${x*24},${y*24}`).join(" ") + (s.poly ? "Z" : s.p.length === 1 ? "l.001,0" : "");
    const fill = water(s.t) ? "white" : "black";
    shapes.push(`<path d="${d}" fill="${s.poly ? fill : "none"}" stroke="${s.poly ? "none" : fill}" stroke-width="${s.b*24}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.o}"/>`);
  }
  const W = (map.mrizka[0]?.length || 1)*24, H = map.mrizka.length*24;
  return "url(\"data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><mask id="m"><rect width="100%" height="100%" fill="black"/>${shapes.join("")}</mask><rect width="100%" height="100%" fill="white" mask="url(#m)"/></svg>`) + "\")";
}

export const MapAnimatedScene = memo(function MapAnimatedScene({ map, view, px = 24, children, details, dm, terrain = true, objects = true, lights = true, illustration = false, overrides }: {
  map: MapV2; view: {x:number;y:number;k:number}; px?: number; children: ReactNode; details?: ReactNode; dm?: boolean;
  terrain?: boolean; objects?: boolean; lights?: boolean; illustration?: boolean; overrides?: StavBoje["teren"];
}) {
  const { assets } = useMapManifests();
  const mask = useMemo(() => waterMask(map), [map.mrizka,map.textury,map.malba,map.podklad]);
  const W = (map.mrizka[0]?.length || 1)*24, H = map.mrizka.length*24;
  const sprite = (id: string, src: string, anim: string, x: number, y: number, w: number, h: number, rot = 0, flip = false, opacity = 1) =>
    <div key={id} className="map-dom-sprite" style={{left:x*24-w*12,top:y*24-h*12,width:w*24,height:h*24,transform:`rotate(${rot}deg) scaleX(${flip ? -1 : 1})`,opacity}}>
      {["portal","ohen","zare"].includes(anim) && <img className={`map-dom-glow map-anim-${anim === "ohen" ? "ohen" : "zare"}`} src="/repo/11_Mapy/bojove/ovl/zar.webp" alt="" />}
      <img src={src} alt="" className={`map-anim-${anim}`} style={{animationDelay:`${animationPhase(id)}s`}} />
    </div>;
  return <div className="map-animated-scene" aria-hidden="true"><div className="map-scene-board" style={{
    width:W,height:H,transform:`translate(${view.x}px,${view.y}px) scale(${view.k*px/24})`,
  }}>
    <svg className="map-scene-static" width={W} height={H}>{children}</svg>
    {mask && <div className="map-dom-water" style={{maskImage:mask}} data-map-water><div style={{backgroundImage:`url(${FX}vlny-tiche.webp)`}} className="map-water-drift" /></div>}
    {terrain && map.mrizka.flatMap((row,y) => [...row].map((c,x) => {
      const override = overrides?.[x+","+y];
      if (illustration && override === undefined) return null;
      const key = terrainProp(override ?? c,map.podklad,x,y), asset = key && assets["gen2-"+key];
      if (!asset) return null;
      const anim = resolveAnimation({},asset);
      if (!anim) return null;
      const size = (override ?? c) === "T" ? 1.3 : 1;
      return sprite(x+","+y,assetUrl(asset.src),anim,x+.5,y+.5,size,size);
    }))}
    {details && <svg className="map-scene-static" width={W} height={H}>{details}</svg>}
    {objects && [...(map.objekty || [])].sort((a,b) => (a.z ?? assets[a.asset]?.z ?? 0)-(b.z ?? assets[b.asset]?.z ?? 0)).map(o => {
      if (o.dmOnly && !dm) return null;
      const asset = assets[o.asset], anim = resolveAnimation(o,asset);
      const src = asset ? assetUrl(asset.src) : o.asset.startsWith("img:") ? "/repo/11_Mapy/bojove/"+o.asset.slice(4) : "";
      return anim && src ? sprite(o.id,src,anim,o.x,o.y,o.w,o.h,o.rot,o.flip,o.dmOnly ? .55 : 1)
        : <svg key={o.id} className="map-scene-static" width={W} height={H}><MapObjectLayer map={{...map,objekty:[o]}} dm={dm} /></svg>;
    })}
    <div className="map-scene-frame" />
    {lights && visualLights(map).filter(l => l.blikani && l.radius > 0).map(l => <div key={l.id} className="map-dom-light" style={{
      left:l.x*24-l.radius,top:l.y*24-l.radius,width:l.radius*2,height:l.radius*2,opacity:l.intenzita*.2,
      "--light-color":l.color,
    } as CSSProperties}><img className="map-light-flicker" src="/repo/11_Mapy/bojove/ovl/zar.webp" alt="" /></div>)}
  </div></div>;
});

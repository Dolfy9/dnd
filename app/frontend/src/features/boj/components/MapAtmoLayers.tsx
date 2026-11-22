import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mapWalls } from "../model/mapRoutes";
import type { MapV2, MapPaintStroke } from "../model/mapV2";
import { normalizeLight } from "../model/mapV2";
import { lightBlockers } from "../model/lightGeometry";
import { finiteLightShadows,objectHeight } from "../model/objectShadows";
import { assetUrl, type AssetEntry } from "../../mapeditor/assets/manifest";
import { useMapManifests, PX } from "./MapV2Layers";
import { resolveAnimation } from "./MapMotion";
import { LightDefinition, LightProjection } from "./MapLightProjection";
import { bakeAtmosphere } from "../model/atmosphereRaster";
import { ObjectArtworkMask, ObjectShadowMask } from "./ObjectLightMask";
import {objectLights} from "../model/sourceState";
import "./mapAtmo.css";

export { GLOW } from "./MapLightProjection";
const color = (value?: string) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffb85c";
const clamp = (n: number, fallback: number, max = 1) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback;

export const MapPaintLayer = memo(function MapPaintLayer({ map, preview }: { map: MapV2; preview?: MapPaintStroke }) {
  const { textures } = useMapManifests();
  const uid = useId().replace(/:/g, "");
  const W = (map.mrizka[0]?.length || 1) * PX, H = map.mrizka.length * PX;
  return <svg width={W} height={H} overflow="hidden" pointerEvents="none" data-map-paint>
    {(preview ? [...(map.malba || []), preview] : map.malba || []).map((s, i) => {
      const t = textures[s.t];
      if (!t || !s.p.length) return null;
      const id = uid + "-" + i, blur = (1 - s.h) * s.b * PX * .18;
      const d = s.p.map(([x, y], j) => `${j ? "L" : "M"}${x * PX},${y * PX}`).join(" ")
        + (s.poly ? "Z" : s.p.length === 1 ? "l.001,0" : "");
      return <g key={s.id}>
        <defs>
          <pattern id={id + "tex"} width={t.cells * PX} height={t.cells * PX} patternUnits="userSpaceOnUse" patternTransform={s.r ? `rotate(${s.r})` : undefined}>
            <image href={assetUrl(t.src)} width={t.cells * PX} height={t.cells * PX} />
          </pattern>
          <filter id={id + "blur"} filterUnits="userSpaceOnUse" x={-PX * 8} y={-PX * 8} width={W + PX * 16} height={H + PX * 16} colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
          <mask id={id + "mask"} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style={{ maskType: "alpha" }} x={0} y={0} width={W} height={H}>
            <path d={d} fill={s.poly ? "white" : "none"} stroke={s.poly ? "none" : "white"} strokeWidth={s.b * PX} strokeLinecap="round" strokeLinejoin="round"
              filter={blur ? `url(#${id}blur)` : undefined} />
          </mask>
        </defs>
        {s.poly && !blur
          ? <path d={d} fill={`url(#${id}tex)`} opacity={s.o} />
          : <rect width={W} height={H} fill={`url(#${id}tex)`} mask={`url(#${id}mask)`} opacity={s.o} />}
      </g>;
    })}
  </svg>;
});

export function visualLights(map: MapV2, assets: Record<string, AssetEntry> = {}) {
  return [...(map.svetla || []), ...objectLights(map,assets).map(o => ({
    id: "object-" + o.id, x: o.x, y: o.y, bright: o.bright, dim: o.dim, zap:o.zap,
    color: resolveAnimation({...o,zap:true},assets[o.asset])==="portal"?"#789bff":"#ffac52", intenzita: 1, blikani: o.anim!==false,
    efekt: o.anim===false?"zadny" as const:resolveAnimation(o,assets[o.asset])==="ohen"?"plamen" as const:"mihot" as const,
  }))].filter(l => l.zap!==false && Number.isFinite(l.x) && Number.isFinite(l.y)).map(normalizeLight).map(l => ({ ...l, color: color(l.color), intenzita: clamp(l.intenzita ?? 1, 1),
    bright: clamp(l.bright, 0, 500) / 5 * PX,
    radius: (clamp(l.bright, 0, 500) + clamp(l.dim, 0, 500)) / 5 * PX }));
}

export const MapAtmosphereArtwork = memo(function MapAtmosphereArtwork({ map, doors, animated=true, layer="both" }: { map: MapV2; doors?: Record<string, boolean>; animated?:boolean; layer?: "darkness" | "glow" | "both" }) {
  const uid = useId().replace(/:/g, "");
  const W = (map.mrizka[0]?.length || 1) * PX, H = map.mrizka.length * PX;
  const {assets} = useMapManifests();
  const lights = visualLights(map,assets).filter(l => l.radius > 0 && l.intenzita > 0);
  const blockers = useMemo(() => lightBlockers(mapWalls(map),doors),[map.steny,map.trasy,doors]);
  const shadows=lights.map(l=>finiteLightShadows({...l,bright:l.bright/PX*5},map.objekty,assets,blockers));
  const amb = clamp(map.atmosfera?.amb ?? 1, 1);
  if (amb === 1 && !lights.length) return null;
  return <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="hidden" pointerEvents="none">
    <defs>
      {lights.map((l,i)=><ObjectShadowMask key={l.id} id={uid+"shadow"+i} shadows={shadows[i]} width={W} height={H}/>)}
      {layer!=="darkness" && <ObjectArtworkMask id={uid+"artwork"} objects={map.objekty || []} assets={assets} width={W} height={H}/>}
      {lights.map((l,i) => <LightDefinition key={l.id} id={uid+"light"+i} light={l} blockers={blockers} width={W} height={H} />)}
      <filter id={uid + "black"} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
      {lights.map((l, i) => <filter key={l.id} id={uid + "tint" + i} colorInterpolationFilters="sRGB">
        <feFlood floodColor={l.color} /><feComposite in2="SourceAlpha" operator="in" />
      </filter>)}
      <mask id={uid + "dark"} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
        <rect width={W} height={H} fill="white" />
        {lights.map((l, i) => <g key={l.id} opacity={l.intenzita}>
          <LightProjection id={uid+"light"+i} light={l} filter={uid+"black"} shadowMask={uid+"shadow"+i} />
        </g>)}
      </mask>
    </defs>
    {layer !== "glow" && <rect width={W} height={H} fill={color(map.atmosfera?.barva || "#101522")}
      opacity={1 - amb} mask={`url(#${uid}dark)`} />}
    {layer !== "darkness" && <g mask={`url(#${uid}artwork)`} style={{mixBlendMode:"screen"}}>{lights.map((l, i) => <g key={l.id} opacity={l.intenzita * .48} style={{mixBlendMode:"screen"}}>
      <LightProjection id={uid+"light"+i} light={l} filter={uid+"tint"+i} shadowMask={uid+"shadow"+i} />
    </g>)}</g>}
  </svg>;
});

export function BakedAtmosphere({dark,glow,width,height}:{dark:string;glow?:string;width:number;height:number}) {
  return <>
    <image href={dark} width={width} height={height} preserveAspectRatio="none" data-atmosphere-darkness />
    {glow && <image href={glow} width={width} height={height} preserveAspectRatio="none" data-atmosphere-glow style={{mixBlendMode:"screen"}} />}
  </>;
}

export const MapAtmosphereLayer = memo(function MapAtmosphereLayer({ map, doors, animated=true }: { map: MapV2; doors?: Record<string, boolean>; animated?:boolean }) {
  const { assets } = useMapManifests();
  const W = (map.mrizka[0]?.length || 1) * PX, H = map.mrizka.length * PX;
  const lights = visualLights(map, assets).filter(l => l.radius > 0 && l.intenzita > 0);
  const ambient = clamp(map.atmosfera?.amb ?? 1, 1);
  const [dpr, setDpr] = useState(() => typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  useEffect(() => {
    const resize = () => setDpr(window.devicePixelRatio || 1);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const key = JSON.stringify([W, H, lights, lightBlockers(mapWalls(map), doors), map.objekty?.map(o=>[o.id,o.asset,o.x,o.y,o.w,o.h,o.v,o.rot,o.flip,o.stin,o.dmOnly,o.zap,objectHeight(o,assets[o.asset])]), ambient, map.atmosfera?.barva, animated, dpr]);
  const [bitmaps, setBitmaps] = useState<{ dark: string; glow: string;key:string }>();
  const [previous,setPrevious]=useState<typeof bitmaps>();
  const current=useRef<typeof bitmaps>(),urls=useRef(new Set<string>());
  const [failed, setFailed] = useState(false);
  const empty = ambient === 1 && !lights.length;
  useEffect(()=>()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();},[]);
  useEffect(()=>{
    if(!previous)return;
    const timer=setTimeout(()=>setPrevious(undefined),450);
    return()=>{clearTimeout(timer);for(const url of [previous.dark,previous.glow]){URL.revokeObjectURL(url);urls.current.delete(url);}};
  },[previous]);
  useEffect(() => {
    let active = true;
    if (empty) { setPrevious(current.current);current.current=undefined;setBitmaps(undefined); setFailed(false); return; }
    const timer = setTimeout(async () => {
      try {
        const dark = renderToStaticMarkup(<MapAtmosphereArtwork map={map} doors={doors} animated={animated} layer="darkness" />);
        const glow = renderToStaticMarkup(<MapAtmosphereArtwork map={map} doors={doors} animated={animated} layer="glow" />);
        const result = await bakeAtmosphere(dark, glow, W, H, dpr, !animated);
        if (active) {
          urls.current.add(result.dark);urls.current.add(result.glow);
          setPrevious(current.current);current.current={...result,key};setBitmaps(current.current);setFailed(false);
        }
        else { URL.revokeObjectURL(result.dark); URL.revokeObjectURL(result.glow); }
      } catch {
        if (active) setFailed(true);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);
  if (empty && !previous) return null;
  return <g data-map-atmosphere data-atmosphere-baked={!!bitmaps} pointerEvents="none">
    {previous && <g key={previous.dark} className="source-raster-leave"><BakedAtmosphere dark={previous.dark} glow={previous.glow} width={W} height={H}/></g>}
    {bitmaps ? <g key={bitmaps.dark} className="source-raster-enter"><BakedAtmosphere dark={bitmaps.dark} glow={bitmaps.glow} width={W} height={H} /></g> : failed ? <MapAtmosphereArtwork map={map} doors={doors} animated={animated} />
      : !previous && <rect width={W} height={H} fill={color(map.atmosfera?.barva || "#101522")} opacity={1 - ambient} />}
  </g>;
});

import { memo, useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MapV2,MapObject } from "../model/mapV2";
import { lightBlockers, nearbyLightBlockers, visibilityPolygon, type LightSegment,type Point } from "../model/lightGeometry";
import { useMapManifests } from "./MapV2Layers";
import { visualLights } from "./MapAtmoLayers";
import { GLOW, LightDefinition, lightAnimationStyle, lightReach, type VisualLight } from "./MapLightProjection";
import { LIGHT_CAPS, nearestLights, nextLightAnimationCap, type LightAnimationCap } from "../model/lightAnimationPolicy";
import { finiteLightShadows,type ObjectLightShadow } from "../model/objectShadows";
import { mapWalls } from "../model/mapRoutes";
import { ObjectArtworkMask,ObjectShadowMask } from "./ObjectLightMask";
import { embedSvgImages } from "../model/atmosphereRaster";
import {assetSrc,type AssetEntry} from "../../mapeditor/assets/manifest";

const CAP_KEY="montelien-light-animation-cap";
let sessionCap:LightAnimationCap=12;
try { const stored=Number(sessionStorage.getItem(CAP_KEY)); if(LIGHT_CAPS.includes(stored as LightAnimationCap)) sessionCap=stored as LightAnimationCap; } catch {}
const budgetListeners=new Set<()=>void>();
const subscribeBudget=(listener:()=>void)=>{budgetListeners.add(listener);return()=>{budgetListeners.delete(listener);};};
const getBudget=()=>sessionCap;

const rasters=new Map<string,Promise<string>>();
let glowData:Promise<string> | undefined;
function readData(blob:Blob):Promise<string> {
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
}
export function rasterizeLight(svg:string,width:number,height:number):Promise<string> {
  const cached=rasters.get(svg);
  if (cached) return cached;
  const result=(async()=>{
    glowData ??= fetch(GLOW).then(r=>{if(!r.ok) throw new Error("Light image unavailable");return r.blob();}).then(readData).catch(e=>{glowData=undefined;throw e;});
    const source=await embedSvgImages(svg.split(GLOW).join(await glowData));
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Light raster unavailable"));image.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(source);});
    const density=Math.min(2,1024/Math.max(width,height));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.ceil(width*density));canvas.height=Math.max(1,Math.ceil(height*density));
    const context=canvas.getContext("2d");if(!context) throw new Error("Light raster unavailable");
    context.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/png");
  })();
  rasters.set(svg,result);
  if(rasters.size>48) rasters.delete(rasters.keys().next().value!);
  result.catch(()=>rasters.delete(svg));
  return result;
}

function LightRaster({art,width,height}: {art:ReactElement;width:number;height:number}) {
  const [source,setSource]=useState<string>();
  useEffect(()=>{let active=true;setSource(undefined);const svg=renderToStaticMarkup(art);rasterizeLight(svg,width,height).then(src=>{if(active)setSource(src);}).catch(()=>{if(active)setSource("");});return()=>{active=false;};},[art,width,height]);
  return <img src={source || undefined} alt="" width={width} height={height} data-light-raster-ready={source !== undefined} />;
}

export function lightBounds(l: VisualLight) {
  const angle=l.smer*Math.PI/180, half=l.tvar === "pruh" ? l.delka*12 : 0;
  const x=Math.ceil((l.radius+half*Math.abs(Math.cos(angle)))*1.13+2);
  const y=Math.ceil((l.radius+half*Math.abs(Math.sin(angle)))*1.13+2);
  return {x,y,left:l.x*24-x,top:l.y*24-y,width:x*2,height:y*2};
}

export function lightTint(hex: string, degrees: number) {
  const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const c=Math.cos(degrees*Math.PI/180), s=Math.sin(degrees*Math.PI/180);
  const matrix=[
    [.213+.787*c-.213*s,.715-.715*c-.715*s,.072-.072*c+.928*s],
    [.213-.213*c+.143*s,.715+.285*c+.140*s,.072-.072*c-.283*s],
    [.213-.213*c-.787*s,.715-.715*c+.715*s,.072+.928*c+.072*s],
  ];
  return "#"+matrix.map(row=>Math.max(0,Math.min(255,Math.round(row.reduce((n,v,i)=>n+v*channels[i],0)))).toString(16).padStart(2,"0")).join("");
}

export function visibleLight(l: VisualLight, view: {x:number;y:number;k:number}, px: number, width: number, height: number) {
  const b=lightBounds(l), scale=view.k*px/24;
  return b.left*scale+view.x < width && b.top*scale+view.y < height && (b.left+b.width)*scale+view.x > 0 && (b.top+b.height)*scale+view.y > 0;
}

export function AnimatedLightMask({light,polygon,shadows,objects,assets,width,height}:{light:VisualLight;polygon:Point[];shadows:ObjectLightShadow[];objects:MapObject[];assets:Record<string,AssetEntry>;width:number;height:number}) {
  const b=lightBounds(light);
  return <svg xmlns="http://www.w3.org/2000/svg" width={b.width} height={b.height} viewBox={`${b.left} ${b.top} ${b.width} ${b.height}`}><defs>
    <ObjectShadowMask id="shadow" shadows={shadows} width={width*24} height={height*24}/>
    <ObjectArtworkMask id="artwork" objects={objects} assets={assets} width={width*24} height={height*24}/>
  </defs><g mask="url(#artwork)"><g mask="url(#shadow)">{polygon.length?<polygon points={polygon.map(([x,y])=>`${x*24},${y*24}`).join(" ")} fill="white"/>:<rect width={width*24} height={height*24} fill="white"/>}</g></g></svg>;
}

const AnimatedLight = memo(function AnimatedLight({light:l,blockers,shadows,objects,assets,width,height,animate}: {
  light:VisualLight;blockers:LightSegment[];shadows:ObjectLightShadow[];objects:MapObject[];assets:Record<string,AssetEntry>;width:number;height:number;animate:boolean;
}) {
  const id=useId().replace(/:/g,"");
  const b=lightBounds(l);
  const nearby=l.stiny ? nearbyLightBlockers([l.x,l.y],lightReach(l),blockers) : [];
  const blockerKey=nearby.map(w=>[...w.a,...w.b].join(",")).join(";");
  const polygon=useMemo(()=>nearby.length ? visibilityPolygon([l.x,l.y],nearby,width,height) : [],[l.x,l.y,blockerKey,width,height]);
  const clipPath=polygon.length ? `polygon(${polygon.map(([x,y])=>`${x*24-b.left}px ${y*24-b.top}px`).join(",")})` : undefined;
  const [rasterMask,setRasterMask]=useState<{key:string;src:string}>();
  const maskKey=JSON.stringify([polygon,shadows,objects.map(o=>[o.asset,o.x,o.y,o.w,o.h,o.rot,o.flip,o.v,assets[o.asset] && assetSrc(assets[o.asset],o.v)]),b.left,b.top,b.width,b.height]);
  const mask=rasterMask?.key===maskKey?rasterMask.src:undefined,needsMask=!!(polygon.length || shadows.length || objects.length);
  useEffect(()=>{
    let active=true;
    if(needsMask){
      const art=<AnimatedLightMask light={l} polygon={polygon} shadows={shadows} objects={objects} assets={assets} width={width} height={height}/>;
      rasterizeLight(renderToStaticMarkup(art),b.width,b.height).then(src=>{if(active)setRasterMask({key:maskKey,src});}).catch(()=>{});
    }
    return()=>{active=false;};
  },[maskKey]);
  const shimmer=l.efekt === "plamen" || l.efekt === "magie";
  const sprite=(alternate:boolean) => {
    const key=id+(alternate ? "warm" : "base");
    return <svg xmlns="http://www.w3.org/2000/svg" width={b.width} height={b.height} viewBox={`${-b.x} ${-b.y} ${b.width} ${b.height}`}>
      <defs>
        <LightDefinition id={key} light={l} blockers={[]} width={b.width} height={b.height} />
        <filter id={key+"tint"} colorInterpolationFilters="sRGB"><feFlood floodColor={alternate ? lightTint(l.color!,l.efekt === "plamen" ? -7 : 24) : l.color} /><feComposite in2="SourceAlpha" operator="in" /></filter>
      </defs>
      <g transform={`rotate(${l.smer})`}><use href={`#${key}`} filter={`url(#${key}tint)`} /></g>
    </svg>;
  };
  const base=useMemo(()=>sprite(false),[l.tvar,l.sirka,l.delka,l.radius,l.bright,l.smer,l.color,b.width,b.height]);
  const alternate=useMemo(()=>shimmer ? sprite(true) : null,[base,l.efekt]);
  return <div className="map-light-clip" style={{left:b.left,top:b.top,width:b.width,height:b.height,clipPath:mask?undefined:clipPath,maskImage:mask?`url("${mask}")`:undefined,maskSize:"100% 100%",opacity:needsMask&&!mask?0:l.intenzita*.2}} data-animated-light={l.id}>
    <div className={`map-light-raster${animate ? ` map-light-effect map-light-${l.efekt}` : ""}`} style={lightAnimationStyle(l)}>
      <LightRaster art={base} width={b.width} height={b.height} />
      {alternate && <div className={`map-light-alternate${animate ? " map-light-crossfade" : ""}`} style={lightAnimationStyle(l)}><LightRaster art={alternate} width={b.width} height={b.height} /></div>}
    </div>
  </div>;
});

export const MapAnimatedLights = memo(function MapAnimatedLights({map,view,px,doors,viewport}: {
  map:MapV2;view:{x:number;y:number;k:number};px:number;doors?:Record<string,boolean>;viewport?:{width:number;height:number};
}) {
  const cap=useSyncExternalStore(subscribeBudget,getBudget,()=>12 as const);
  const [meanMs,setMeanMs]=useState<number>();
  const [epoch,setEpoch]=useState(0);
  const {assets}=useMapManifests();
  const blockers=useMemo(()=>lightBlockers(mapWalls(map),doors),[map.steny,map.trasy,doors]);
  const wallKey=blockers.map(w=>[...w.a,...w.b].join(",")).join(";");
  const width=map.mrizka[0]?.length || 1,height=map.mrizka.length;
  const vw=viewport?.width ?? (typeof window === "undefined" ? width*px*view.k : window.innerWidth);
  const vh=viewport?.height ?? (typeof window === "undefined" ? height*px*view.k : window.innerHeight);
  const candidates=visualLights(map,assets).filter(l=>l.efekt !== "zadny" && l.radius > 0 && l.intenzita > 0 && visibleLight(l,view,px,vw,vh));
  const scale=view.k*px/24;
  const active=nearestLights(candidates,[(vw/2-view.x)/scale/24,(vh/2-view.y)/scale/24],cap);
  const sampleKey=JSON.stringify([candidates,wallKey,view,vw,vh]);
  useEffect(()=>{
    const changed=()=>setEpoch(n=>n+1), motion=matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("map-animations",changed); motion.addEventListener("change",changed);
    return()=>{window.removeEventListener("map-animations",changed);motion.removeEventListener("change",changed);};
  },[]);
  useEffect(()=>{
    if(!active.length || document.documentElement.dataset.mapAnimations === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame=0,first=0,last=0,total=0,count=0;
    const sample=(now:number)=>{
      if(document.visibilityState !== "visible") {first=last=0;total=count=0;frame=requestAnimationFrame(sample);return;}
      if(!first) first=now;
      if(last) {total+=now-last;count++;} last=now;
      if(now-first<2000) {frame=requestAnimationFrame(sample);return;}
      const mean=total/Math.max(1,count);setMeanMs(mean);
      const next=nextLightAnimationCap(sessionCap,mean);
      if(next !== sessionCap) {sessionCap=next;try{sessionStorage.setItem(CAP_KEY,String(next));}catch{};budgetListeners.forEach(listener=>listener());}
    };
    frame=requestAnimationFrame(sample);
    return()=>cancelAnimationFrame(frame);
  },[sampleKey,cap,epoch]);
  return <div style={{display:"contents"}} data-light-animation-cap={cap} data-light-mean-ms={meanMs?.toFixed(2)}>{active.map(l=>
    <AnimatedLight key={l.id} light={l} blockers={blockers} shadows={finiteLightShadows({...l,bright:l.bright/24*5},map.objekty,assets,blockers)} objects={(map.objekty || []).filter(o=>!o.dmOnly && Math.hypot(o.x-l.x,o.y-l.y)<lightReach(l)+Math.max(o.w,o.h))} assets={assets} width={width} height={height} animate />
  )}</div>;
});

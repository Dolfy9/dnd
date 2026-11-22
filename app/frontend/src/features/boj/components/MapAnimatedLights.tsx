import { memo, useEffect, useId, useMemo, useState, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MapV2 } from "../model/mapV2";
import { lightBlockers, visibilityPolygon, type LightSegment } from "../model/lightGeometry";
import { useMapManifests } from "./MapV2Layers";
import { visualLights } from "./MapAtmoLayers";
import { GLOW, LightDefinition, lightAnimationStyle, type VisualLight } from "./MapLightProjection";

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
    const source=svg.split(GLOW).join(await glowData);
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

const AnimatedLight = memo(function AnimatedLight({light:l,blockers,wallKey,width,height,animate}: {
  light:VisualLight;blockers:LightSegment[];wallKey:string;width:number;height:number;animate:boolean;
}) {
  const id=useId().replace(/:/g,"");
  const b=lightBounds(l);
  const polygon=useMemo(()=>l.stiny && blockers.length ? visibilityPolygon([l.x,l.y],blockers,width,height) : [],[l.x,l.y,l.stiny,wallKey,width,height]);
  const clipPath=polygon.length ? `polygon(${polygon.map(([x,y])=>`${x*24-b.left}px ${y*24-b.top}px`).join(",")})` : undefined;
  const shimmer=l.efekt === "plamen" || l.efekt === "magie";
  const sprite=(alternate:boolean) => {
    const key=id+(alternate ? "warm" : "base");
    return <svg xmlns="http://www.w3.org/2000/svg" width={b.width} height={b.height} viewBox={`${-b.x} ${-b.y} ${b.width} ${b.height}`}>
      <defs>
        <LightDefinition id={key} light={l} blockers={[]} wallKey="" width={b.width} height={b.height} />
        <filter id={key+"tint"} colorInterpolationFilters="sRGB"><feFlood floodColor={alternate ? lightTint(l.color!,l.efekt === "plamen" ? -7 : 24) : l.color} /><feComposite in2="SourceAlpha" operator="in" /></filter>
      </defs>
      <g transform={`rotate(${l.smer})`}><use href={`#${key}`} filter={`url(#${key}tint)`} /></g>
    </svg>;
  };
  const base=useMemo(()=>sprite(false),[l.tvar,l.sirka,l.delka,l.radius,l.bright,l.smer,l.color,b.width,b.height]);
  const alternate=useMemo(()=>shimmer ? sprite(true) : null,[base,l.efekt]);
  return <div className="map-light-clip" style={{left:b.left,top:b.top,width:b.width,height:b.height,clipPath,opacity:l.intenzita*.2}} data-animated-light={l.id}>
    <div className={`map-light-raster${animate ? ` map-light-effect map-light-${l.efekt}` : ""}`} style={lightAnimationStyle(l)}>
      <LightRaster art={base} width={b.width} height={b.height} />
      {alternate && <div className={`map-light-alternate${animate ? " map-light-crossfade" : ""}`} style={lightAnimationStyle(l)}><LightRaster art={alternate} width={b.width} height={b.height} /></div>}
    </div>
  </div>;
});

export const MapAnimatedLights = memo(function MapAnimatedLights({map,view,px,doors}: {
  map:MapV2;view:{x:number;y:number;k:number};px:number;doors?:Record<string,boolean>;
}) {
  const {assets}=useMapManifests();
  const blockers=useMemo(()=>lightBlockers(map.steny,doors),[map.steny,doors]);
  const wallKey=blockers.map(w=>[...w.a,...w.b].join(",")).join(";");
  const width=map.mrizka[0]?.length || 1,height=map.mrizka.length;
  const vw=typeof window === "undefined" ? width*px*view.k : window.innerWidth;
  const vh=typeof window === "undefined" ? height*px*view.k : window.innerHeight;
  return <>{visualLights(map,assets).filter(l=>l.efekt !== "zadny" && l.radius > 0 && l.intenzita > 0 && visibleLight(l,view,px,vw,vh)).slice(0,2).map(l=>
    <AnimatedLight key={l.id} light={l} blockers={blockers} wallKey={wallKey} width={width} height={height} animate />
  )}</>;
});

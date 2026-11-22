import {useEffect,useId,useState} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {MapV2} from "../model/mapV2";
import {castsShadow,convexHull,directionalShadow,objectFootprint,objectHeight} from "../model/objectShadows";
import {lightBlockers,type Point} from "../model/lightGeometry";
import {rasterizeAtmosphere} from "../model/atmosphereRaster";
import type {AssetEntry} from "../../mapeditor/assets/manifest";
import {visualLights} from "./MapAtmoLayers";
import {mapWalls} from "../model/mapRoutes";

const plans=new Map<string,ContactShadowPlan>();
export function contactShadowPlan(map:MapV2,assets:Record<string,AssetEntry>,doors?:Record<string,boolean>) {
  const lights=visualLights(map,assets).map(l=>({...l,bright:l.bright/24*5})),walls=lightBlockers(mapWalls(map),doors);
  const objects=(map.objekty || []).filter(o=>castsShadow(o,assets[o.asset]));
  const key=JSON.stringify([lights,walls,objects.map(o=>[o.id,o.asset,o.x,o.y,o.w,o.h,o.rot,o.flip,o.v,objectHeight(o,assets[o.asset])])]),existing=plans.get(key);
  if(existing)return existing;
  const plan=objects.map(o=>{
    const shadow=directionalShadow(o,lights,walls,assets[o.asset]),outline=objectFootprint(o,assets[o.asset]);
    const dx=shadow?.x ?? .035,dy=shadow?.y ?? .065;
    return {id:o.id,x:o.x,y:o.y,angle:shadow?Math.atan2(dy,dx)*180/Math.PI:o.rot || 0,outline,polygon:convexHull([...outline,...outline.map(([x,y]):Point=>[x+dx,y+dy])]),to:[o.x+dx,o.y+dy] as Point,opacity:shadow?.strength ? .18+Math.min(.2,objectHeight(o,assets[o.asset])*.08)*shadow.strength : .25};
  });
  plans.set(key,plan);if(plans.size>32)plans.delete(plans.keys().next().value!);
  return plan;
}
export type ContactShadowPlan={id:string;x:number;y:number;angle:number;outline:Point[];polygon:Point[];to:Point;opacity:number}[];
export function ContactShadowArtwork({plan,width,height}:{plan:ContactShadowPlan;width:number;height:number}) {
  const id=useId().replace(/:/g,"");
  return <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <defs><filter id={id+"soft"} x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
    {plan.map((s,i)=><g key={s.id} data-contact-shadow={s.id} opacity={s.opacity} filter={`url(#${id}soft)`}>
      <defs><linearGradient id={id+i} gradientUnits="userSpaceOnUse" x1={s.x*24} y1={s.y*24} x2={s.to[0]*24} y2={s.to[1]*24}><stop stopColor="black"/><stop offset=".4" stopColor="black" stopOpacity=".7"/><stop offset="1" stopColor="black" stopOpacity="0"/></linearGradient></defs>
      <polygon points={s.polygon.map(([x,y])=>`${x*24},${y*24}`).join(" ")} fill={`url(#${id+i})`}/>
      <polygon points={s.outline.map(([x,y])=>`${x*24},${y*24}`).join(" ")} fill="black" opacity=".7"/>
    </g>)}
  </svg>;
}
export function MapContactShadows({plan,width,height}:{plan:ContactShadowPlan;width:number;height:number}) {
  const key=JSON.stringify([plan,width,height]),[bitmap,setBitmap]=useState<string>();
  useEffect(()=>()=>{if(bitmap)URL.revokeObjectURL(bitmap);},[bitmap]);
  useEffect(()=>{
    let active=true;
    if(!plan.length){setBitmap(undefined);return;}
    const timer=setTimeout(()=>{
      rasterizeAtmosphere(renderToStaticMarkup(<ContactShadowArtwork plan={plan} width={width} height={height}/>),width,height,window.devicePixelRatio || 1,2048).then(url=>{if(active)setBitmap(url);else URL.revokeObjectURL(url);}).catch(()=>{});
    },150);
    return()=>{active=false;clearTimeout(timer);};
  },[key]);
  if(!plan.length)return null;
  return <g data-contact-shadows data-contact-baked={!!bitmap} pointerEvents="none">{bitmap?<image href={bitmap} width={width} height={height}/>:<ContactShadowArtwork plan={plan} width={width} height={height}/>}</g>;
}

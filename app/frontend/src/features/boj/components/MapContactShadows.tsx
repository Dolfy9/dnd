import {useEffect,useId,useState} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {MapV2} from "../model/mapV2";
import {directionalShadow} from "../model/objectShadows";
import {lightBlockers} from "../model/lightGeometry";
import {rasterizeAtmosphere} from "../model/atmosphereRaster";
import type {AssetEntry} from "../../mapeditor/assets/manifest";
import {visualLights} from "./MapAtmoLayers";

const plans=new Map<string,ContactShadowPlan>();
export function contactShadowPlan(map:MapV2,assets:Record<string,AssetEntry>,doors?:Record<string,boolean>) {
  const lights=visualLights(map,assets).map(l=>({...l,bright:l.bright/24*5})),walls=lightBlockers(map.steny,doors);
  const objects=(map.objekty || []).filter(o=>!o.dmOnly && o.stin!==false && !o.asset.startsWith("d-") && (o.z ?? assets[o.asset]?.z ?? 0)>=0 && [o.x,o.y,o.w,o.h].every(Number.isFinite));
  const key=JSON.stringify([lights,walls,objects.map(o=>[o.id,o.x,o.y,o.w,o.h])]),existing=plans.get(key);
  if(existing)return existing;
  const plan=objects.map(o=>{
    const shadow=directionalShadow(o,lights,walls);
    return shadow?{id:o.id,x:o.x+shadow.x,y:o.y+shadow.y,rx:Math.max(.15,o.w*.42)*shadow.length,ry:Math.max(.12,o.h*.32),angle:Math.atan2(shadow.y,shadow.x)*180/Math.PI,opacity:.25+shadow.strength*.2}
      :{id:o.id,x:o.x,y:o.y+2/24,rx:Math.max(.15,o.w*.48),ry:Math.max(.12,o.h*.46),angle:o.rot || 0,opacity:.4};
  });
  plans.set(key,plan);if(plans.size>32)plans.delete(plans.keys().next().value!);
  return plan;
}
export type ContactShadowPlan={id:string;x:number;y:number;rx:number;ry:number;angle:number;opacity:number}[];
export function ContactShadowArtwork({plan,width,height}:{plan:ContactShadowPlan;width:number;height:number}) {
  const id=useId().replace(/:/g,"");
  return <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <defs><radialGradient id={id}><stop offset="0" stopColor="#000" stopOpacity=".9"/><stop offset=".55" stopColor="#000" stopOpacity=".5"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient></defs>
    {plan.map(s=><ellipse key={s.id} data-contact-shadow={s.id} cx={0} cy={0} rx={s.rx*24} ry={s.ry*24} transform={`translate(${s.x*24},${s.y*24}) rotate(${s.angle})`} fill={`url(#${id})`} opacity={s.opacity}/>)}
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

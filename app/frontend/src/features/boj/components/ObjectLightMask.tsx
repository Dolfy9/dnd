import {assetSrc,assetUrl,type AssetEntry} from "../../mapeditor/assets/manifest";
import type {MapObject} from "../model/mapV2";
import {shadowPath,type ObjectLightShadow} from "../model/objectShadows";

export function ObjectShadowMask({id,shadows,width,height}:{id:string;shadows:ObjectLightShadow[];width:number;height:number}) {
  return <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height} style={{maskType:"luminance"}}>
    <rect width={width} height={height} fill="white"/>
    {shadows.map((s,i)=><g key={s.id}>
      <defs>
        <linearGradient id={id+i+"fade"} gradientUnits="userSpaceOnUse" x1={s.from[0]*24} y1={s.from[1]*24} x2={s.to[0]*24} y2={s.to[1]*24}><stop stopColor="black" stopOpacity={s.opacity}/><stop offset=".35" stopColor="black" stopOpacity={s.opacity*.8}/><stop offset="1" stopColor="black" stopOpacity="0"/></linearGradient>
        <filter id={id+i+"soft"} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={s.softness}/></filter>
      </defs>
      <path data-finite-object-shadow={s.id} d={shadowPath(s)} fillRule="evenodd" fill={`url(#${id+i}fade)`} filter={`url(#${id+i}soft)`}/>
    </g>)}
  </mask>;
}

export function ObjectArtworkMask({id,objects,assets,width,height}:{id:string;objects:MapObject[];assets:Record<string,AssetEntry>;width:number;height:number}) {
  return <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height} style={{maskType:"luminance"}}>
    <defs><filter id={id+"alpha"}><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter></defs>
    <rect width={width} height={height} fill="white"/>
    {objects.filter(o=>!o.dmOnly).map(o=>{
      const a=assets[o.asset],src=a?assetUrl(assetSrc(a,o.v)):o.asset.startsWith("img:")?"/repo/11_Mapy/bojove/"+o.asset.slice(4):undefined;
      return src?<image key={o.id} data-glow-exclusion={o.id} href={src} x={-o.w*12} y={-o.h*12} width={o.w*24} height={o.h*24} preserveAspectRatio="xMidYMid meet" transform={`translate(${o.x*24},${o.y*24}) rotate(${o.rot || 0}) scale(${o.flip?-1:1},1)`} filter={`url(#${id}alpha)`}/>:null;
    })}
  </mask>;
}

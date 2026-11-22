import { memo, useId } from "react";
import type { MapV2, MapRoute } from "../model/mapV2";
import { routeGeometry, routeRandom } from "../model/mapRoutes";
import { assetSrc, assetUrl } from "../../mapeditor/assets/manifest";
import { useMapManifests } from "./MapV2Layers";

const RouteArtwork=memo(function RouteArtwork({route:r}:{route:MapRoute}) {
  const id="route"+useId().replace(/:/g,""),g=routeGeometry(r),{assets,textures}=useMapManifests();
  const width=r.sirka*24,texture=r.druh==="molo"?textures.drevo:textures[r.t||""]||textures[r.druh==="zidka"?"t-pristavni-kamen":"t-zahradni-cesta"];
  const pad=width+12,b=g.bounds;
  const bounds={x:b.minX*24-pad,y:b.minY*24-pad,width:(b.maxX-b.minX)*24+pad*2,height:(b.maxY-b.minY)*24+pad*2};
  const path={d:g.path,fill:"none",strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  const sprite=(asset:string,x:number,y:number,w:number,h:number,angle:number,v:number,key:string)=>{
    const a=assets[asset];return a?<image key={key} href={assetUrl(assetSrc(a,v))} x={-w*12} y={-h*12} width={w*24} height={h*24} transform={`translate(${x*24},${y*24}) rotate(${angle})`} preserveAspectRatio="none"/>:null;
  };
  return <g data-route={r.id} data-route-kind={r.druh} pointerEvents="none">
    <defs>
      {texture&&<pattern id={id+"tex"} width={texture.cells*24} height={texture.cells*24} patternUnits="userSpaceOnUse"><image href={assetUrl(texture.src)} width={texture.cells*24} height={texture.cells*24}/></pattern>}
      {texture&&g.deck.map((s,i)=><pattern key={i} id={id+"deck"+i} href={"#"+id+"tex"} patternTransform={`translate(${-s.distance*24},0)`}/>)}
      <filter id={id+"soft"} filterUnits="userSpaceOnUse" {...bounds}><feGaussianBlur stdDeviation={r.druh==="cesta"?.7:1.8}/></filter>
      <filter id={id+"edge"} filterUnits="userSpaceOnUse" {...bounds}><feTurbulence type="fractalNoise" baseFrequency=".1" numOctaves="3" seed={r.seed??17}/><feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.1"/></filter>
      <mask id={id+"mask"} maskUnits="userSpaceOnUse" {...bounds}><path {...path} stroke="white" strokeWidth={width} filter={`url(#${id}edge)`}/></mask>
    </defs>
    {r.druh==="plot"?<>
      <path {...path} stroke="#070f07" strokeWidth={width*.95} opacity=".45" transform="translate(2,4)" filter={`url(#${id}soft)`}/>
      {g.sprites.map((s,i)=>sprite("z-zivy-plot",s.x,s.y,r.sirka*1.9,r.sirka*1.12,s.angle+(s.jitter-.5)*7,(s.v+(r.v||0))%4,"h"+i))}
    </>:r.druh==="molo"?<>
      <path {...path} stroke="#071015" strokeWidth={width+5} opacity=".65" transform="translate(4,7)" filter={`url(#${id}soft)`}/>
      <path {...path} stroke="#33291e" strokeWidth={width+1} strokeLinecap="butt" strokeLinejoin="miter"/>
      <path {...path} stroke={texture?`url(#${id}tex)`:"#685039"} strokeWidth={width} strokeLinecap="butt" strokeLinejoin="miter"/>
      {g.deck.map((s,i)=><rect key={i} x="-.4" y={-width/2} width={s.length*24+.8} height={width} fill={texture?`url(#${id}deck${i})`:"#685039"} transform={`translate(${s.a[0]*24},${s.a[1]*24}) rotate(${s.angle})`}/>)}
      {g.planks.map((s,i)=><line key={i} x1={s.x*24-Math.sin(s.angle*Math.PI/180)*width/2} y1={s.y*24+Math.cos(s.angle*Math.PI/180)*width/2} x2={s.x*24+Math.sin(s.angle*Math.PI/180)*width/2} y2={s.y*24-Math.cos(s.angle*Math.PI/180)*width/2} stroke={i%3?"#211a13":"#d1b58b"} opacity={i%3?.48:.25} strokeWidth=".65"/>)}
      {g.sprites.flatMap((s,i)=>[-1,1].map(side=>sprite("p-lodni-kolik",s.x-Math.sin(s.angle*Math.PI/180)*r.sirka*.48*side,s.y+Math.cos(s.angle*Math.PI/180)*r.sirka*.48*side,.34,.34,s.angle,s.v,"p"+i+side)))}
    </>:<>
      <path {...path} stroke="#191c14" strokeWidth={width+(r.druh==="zidka"?3:2)} opacity={r.druh==="zidka"?.6:.28} transform={`translate(${r.druh==="zidka"?2:0},${r.druh==="zidka"?4:1})`} filter={`url(#${id}soft)`}/>
      <path {...path} stroke={texture?`url(#${id}tex)`:"#9c957d"} strokeWidth={width+(r.druh==="cesta"?12:3)} mask={r.druh==="cesta"?`url(#${id}mask)`:undefined}/>
      {r.druh==="cesta"?<path {...path} stroke="#29281a" strokeWidth={width+12} opacity=".12" mask={`url(#${id}mask)`}/>:<><path {...path} stroke="#d4d0b4" strokeWidth="1.2" opacity=".65" transform={`translate(0,${-width*.32})`}/>{r.brectan&&g.sprites.filter((_,i)=>routeRandom(r.seed??7,i)>.35).map((s,i)=>sprite("z-brectan-previs",s.x,s.y+.1,r.sirka*2,r.sirka*1.5,s.angle,s.v,"i"+i))}</>}
    </>}
  </g>;
});
export const MapRouteLayer=memo(function MapRouteLayer({map}:{map:Pick<MapV2,"trasy">}) {
  return <g data-map-routes>{map.trasy?.map(r=><RouteArtwork key={r.id} route={r}/>)}</g>;
});

import { memo, useId } from "react";
import type { MapV2, MapRoute } from "../model/mapV2";
import { routeGeometry, routeRandom } from "../model/mapRoutes";
import { assetSrc, assetUrl } from "../../mapeditor/assets/manifest";
import { useMapManifests } from "./MapV2Layers";

const RouteArtwork=memo(function RouteArtwork({route:r}:{route:MapRoute}) {
  const id="route"+useId().replace(/:/g,""),g=routeGeometry(r),{assets,textures}=useMapManifests();
  const width=r.sirka*24,texture=r.druh==="molo"?undefined:textures[r.t||""]||textures[r.druh==="zidka"?"t-pristavni-kamen":"t-zahradni-cesta"];
  const pad=width+12,b=g.bounds;
  const bounds={x:b.minX*24-pad,y:b.minY*24-pad,width:(b.maxX-b.minX)*24+pad*2,height:(b.maxY-b.minY)*24+pad*2};
  const path={d:g.path,fill:"none",strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  const sprite=(asset:string,x:number,y:number,w:number,h:number,angle:number,v:number,key:string,src?:string)=>{
    const a=assets[asset];return a?<image key={key} href={assetUrl(src||assetSrc(a,v))} x={-w*12} y={-h*12} width={w*24} height={h*24} transform={`translate(${x*24},${y*24}) rotate(${angle})`} preserveAspectRatio="none"/>:null;
  };
  return <g data-route={r.id} data-route-kind={r.druh} pointerEvents="none">
    <defs>
      {texture&&<pattern id={id+"tex"} width={texture.cells*24} height={texture.cells*24} patternUnits="userSpaceOnUse"><image href={assetUrl(texture.src)} width={texture.cells*24} height={texture.cells*24}/></pattern>}
      {g.planks.map((s,i)=><clipPath key={i} id={id+"board"+i}><path d={s.path}/></clipPath>)}
      <filter id={id+"side"} filterUnits="userSpaceOnUse" {...bounds}><feColorMatrix type="matrix" values=".3 0 0 0 0  0 .38 0 0 0  0 0 .28 0 0  0 0 0 1 0"/></filter>
      <filter id={id+"post"} filterUnits="userSpaceOnUse" {...bounds}><feComponentTransfer><feFuncR type="linear" slope=".66"/><feFuncG type="linear" slope=".66"/><feFuncB type="linear" slope=".62"/></feComponentTransfer></filter>
      <filter id={id+"soft"} filterUnits="userSpaceOnUse" {...bounds}><feGaussianBlur stdDeviation={r.druh==="cesta"?.7:1.8}/></filter>
      <filter id={id+"edge"} filterUnits="userSpaceOnUse" {...bounds}><feTurbulence type="fractalNoise" baseFrequency=".1" numOctaves="3" seed={r.seed??17}/><feDisplacementMap in="SourceGraphic" scale="6" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.1"/></filter>
      <mask id={id+"mask"} maskUnits="userSpaceOnUse" {...bounds}><path {...path} stroke="white" strokeWidth={width} filter={`url(#${id}edge)`}/></mask>
      <mask id={id+"rim"} maskUnits="userSpaceOnUse" {...bounds}><path {...path} stroke="white" strokeWidth={width+12}/><path {...path} stroke="black" strokeWidth={Math.max(1,width-6)}/></mask>
    </defs>
    {r.druh==="plot"?<>
      <path {...path} stroke="#070f07" strokeWidth={width*1.2} opacity=".6" transform="translate(3,7)" filter={`url(#${id}soft)`}/>
      <g data-hedge-side filter={`url(#${id}side)`}>{g.sprites.map((s,i)=>sprite("z-zivy-plot",s.x+.035,s.y+.18*r.sirka,r.sirka*2.1,r.sirka*1.45,s.angle+(s.jitter-.5)*5,s.v,"hs"+i,`bojove/assets/Trasy/listovi-${s.v}.webp`))}</g>
      <g data-hedge-top>{g.sprites.map((s,i)=>sprite("z-zivy-plot",s.x,s.y,r.sirka*2.1,r.sirka*1.45,s.angle+(s.jitter-.5)*5,(s.v+(r.v||0))%4,"h"+i,i%11===5?undefined:`bojove/assets/Trasy/listovi-${(s.v+(r.v||0))%4}.webp`))}</g>
    </>:r.druh==="molo"?<>
      <path {...path} data-deck-shadow stroke="#071015" strokeWidth={width+1} strokeLinecap="butt" opacity=".55" transform="translate(2,3)" filter={`url(#${id}soft)`}/>
      <path {...path} data-waterline stroke="#b4d0c3" strokeWidth={width+3} strokeLinecap="butt" opacity=".22"/>
      <path {...path} stroke="#d1e3d4" strokeWidth={width+4} strokeLinecap="butt" strokeDasharray="3 9 7 19" opacity=".15"/>
      <path {...path} stroke="#29251d" strokeWidth={width} strokeLinecap="butt" strokeLinejoin="miter"/>
      {g.planks.map((s,i)=><g key={i} data-deck-board clipPath={`url(#${id}board${i})`}><image href={assetUrl(`bojove/assets/Trasy/prkno-${s.v}.webp`)} x={s.left} y={s.top} width={s.width} height={s.height} transform={`translate(${s.x*24},${s.y*24}) rotate(${s.angle})`} preserveAspectRatio="none"/><path d={s.path} fill="#100f0b" opacity={s.tone}/></g>)}
      <g filter={`url(#${id}post)`}>{g.sprites.flatMap((s,i)=>[-1,1].map(side=>sprite("p-lodni-kolik",s.x-Math.sin(s.angle*Math.PI/180)*r.sirka*.48*side,s.y+Math.cos(s.angle*Math.PI/180)*r.sirka*.48*side,.65,.65,s.angle,s.v,"p"+i+side)))}</g>
    </>:<>
      <path {...path} stroke="#191c14" strokeWidth={width+(r.druh==="zidka"?3:2)} opacity={r.druh==="zidka"?.6:.28} transform={`translate(${r.druh==="zidka"?2:0},${r.druh==="zidka"?4:1})`} filter={`url(#${id}soft)`}/>
      {r.druh==="zidka"&&<path {...path} stroke="#34372c" strokeWidth={width+4}/>}
      <path {...path} stroke={texture?`url(#${id}tex)`:"#9c957d"} strokeWidth={width+(r.druh==="cesta"?12:1)} mask={r.druh==="cesta"?`url(#${id}mask)`:undefined}/>
      {r.druh==="cesta"?<g mask={`url(#${id}mask)`}><path {...path} stroke="#29281a" strokeWidth={width+12} opacity=".28" mask={`url(#${id}rim)`}/></g>:<><path {...path} stroke="#ded9bb" strokeWidth=".8" opacity=".38" transform={`translate(0,${-width*.28})`}/>{r.brectan&&g.sprites.filter((_,i)=>routeRandom(r.seed??7,i)>.35).map((s,i)=>sprite("z-brectan-previs",s.x,s.y+.1,r.sirka*2,r.sirka*1.5,s.angle,s.v,"i"+i))}</>}
    </>}
  </g>;
});
export const MapRouteLayer=memo(function MapRouteLayer({map}:{map:Pick<MapV2,"trasy">}) {
  return <g data-map-routes>{map.trasy?.map(r=><RouteArtwork key={r.id} route={r}/>)}</g>;
});

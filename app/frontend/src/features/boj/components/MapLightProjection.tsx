import { memo, useMemo, type CSSProperties } from "react";
import { normalizeLight } from "../model/mapV2";
import { conePath, nearbyLightBlockers, visibilityPolygon, type LightSegment } from "../model/lightGeometry";
import { animationPhase } from "./MapMotion";
import { coneFeatherLayers } from "../model/lightAnimationPolicy";

export const GLOW = "/repo/11_Mapy/bojove/ovl/zar.webp";
export type VisualLight = ReturnType<typeof normalizeLight> & {radius: number};

export function lightReach(l:VisualLight) {
  return (l.radius/24+(l.tvar==="pruh" ? l.delka/2 : 0))*1.13+2/24;
}

export function lightAnimationStyle(l: VisualLight): CSSProperties {
  const duration={zadny:1,mihot:3.7,plamen:2.9,pulz:4.8,magie:7.5}[l.efekt]/l.rychlost;
  return {animationDuration:`${duration}s`,animationDelay:`${animationPhase(l.id)/l.rychlost}s`};
}

export function LightProjection({id,light:l,filter,soften,shadowMask}: {id:string;light:VisualLight;filter:string;soften?:string;shadowMask?:string}) {
  return <g mask={shadowMask?`url(#${shadowMask})`:undefined} filter={soften?`url(#${soften})`:undefined}><g clipPath={l.stiny ? `url(#${id}visibility)` : undefined}>
    <g transform={`translate(${l.x*24},${l.y*24}) rotate(${l.smer})`}>
      <use href={`#${id}`} filter={`url(#${filter})`} />
    </g>
  </g></g>;
}

export const LightDefinition = memo(function LightDefinition({ id, light: l, blockers, width, height }: {
  id: string; light: VisualLight; blockers: LightSegment[]; width: number; height: number;
}) {
  const nearby=l.stiny ? nearbyLightBlockers([l.x,l.y],lightReach(l),blockers) : [];
  const blockerKey=nearby.map(w=>[...w.a,...w.b].join(",")).join(";");
  const polygon = useMemo(() => nearby.length ? visibilityPolygon([l.x,l.y],nearby,width/24,height/24) : [],
    [l.x,l.y,blockerKey,width,height]);
  const r=l.radius, half=l.delka*12, extent=r*1.3+(l.tvar === "pruh" ? half : 0);
  const inner=Math.max(.05,Math.min(.85,l.bright/r*.7));
  const bounds={x:-extent,y:-extent,width:extent*2,height:extent*2};
  return <>
    <clipPath id={id+"visibility"} clipPathUnits="userSpaceOnUse">{polygon.length
      ? <polygon points={polygon.map(p => p.map(n => n*24).join(",")).join(" ")} />
      : <rect width={width} height={height} />}</clipPath>
    <radialGradient id={id+"radial"} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={r}>
      <stop offset="0" stopColor="white" /><stop offset={inner} stopColor="white" stopOpacity=".65" /><stop offset="1" stopColor="white" stopOpacity="0" />
    </radialGradient>
    {l.tvar === "kuzel" && <>
      <filter id={id+"feather"} filterUnits="userSpaceOnUse" {...bounds} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={Math.max(.4,r*.006)} /></filter>
      <mask id={id+"cone"} maskUnits="userSpaceOnUse" {...bounds} style={{maskType:"alpha"}}>
        <g filter={`url(#${id}feather)`} data-cone-feather="0.30">{coneFeatherLayers().map((layer,i) =>
          <path key={i} d={conePath(r*1.3,l.sirka*layer.scale)} fill="white" opacity={layer.opacity} />
        )}</g>
      </mask>
      <radialGradient id={id+"apex"} gradientUnits="userSpaceOnUse" cx="0" cy="0" r={r}>
        <stop offset="0" stopColor="white" stopOpacity="0" /><stop offset=".05" stopColor="white" stopOpacity=".45" /><stop offset=".15" stopColor="white" /><stop offset="1" stopColor="white" />
      </radialGradient>
      <mask id={id+"apexMask"} maskUnits="userSpaceOnUse" {...bounds} style={{maskType:"alpha"}}><circle r={r} fill={`url(#${id}apex)`} /></mask>
    </>}
    {l.tvar === "pruh" && <linearGradient id={id+"linear"} x1="0" y1={-r} x2="0" y2={r} gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="white" stopOpacity="0" /><stop offset={(1-inner)/2} stopColor="white" stopOpacity=".65" />
      <stop offset=".5" stopColor="white" /><stop offset={(1+inner)/2} stopColor="white" stopOpacity=".65" /><stop offset="1" stopColor="white" stopOpacity="0" />
    </linearGradient>}
    <g id={id} data-light-shape={l.tvar} data-light-shadows={l.stiny}>
          {l.tvar === "bod" ? <>
            <image href={GLOW} x={-r} y={-r} width={r*2} height={r*2} />
            {l.bright > 0 && <image href={GLOW} x={-l.bright} y={-l.bright} width={l.bright*2} height={l.bright*2} />}
          </> : l.tvar === "kuzel" ? <g mask={`url(#${id}apexMask)`}><circle r={r} fill={`url(#${id}radial)`} mask={`url(#${id}cone)`} /></g> : <>
            <rect x={-half} y={-r} width={half*2} height={r*2} fill={`url(#${id}linear)`} />
            <path transform={`translate(${-half},0)`} d={`M0,${-r} A${r},${r} 0 0 0 0,${r} Z`} fill={`url(#${id}radial)`} />
            <path transform={`translate(${half},0)`} d={`M0,${-r} A${r},${r} 0 0 1 0,${r} Z`} fill={`url(#${id}radial)`} />
          </>}
    </g>
  </>;
});

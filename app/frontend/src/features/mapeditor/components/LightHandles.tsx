import type { PointerEvent } from "react";
import { normalizeLight, type MapLightV2 } from "../../boj/model/mapV2";
import { conePath } from "../../boj/model/lightGeometry";
import { lightHandlePoints, type LightHandle } from "../tools/lightEditing";

export function LightHandles({light,zoom,onBegin}:{light:MapLightV2;zoom:number;onBegin:(event:PointerEvent,handle:LightHandle)=>void}) {
  const l=normalizeLight(light), total=(l.bright+l.dim)/5*24, handles=lightHandlePoints(l), radius=8/Math.max(.15,zoom);
  return <g className="me-light-handles" data-light-handles={light.id}>
    <g transform={`translate(${l.x*24},${l.y*24}) rotate(${l.smer})`} stroke="#e9bf70" strokeWidth="1" fill="none" strokeDasharray="5 5" opacity=".65">
      {l.tvar==="pruh"?<rect x={-l.delka*12-total} y={-total} width={l.delka*24+total*2} height={total*2} rx={total}/>
        : l.tvar==="kuzel"?<path d={conePath(total,l.sirka)}/>:<circle r={total}/>}
      {l.tvar!=="pruh" && <circle r={l.bright/5*24} opacity=".5"/>}
    </g>
    {handles.filter(h=>h.kind!=="origin").map(h=><line key={h.kind} x1={l.x*24} y1={l.y*24} x2={h.point[0]*24} y2={h.point[1]*24} stroke={h.kind==="direction"?"#e9bf70":"#95b4d2"} opacity=".5" strokeDasharray="3 4"/>)}
    {handles.map(h=><circle key={h.kind} role="button" tabIndex={0} aria-label={h.label} data-light-handle={h.kind} className="me-light-handle"
      cx={h.point[0]*24} cy={h.point[1]*24} r={radius} fill={h.kind==="origin"||h.kind==="direction"?"#f2c36a":h.kind==="bright"?"#fff0ba":"#9bc6ec"}
      onPointerDown={e=>onBegin(e,h.kind)}><title>{h.label}{h.kind==="direction"?" · Shift: po 15°":""}</title></circle>)}
  </g>;
}

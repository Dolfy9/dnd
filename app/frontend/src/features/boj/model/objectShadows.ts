import {normalizeLight,type MapLightV2,type MapObject} from "./mapV2";
import type {AssetEntry} from "../../mapeditor/assets/manifest";
import type {LightSegment,Point} from "./lightGeometry";

const roundObject=(o:MapObject,a?:AssetEntry)=>/strom|tree|sloup|pillar|balvan|boulder|kulat|sud|barrel/i.test([o.asset,a?.nazev,...a?.tags || []].join(" "));
export function castsShadow(o:MapObject,a?:AssetEntry):boolean {
  if(o.dmOnly || ![o.x,o.y,o.w,o.h,o.rot ?? 0].every(Number.isFinite) || o.w<=0 || o.h<=0)return false;
  return o.stin ?? ((o.z ?? a?.z ?? 0)>=0 && !!((o.blocks ?? a?.blocks) || (o.cover ?? a?.cover)));
}
export function objectFootprint(o:MapObject,a?:AssetEntry):Point[] {
  const angle=(o.rot || 0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const local:Point[]=roundObject(o,a)?Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*o.w*.42,Math.sin(i*Math.PI/4)*o.h*.42])
    :[[-o.w*.42,-o.h*.42],[o.w*.42,-o.h*.42],[o.w*.42,o.h*.42],[-o.w*.42,o.h*.42]];
  return local.map(([x,y])=>[o.x+x*c-y*s,o.y+x*s+y*c]);
}
const cache=new Map<string,LightSegment[]>();
export function objectBlockers(objects:MapObject[]=[],assets:Record<string,AssetEntry>={}):LightSegment[] {
  const footprints=objects.filter(o=>castsShadow(o,assets[o.asset])).map(o=>objectFootprint(o,assets[o.asset]));
  const key=JSON.stringify(footprints),existing=cache.get(key);
  if(existing)return existing;
  const segments=footprints.flatMap(polygon=>polygon.map((a,i)=>({a,b:polygon[(i+1)%polygon.length],polygon})));
  cache.set(key,segments);if(cache.size>32)cache.delete(cache.keys().next().value!);
  return segments;
}

export function directionalShadow(o:MapObject,lights:MapLightV2[],walls:LightSegment[]=[]):{x:number;y:number;length:number;strength:number}|undefined {
  let strongest=0,result:ReturnType<typeof directionalShadow>;
  for(const input of lights){
    const l=normalizeLight(input),dx=o.x-l.x,dy=o.y-l.y,d=Math.hypot(dx,dy),range=(l.bright+l.dim)/5;
    if(![d,range].every(Number.isFinite) || d<.1 || range<=0 || l.intenzita<=0)continue;
    const radians=l.smer*Math.PI/180,along=dx*Math.cos(radians)+dy*Math.sin(radians),across=-dx*Math.sin(radians)+dy*Math.cos(radians);
    if(l.tvar==="kuzel" && Math.abs((Math.atan2(dy,dx)*180/Math.PI-l.smer+540)%360-180)>l.sirka/2)continue;
    const distance=l.tvar==="pruh"?Math.hypot(Math.max(0,Math.abs(along)-l.delka/2),across):d;
    const strength=l.intenzita*Math.max(0,1-distance/range);
    if(strength<=strongest)continue;
    if(walls.some(({a,b})=>{
      const sx=b[0]-a[0],sy=b[1]-a[1],den=dx*sy-dy*sx;
      if(Math.abs(den)<1e-10)return false;
      const ax=a[0]-l.x,ay=a[1]-l.y,t=(ax*sy-ay*sx)/den,u=(ax*dy-ay*dx)/den;
      return t>1e-6 && t<1-1e-6 && u>=0 && u<=1;
    }))continue;
    strongest=strength;
    const offset=Math.min(1.25,Math.max(.12,d*.09));
    result={x:dx/d*offset,y:dy/d*offset,length:1+strength*.9,strength};
  }
  return result;
}

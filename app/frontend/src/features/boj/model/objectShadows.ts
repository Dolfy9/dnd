import type {MapObject} from "./mapV2";
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

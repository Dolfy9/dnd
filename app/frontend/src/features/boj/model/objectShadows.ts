import {normalizeLight,type MapLightV2,type MapObject} from "./mapV2";
import type {AssetEntry} from "../../mapeditor/assets/manifest";
import type {LightSegment,Point} from "./lightGeometry";
import profiles from "../../../../../../11_Mapy/bojove/assets/stiny.json";
import {normalizeVariant} from "./assetVariants";

const spriteProfiles=profiles as Record<string,{hulls:number[][][];ratios:number[]}>;

export function objectHeight(o:MapObject,a?:AssetEntry):number {
  if((o.z ?? a?.z ?? 0)<0 && o.vyska===undefined && o.stin!==true)return 0;
  const override=o.vyska ?? a?.vyska;
  if(override!==undefined)return Number.isFinite(override)?Math.max(0,Math.min(8,override)):0;
  const name=[o.asset,a?.nazev,a?.kategorie].join(" ");
  if(a?.blend || ((o.z ?? a?.z ?? 0)<0 && o.stin!==true) || /koberec|rohoz|kvetinovy|květinový|p-site\b|sítě|brectan|břečťan|puddle|louže|kaluž|obtisk|efekt/i.test(name))return 0;
  if(/strom|tree|sloup|pillar|soch|skříň|skrin|rotunda/i.test(name))return 3;
  if(/bedn|crate|sud|barrel|lavic|lavič|keř|bush/i.test(name))return .6;
  return o.stin || (o.blocks ?? a?.blocks) || (o.cover ?? a?.cover)?1.2:0;
}

const roundObject=(o:MapObject,a?:AssetEntry)=>/strom|tree|sloup|pillar|balvan|boulder|kulat|sud|barrel/i.test([o.asset,a?.nazev,...a?.tags || []].join(" "));
export function castsShadow(o:MapObject,a?:AssetEntry):boolean {
  if(o.dmOnly || ![o.x,o.y,o.w,o.h,o.rot ?? 0].every(Number.isFinite) || o.w<=0 || o.h<=0)return false;
  return o.stin!==false && objectHeight(o,a)>0;
}
export function objectFootprint(o:MapObject,a?:AssetEntry):Point[] {
  const angle=(o.rot || 0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const profile=spriteProfiles[o.asset],v=normalizeVariant(o.v,(profile?.hulls.length || 1)-1),ratio=profile?.ratios[v] || o.w/o.h;
  const w=Math.min(o.w,o.h*ratio),h=Math.min(o.h,o.w/ratio);
  const hull=profile?.hulls[v];
  const local:Point[]=hull?.length>=3?hull.map(([x,y])=>[(x-.5)*w*(o.flip?-1:1),(y-.5)*h])
    :roundObject(o,a)?Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*o.w*.5,Math.sin(i*Math.PI/4)*o.h*.5])
    :[[-o.w*.5,-o.h*.5],[o.w*.5,-o.h*.5],[o.w*.5,o.h*.5],[-o.w*.5,o.h*.5]];
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

export function directionalShadow(o:MapObject,lights:MapLightV2[],walls:LightSegment[]=[],a?:AssetEntry):{x:number;y:number;length:number;strength:number}|undefined {
  let strongest=0,result:ReturnType<typeof directionalShadow>;
  for(const input of lights){
    if(input.stiny===false)continue;
    const l=normalizeLight(input),radians=l.smer*Math.PI/180;
    const along=(o.x-l.x)*Math.cos(radians)+(o.y-l.y)*Math.sin(radians);
    const offset=l.tvar==="pruh"?Math.max(-l.delka/2,Math.min(l.delka/2,along)):0;
    const lx=l.x+offset*Math.cos(radians),ly=l.y+offset*Math.sin(radians);
    const dx=o.x-lx,dy=o.y-ly,d=Math.hypot(dx,dy),range=(l.bright+l.dim)/5;
    if(![d,range].every(Number.isFinite) || d<.1 || range<=0 || l.intenzita<=0)continue;
    if(l.tvar==="kuzel" && Math.abs((Math.atan2(dy,dx)*180/Math.PI-l.smer+540)%360-180)>l.sirka/2)continue;
    const strength=l.intenzita*Math.max(0,1-d/range);
    if(strength<=strongest)continue;
    if(walls.some(({a,b})=>{
      const sx=b[0]-a[0],sy=b[1]-a[1],den=dx*sy-dy*sx;
      if(Math.abs(den)<1e-10)return false;
      const ax=a[0]-lx,ay=a[1]-ly,t=(ax*sy-ay*sx)/den,u=(ax*dy-ay*dx)/den;
      return t>1e-6 && t<1-1e-6 && u>=0 && u<=1;
    }))continue;
    strongest=strength;
    const height=objectHeight(o,a),length=Math.min(6,range*.65,height*d/Math.max(.75,3-height));
    result={x:dx/d*length,y:dy/d*length,length,strength};
  }
  return result;
}

export function convexHull(points:Point[]):Point[] {
  const sorted=[...points].sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  const half=(p:Point[])=>{const out:Point[]=[];for(const a of p){while(out.length>1){const b=out[out.length-1],c=out[out.length-2];if((b[0]-c[0])*(a[1]-c[1])-(b[1]-c[1])*(a[0]-c[0])>0)break;out.pop();}out.push(a);}return out;};
  return [...half(sorted).slice(0,-1),...half(sorted.reverse()).slice(0,-1)];
}

export interface ObjectLightShadow {id:string;outline:Point[];polygon:Point[];from:Point;to:Point;opacity:number;softness:number}
const shadows=new Map<string,ObjectLightShadow[]>();
export function finiteLightShadows(light:MapLightV2,objects:MapObject[]=[],assets:Record<string,AssetEntry>={},walls:LightSegment[]=[]):ObjectLightShadow[] {
  if(light.stiny===false)return [];
  const candidates=objects.filter(o=>castsShadow(o,assets[o.asset]) && Math.hypot(o.x-light.x,o.y-light.y)<(light.bright+light.dim)/5+(light.tvar==="pruh"?(light.delka ?? 4)/2:0)+Math.max(o.w,o.h));
  const key=JSON.stringify([light,walls,candidates.map(o=>[o.id,o.asset,o.x,o.y,o.w,o.h,o.rot,o.flip,o.v,objectHeight(o,assets[o.asset])])]),cached=shadows.get(key);
  if(cached)return cached;
  const plan=candidates.flatMap(o=>{
    const outline=objectFootprint(o,assets[o.asset]),shadow=directionalShadow(o,[light],walls,assets[o.asset]);
    if(!shadow || Math.hypot(o.x-light.x,o.y-light.y)<Math.max(o.w,o.h)*.4)return [];
    const polygon=convexHull([...outline,...outline.map(([x,y]):Point=>[x+shadow.x,y+shadow.y])]);
    const height=objectHeight(o,assets[o.asset]);
    return [{id:o.id,outline,polygon,from:[o.x,o.y] as Point,to:[o.x+shadow.x,o.y+shadow.y] as Point,opacity:Math.min(.94,.18+height*.27)*Math.min(1,shadow.strength*2),softness:height<1?1.6:1}];
  });
  shadows.set(key,plan);if(shadows.size>96)shadows.delete(shadows.keys().next().value!);
  return plan;
}

export function shadowPath(s:ObjectLightShadow):string {
  return [s.polygon,s.outline].map(poly=>poly.map(([x,y],i)=>`${i?'L':'M'}${x*24},${y*24}`).join(" ")+"Z").join(" ");
}

import type { MapWall, MapV2 } from "./mapV2";

export type RoutePoint = [number,number];
export interface MapRoute {
  id:string;
  druh:"cesta"|"molo"|"plot"|"zidka";
  pts:RoutePoint[];
  sirka:number;
  t?:string;
  hladke:boolean;
  seed?:number;
  v?:number;
  brectan?:boolean;
}
export const ROUTE_KINDS = [["cesta","Cesta"],["molo","Molo / lávka"],["plot","Živý plot"],["zidka","Zídka"]] as const;
export function normalizeRoutes(input:unknown):MapRoute[] {
  return (Array.isArray(input)?input:[]).filter(r=>r && ROUTE_KINDS.some(([k])=>k===r.druh) && Array.isArray(r.pts)).map((r,i)=>({
    id:typeof r.id==="string"?r.id:"trasa"+i,druh:r.druh,
    pts:r.pts.filter((p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==="number"&&Number.isFinite(n))).filter((p:RoutePoint,i:number,a:RoutePoint[])=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>.001),
    sirka:typeof r.sirka==="number"&&Number.isFinite(r.sirka)?Math.max(.25,Math.min(12,r.sirka)):1,
    hladke:r.hladke!==false,...(typeof r.t==="string"?{t:r.t}:{}),
    ...(Number.isFinite(r.seed)?{seed:r.seed}:{}),...(Number.isFinite(r.v)?{v:Math.max(0,Math.floor(r.v))}:{}),...(r.brectan===true?{brectan:true}:{}),
  })).filter(r=>r.pts.length>=2);
}
export function routeDistance(p:RoutePoint,a:RoutePoint,b:RoutePoint) {
  const dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy;
  const t=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
export function smoothRoute(pts:RoutePoint[],smooth=true):RoutePoint[] {
  if(!smooth||pts.length<3)return pts.map(p=>[...p]);
  const out:RoutePoint[]=[];
  for(let i=0;i<pts.length-1;i++){
    const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[i+1],d=pts[Math.min(pts.length-1,i+2)];
    const steps=Math.min(64,Math.max(4,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])*6)));
    for(let j=0;j<steps;j++){const t=j/steps;out.push([0,1].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)) as RoutePoint);}
  }
  return [...out,[...pts[pts.length-1]]];
}
export function routeRandom(seed:number,index:number) {
  let n=(seed|0)^Math.imul(index+1,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;
}
export function sampleRoute(pts:RoutePoint[],spacing:number) {
  const out:{x:number;y:number;angle:number;distance:number}[]=[];
  if(pts.length<2||!Number.isFinite(spacing)||spacing<=0)return out;
  let walked=0,next=0;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(len<1e-9)continue;
    while(next<=walked+len && out.length<6000){const t=(next-walked)/len;out.push({x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI,distance:next});next+=spacing;}
    walked+=len;
  }
  const end=pts[pts.length-1],last=out[out.length-1];
  if(last && Math.hypot(end[0]-last.x,end[1]-last.y)>spacing*.25)out.push({...last,x:end[0],y:end[1],distance:walked});
  return out;
}
const cache=new Map<string,ReturnType<typeof buildRoute>>();
const routeCache=new WeakMap<MapRoute,{pts:RoutePoint[];kind:MapRoute["druh"];width:number;smooth:boolean;seed?:number;id:string;geometry:ReturnType<typeof buildRoute>}>();
function buildRoute(r:MapRoute) {
  const pts=smoothRoute(r.pts,r.hladke),seed=r.seed??[...r.id].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),0);
  const sprites=sampleRoute(pts,Math.max(.18,r.druh==="plot"?r.sirka*.55:r.druh==="molo"?2.2:2.6)).map((s,i)=>({...s,v:Math.floor(routeRandom(seed,i)*4),jitter:routeRandom(seed,i+6000)}));
  const walls:MapWall[]=r.druh==="plot"||r.druh==="zidka"?pts.slice(1).map((b,i)=>({id:`route:${r.id}:${i}`,a:pts[i],b,typ:r.druh==="plot"?"wall":"half"})):[];
  let walked=0;
  const deck=r.druh==="molo"?pts.slice(1).map((b,i)=>{const a=pts[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),distance=walked;walked+=length;return {a,length,distance,angle:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI};}):[];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const [x,y] of pts){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  return {pts,sprites,walls,deck,bounds:{minX,minY,maxX,maxY},planks:r.druh==="molo"?sampleRoute(pts,.24):[],path:pts.map(([x,y],i)=>`${i?"L":"M"}${x*24},${y*24}`).join(" ")};
}
export function routeGeometry(r:MapRoute) {
  const entry=routeCache.get(r);
  if(entry&&entry.pts===r.pts&&entry.kind===r.druh&&entry.width===r.sirka&&entry.smooth===r.hladke&&entry.seed===r.seed&&entry.id===r.id)return entry.geometry;
  const key=JSON.stringify(r),result=cache.get(key)||buildRoute(r);cache.set(key,result);
  if(cache.size>256)cache.delete(cache.keys().next().value!);
  routeCache.set(r,{pts:r.pts,kind:r.druh,width:r.sirka,smooth:r.hladke,seed:r.seed,id:r.id,geometry:result});return result;
}
export function routeContains(r:MapRoute,x:number,y:number) {
  const {pts,bounds:b}=routeGeometry(r),radius=r.sirka/2;
  if(x<b.minX-radius||x>b.maxX+radius||y<b.minY-radius||y>b.maxY+radius)return false;
  for(let i=1;i<pts.length;i++)if(routeDistance([x,y],pts[i-1],pts[i])<=radius)return true;
  return false;
}
const wallsCache=new WeakMap<MapRoute[],{base:MapWall[]|undefined;walls:MapWall[]}>();
export function mapWalls(map:MapV2):MapWall[] {
  if(!map.trasy?.length)return map.steny||[];
  const old=wallsCache.get(map.trasy);if(old && old.base===map.steny)return old.walls;
  const walls=[...(map.steny||[]),...map.trasy.flatMap(r=>routeGeometry(r).walls)];wallsCache.set(map.trasy,{base:map.steny,walls});return walls;
}
export const deckAt=(map:MapV2,x:number,y:number)=>map.trasy?.some(r=>r.druh==="molo"&&routeContains(r,x+.5,y+.5))??false;

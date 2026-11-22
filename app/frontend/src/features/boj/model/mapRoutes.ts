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
  const samples=r.druh==="molo"?sampleRoute(pts,.28):[];
  const planks=samples.slice(1).map((b,i)=>{
    const a=samples[i],angle=Math.atan2(b.y-a.y,b.x-a.x),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
    const jitter=routeRandom(seed,i+12000),offset=(jitter-.5)*.045,broken=i%19===Math.floor(routeRandom(seed,0)*19)?.12:0;
    const corners=[a,b].flatMap((p,j)=>[-1,1].map(side=>{
      const t=p.angle*Math.PI/180,reach=r.sirka/2+(side===1?-broken:0)+side*offset;
      return [p.x-Math.sin(t)*reach*side+Math.cos(angle)*(j?-.012:.012),p.y+Math.cos(t)*reach*side+Math.sin(angle)*(j?-.012:.012)] as RoutePoint;
    }));
    const local=corners.map(([px,py])=>[(py-y)*Math.cos(angle)-(px-x)*Math.sin(angle),-(px-x)*Math.cos(angle)-(py-y)*Math.sin(angle)]);
    return {x,y,angle:angle*180/Math.PI+90,v:Math.floor(routeRandom(seed,i)*4),tone:routeRandom(seed,i+18000)*.18,
      path:[corners[0],corners[1],corners[3],corners[2]].map(([x,y],j)=>`${j?"L":"M"}${x*24},${y*24}`).join(" ")+"Z",
      left:Math.min(...local.map(p=>p[0]))*24,top:Math.min(...local.map(p=>p[1]))*24,
      width:(Math.max(...local.map(p=>p[0]))-Math.min(...local.map(p=>p[0])))*24,
      height:(Math.max(...local.map(p=>p[1]))-Math.min(...local.map(p=>p[1])))*24};
  });
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const [x,y] of pts){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  return {pts,sprites,walls,bounds:{minX,minY,maxX,maxY},planks,path:pts.map(([x,y],i)=>`${i?"L":"M"}${x*24},${y*24}`).join(" ")};
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
export function deckCoversStep(map:MapV2,x:number,y:number,nx:number,ny:number) {
  const a:RoutePoint=[x+.5,y+.5],dx=nx-x,dy=ny-y,n=dx*dx+dy*dy,intervals:[number,number][]=[];
  if(!n)return deckAt(map,x,y);
  for(const r of map.trasy||[])if(r.druh==="molo"){
    const {pts}=routeGeometry(r),radius=r.sirka/2;
    for(let i=1;i<pts.length;i++){
      const p=pts[i-1],q=pts[i],length=Math.hypot(q[0]-p[0],q[1]-p[1]);
      for(const c of [p,q]){
        const px=a[0]-c[0],py=a[1]-c[1],b=px*dx+py*dy,disc=b*b-n*(px*px+py*py-radius*radius);
        if(disc>=0)intervals.push([Math.max(0,(-b-Math.sqrt(disc))/n),Math.min(1,(-b+Math.sqrt(disc))/n)]);
      }
      if(!length)continue;
      const ux=(q[0]-p[0])/length,uy=(q[1]-p[1])/length,px=a[0]-p[0],py=a[1]-p[1];
      let lo=0,hi=1;
      for(const [start,delta,min,max] of [[px*ux+py*uy,dx*ux+dy*uy,0,length],[-px*uy+py*ux,-dx*uy+dy*ux,-radius,radius]]){
        if(Math.abs(delta)<1e-10){if(start<min||start>max)hi=-1;}
        else{const t1=(min-start)/delta,t2=(max-start)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
      }
      if(lo<=hi)intervals.push([lo,hi]);
    }
  }
  let end=0;
  for(const [lo,hi] of intervals.filter(([lo,hi])=>lo<=hi).sort((a,b)=>a[0]-b[0])){
    if(lo>end+1e-8)return false;
    end=Math.max(end,hi);if(end>=1-1e-8)return true;
  }
  return false;
}

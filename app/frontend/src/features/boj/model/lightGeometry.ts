import { wallBlocksSight, type MapWall } from "./mapV2";

export type Point = [number, number];
export type LightSegment = {a: Point; b: Point; polygon?:Point[]};

export function pointInPolygon([x,y]:Point,polygon:Point[]):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [ax,ay]=polygon[i],[bx,by]=polygon[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}

export function lightBlockers(walls: MapWall[] = [], doors?: Record<string, boolean>): LightSegment[] {
  return walls.filter(w => w && wallBlocksSight(w,doors) && [...w.a,...w.b].every(Number.isFinite) && (w.a[0] !== w.b[0] || w.a[1] !== w.b[1]));
}

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

export function visibilityPolygon(origin: Point, blockers: LightSegment[], width: number, height: number): Point[] {
  if (![...origin,width,height].every(Number.isFinite) || width <= 0 || height <= 0) return [];
  const corners: Point[] = [[0,0],[width,0],[width,height],[0,height]];
  const segments = [...blockers.filter(s=>!s.polygon || !pointInPolygon(origin,s.polygon)),...corners.map((a,i) => ({a,b:corners[(i+1)%4]}))];
  const targets=new Map<string,Point>();
  const target=(p:Point)=>targets.set(p.map(n=>n.toFixed(9)).join(","),p);
  for(const s of segments){target(s.a);target(s.b);}
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    const a=segments[i],b=segments[j];
    const rx=a.b[0]-a.a[0],ry=a.b[1]-a.a[1],sx=b.b[0]-b.a[0],sy=b.b[1]-b.a[1];
    const denominator=cross(rx,ry,sx,sy);
    if(Math.abs(denominator)<1e-12)continue;
    const dx=b.a[0]-a.a[0],dy=b.a[1]-a.a[1];
    const t=cross(dx,dy,sx,sy)/denominator,u=cross(dx,dy,rx,ry)/denominator;
    if(t>=0 && t<=1 && u>=0 && u<=1)target([a.a[0]+t*rx,a.a[1]+t*ry]);
  }
  const angles = [...targets.values()].flatMap(([x,y]) => {
    const angle = Math.atan2(y-origin[1],x-origin[0]);
    return [angle-1e-7,angle,angle+1e-7];
  }).sort((a,b) => a-b);
  return angles.map(angle => {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let distance = Math.hypot(width,height) + Math.hypot(...origin) + 1;
    for (const {a,b} of segments) {
      const sx = b[0]-a[0], sy = b[1]-a[1], denominator = cross(dx,dy,sx,sy);
      if (Math.abs(denominator) < 1e-12) continue;
      const ax = a[0]-origin[0], ay = a[1]-origin[1];
      const t = cross(ax,ay,sx,sy)/denominator, u = cross(ax,ay,dx,dy)/denominator;
      if (t > 1e-8 && u >= -1e-9 && u <= 1+1e-9) distance = Math.min(distance,t);
    }
    return [origin[0]+dx*distance,origin[1]+dy*distance];
  });
}

export function conePath(radius: number, fullAngle: number): string {
  const angle = fullAngle * Math.PI / 360, x = Math.cos(angle)*radius, y = Math.sin(angle)*radius;
  return `M0,0 L${x},${-y} A${radius},${radius} 0 0 1 ${x},${y} Z`;
}

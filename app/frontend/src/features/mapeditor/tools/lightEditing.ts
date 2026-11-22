import { normalizeLight, type MapLightV2, type MapV2 } from "../../boj/model/mapV2";

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const angle=(n:number)=>(n%360+360)%360;
const round=(n:number)=>Math.round(n*100)/100;
const direction=(degrees:number,shift:boolean)=>angle(shift?Math.round(degrees/15)*15:round(degrees));
const finite=(n:number,fallback:number)=>Number.isFinite(n)?n:fallback;
const preset=(id:string,name:string,bright:number,dim:number,color:string,extra:Partial<MapLightV2>={})=>({
  id,name,light:normalizeLight({id:"placement",x:0,y:0,nazev:name,bright,dim,color,...extra}),
});
export const LIGHT_PRESETS=[
  preset("torch","Pochodeň",20,20,"#ffb45c",{efekt:"plamen"}),
  preset("candle","Svíčka",5,5,"#ffcf8a",{efekt:"mihot",intenzita:.75}),
  preset("campfire","Táborák",20,25,"#ff8b39",{efekt:"plamen",rychlost:.8}),
  preset("lantern","Lucerna",20,20,"#ffd79a",{efekt:"mihot"}),
  preset("hearth","Krb",15,20,"#ff9649",{tvar:"kuzel",sirka:150,efekt:"plamen"}),
  preset("crystal","Magický krystal",10,25,"#a99aff",{efekt:"magie",rychlost:.7}),
  preset("portal","Portál",10,30,"#70dfff",{efekt:"pulz",rychlost:.6}),
  preset("beacon","Reflektor / maják",30,50,"#fff0bd",{tvar:"kuzel",sirka:40}),
  preset("window","Světlo z okna",10,25,"#bddeff",{tvar:"kuzel",sirka:115,intenzita:.8}),
  preset("lava","Lávová puklina",5,15,"#ff702e",{tvar:"pruh",delka:6,efekt:"pulz",rychlost:.7}),
  preset("runes","Runová linie",5,10,"#8abfff",{tvar:"pruh",delka:5,efekt:"magie"}),
  preset("moon","Měsíční svit",0,80,"#adcfff",{intenzita:.45}),
];

export function applyLightPreset(light:MapLightV2,id:string):MapLightV2 {
  const p=LIGHT_PRESETS.find(p=>p.id===id);
  return p ? {...p.light,id:light.id,x:light.x,y:light.y} : light;
}

export function editedLight(light:MapLightV2,patch:Partial<MapLightV2>):MapLightV2 {
  const merged={...light,...patch};
  const next=normalizeLight({...merged,bright:clamp(finite(merged.bright,light.bright),0,500),dim:clamp(finite(merged.dim,light.dim),0,500)});
  const current=normalizeLight(light);
  return (Object.keys(next) as (keyof MapLightV2)[]).every(k=>next[k]===current[k]) ? light : next;
}

export function updateLight(map:MapV2,id:string,patch:Partial<MapLightV2>):boolean {
  const current=map.svetla?.find(l=>l.id===id);
  if(!current)return false;
  const next=editedLight(current,patch);
  if(next===current)return false;
  map.svetla=map.svetla!.map(l=>l.id===id?next:l);
  return true;
}

export type LightHandle="origin"|"direction"|"bright"|"dim"|"edge"|"end-a"|"end-b";
export const lightHandlesEnabled=(tool:string)=>tool==="select" || tool==="svetlo";
export const lightPlacementTab=<T extends string>(pinned:boolean,current:T):T|"vlastnosti"=>pinned?current:"vlastnosti";
type Point=[number,number];
export function lightHandlePoints(light:MapLightV2):{kind:LightHandle;point:Point;label:string}[] {
  const l=normalizeLight(light), r=(l.bright+l.dim)/5;
  const at=(degrees:number,distance:number):Point=>[l.x+Math.cos(degrees*Math.PI/180)*distance,l.y+Math.sin(degrees*Math.PI/180)*distance];
  const spread=l.tvar==="kuzel" ? l.sirka*.2 : 90;
  const points:{kind:LightHandle;point:Point;label:string}[]=[
    {kind:"origin",point:[l.x,l.y],label:"Přesunout světlo"},
    {kind:"bright",point:at(l.smer+spread,Math.max(.45,l.bright/5)),label:"Dosah jasného světla"},
    {kind:"dim",point:at(l.smer-spread,Math.max(.8,r)),label:"Celkový dosah světla"},
  ];
  if(l.tvar!=="bod")points.push({kind:"direction",point:at(l.smer,l.tvar==="pruh"?l.delka/2+1.2:Math.max(1.5,r*.55)),label:"Směr světla"});
  if(l.tvar==="kuzel")points.push({kind:"edge",point:at(l.smer+l.sirka/2,Math.max(1,r*.8)),label:"Šířka kužele"});
  if(l.tvar==="pruh")points.push({kind:"end-a",point:at(l.smer,l.delka/2),label:"První konec pruhu"},{kind:"end-b",point:at(l.smer+180,l.delka/2),label:"Druhý konec pruhu"});
  return points;
}

export function dragLightHandle(light:MapLightV2,kind:LightHandle,point:Point,shift=false,width=Infinity,height=Infinity):MapLightV2 {
  if(!point.every(Number.isFinite))return light;
  const l=normalizeLight(light), dx=point[0]-l.x,dy=point[1]-l.y;
  const degrees=angle(Math.atan2(dy,dx)*180/Math.PI), radians=l.smer*Math.PI/180;
  const distance=l.tvar==="pruh"?Math.abs(-dx*Math.sin(radians)+dy*Math.cos(radians)):Math.hypot(dx,dy);
  const feet=Math.round(distance*50)/10;
  if(kind==="origin")return editedLight(light,{x:round(clamp(point[0],0,Math.max(0,width-.01))),y:round(clamp(point[1],0,Math.max(0,height-.01)))});
  if(kind==="direction")return Math.hypot(dx,dy)<.01?light:editedLight(light,{smer:direction(degrees,shift)});
  if(kind==="bright")return editedLight(light,{bright:clamp(feet,0,500)});
  if(kind==="dim")return editedLight(light,{dim:clamp(feet-l.bright,0,500)});
  if(kind==="edge")return editedLight(light,{sirka:round(clamp(2*Math.abs((degrees-l.smer+540)%360-180),10,180))});
  return editedLight(light,{delka:round(clamp(2*Math.abs(dx*Math.cos(radians)+dy*Math.sin(radians)),.1,200))});
}

export function aimPlacedLight(light:MapLightV2,point:Point,shift=false):MapLightV2 {
  if(!point.every(Number.isFinite))return light;
  const dx=point[0]-light.x,dy=point[1]-light.y,distance=Math.hypot(dx,dy);
  if(distance<.15)return light;
  const degrees=angle(Math.atan2(dy,dx)*180/Math.PI);
  const l=normalizeLight(light), total=clamp(distance*5,0,500),ratio=l.bright+l.dim ? l.bright/(l.bright+l.dim) : 0;
  const bright=Math.round(total*ratio*10)/10;
  return editedLight(light,{smer:direction(degrees,shift),...(l.tvar==="pruh"?{delka:round(clamp(distance,.1,200))}:{bright,dim:Math.round((total-bright)*10)/10})});
}

export function lightRotationDelta(event:Pick<KeyboardEvent,"key"|"code"|"shiftKey"|"ctrlKey"|"metaKey"|"altKey">):number {
  if(event.ctrlKey||event.metaKey||event.altKey)return 0;
  const sign=event.key==="]"||event.code==="BracketRight"?1:event.key==="["||event.code==="BracketLeft"?-1:0;
  return sign*(event.shiftKey?1:15);
}

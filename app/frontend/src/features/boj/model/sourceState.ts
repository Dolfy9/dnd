import manifest from "../../../../../../11_Mapy/bojove/assets/assety.json";
import type {AssetEntry} from "../../mapeditor/assets/manifest";
import type {BattleMapData,LightSource,StavBoje} from "../types";
import type {MapObject,MapV2} from "./mapV2";

export const sourceAssets=Object.fromEntries((manifest.assety as AssetEntry[]).map(a=>[a.id,a]));
export const sourceOn=(source:{id:string;zap?:boolean},states?:Record<string,boolean>)=>states?.[source.id] ?? (source.zap!==false);
export const toggleable=(o:MapObject,a?:AssetEntry)=>!!(o.light || o.anim || a?.prepinatelny || a?.light || a?.anim || a?.srcVyp);

export function sourceMap<T extends BattleMapData>(map:T,states?:Record<string,boolean>):T {
  if(!states)return map;
  return {...map,objekty:map.objekty?.map(o=>({...o,zap:sourceOn(o,states)})),svetla:map.svetla?.map(l=>({...l,zap:sourceOn(l,states)}))};
}

export function objectLights(map:Pick<MapV2,"objekty">,assets:Record<string,AssetEntry>=sourceAssets) {
  return (map.objekty || []).filter(o=>!o.dmOnly && (o.light || assets[o.asset]?.light)).map(o=>({
    ...(o.light || assets[o.asset]?.light)!,id:o.id,x:o.x,y:o.y,zap:o.zap,asset:o.asset,anim:o.anim,nazev:assets[o.asset]?.nazev || o.asset,
  }));
}

export function mechanicalLights(S:StavBoje,map:BattleMapData):LightSource[] {
  const fromMap=[...(map.svetla || []),...objectLights(map)].map(l=>({...l,nazev:l.nazev || "Světlo",anchor:[l.x,l.y] as [number,number]}));
  const sources=new Map(fromMap.map(l=>[l.id,l as LightSource]));
  for(const l of S.lights || [])sources.set(l.id,{...sources.get(l.id),...l});
  return [...sources.values()].filter(l=>sourceOn(l,S.zdroje) && l.intenzita!==0);
}

export function toggleSources(map:MapV2,ids:Set<string>,assets:Record<string,AssetEntry>) {
  const objects=map.objekty?.filter(o=>ids.has(o.id) && toggleable(o,assets[o.asset])) || [];
  const lights=map.svetla?.filter(l=>ids.has(l.id)) || [];
  const zap=[...objects,...lights].some(o=>o.zap===false);
  objects.forEach(o=>{o.zap=zap;});lights.forEach(l=>{l.zap=zap;});
}

export function toggleBattleSource(S:StavBoje,map:BattleMapData,id:string,gm:boolean):string | undefined {
  if(!gm)return;
  const source=map.objekty?.find(o=>o.id===id && toggleable(o,sourceAssets[o.asset])) || map.svetla?.find(l=>l.id===id);
  if(!source)return;
  const zap=!sourceOn(source,S.zdroje);
  S.zdroje={...S.zdroje,[id]:zap};
  const name="asset" in source?sourceAssets[source.asset]?.nazev || source.asset:source.nazev || "Světlo";
  return `${name}: ${zap?"zapnuto":"vypnuto"}`;
}

export function sourceAt(map:BattleMapData,x:number,y:number,assets:Record<string,AssetEntry>=sourceAssets) {
  const object=[...(map.objekty || [])].reverse().find(o=>{
    if(!toggleable(o,assets[o.asset]))return false;
    const a=-(o.rot || 0)*Math.PI/180,dx=x-o.x,dy=y-o.y;
    return Math.abs(dx*Math.cos(a)-dy*Math.sin(a))<=o.w/2 && Math.abs(dx*Math.sin(a)+dy*Math.cos(a))<=o.h/2;
  });
  return object || map.svetla?.find(l=>Math.hypot(x-l.x,y-l.y)<.45);
}

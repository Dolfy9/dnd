import {useEffect,useState} from "react";
import type {MapRoute} from "../../boj/model/mapV2";
import {ROUTE_KINDS} from "../../boj/model/mapRoutes";
import {assetUrl,useTextureManifest} from "../assets/manifest";
import "./routeEditor.css";

export function RouteInspector({value,onChange,onDelete,onDeletePoint,point}:{value:MapRoute;onChange:(p:Partial<MapRoute>)=>void;onDelete?:()=>void;onDeletePoint?:()=>void;point?:number|null}) {
  const {data:textures={}}=useTextureManifest(),[width,setWidth]=useState(String(value.sirka));
  useEffect(()=>setWidth(String(value.sirka)),[value.sirka,value.id]);
  const commit=()=>{const n=Number(width);if(width.trim()&&Number.isFinite(n)){const sirka=Math.max(.25,Math.min(12,n));setWidth(String(sirka));if(sirka!==value.sirka)onChange({sirka});}else setWidth(String(value.sirka));};
  const choices=Object.values(textures).filter(t=>/dlaz|dlazb|kocici|hlina|kamen|pesin|cesta|sterk|zemina/.test(t.id));
  return <div className="me-route-inspector">
    <div className="me-inspector-heading"><small>TVAROVÁNÍ KRAJINY</small><h3>Trasa</h3></div>
    <div className="me-route-kinds" role="group" aria-label="Druh trasy">{ROUTE_KINDS.map(([k,label])=><button key={k} aria-pressed={value.druh===k} onClick={()=>onChange({druh:k,sirka:{cesta:1.5,molo:2,plot:1,zidka:.6}[k],...(k==="zidka"?{t:"t-pristavni-kamen"}:k==="cesta"?{t:"t-zahradni-cesta"}:{})})}><svg viewBox="0 0 70 32" aria-hidden="true"><path d="M5 25 Q24 1 37 16 T65 8" fill="none" stroke={k==="plot"?"#758150":k==="molo"?"#a08051":k==="zidka"?"#a6a99b":"#b9a880"} strokeWidth={k==="cesta"?9:6} strokeLinecap="round" strokeDasharray={k==="molo"?"3 1":undefined}/></svg><span>{label}</span></button>)}</div>
    <section><h4>Profil trasy</h4><label>Šířka (pole)<input aria-label="Šířka trasy" type="number" min=".25" max="12" step=".25" value={width} onChange={e=>setWidth(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/></label><label className="me-ctx-chk"><input type="checkbox" checked={value.hladke} onChange={e=>onChange({hladke:e.target.checked})}/> Plynulé oblouky</label>{value.druh==="zidka"&&<label className="me-ctx-chk"><input type="checkbox" checked={!!value.brectan} onChange={e=>onChange({brectan:e.target.checked})}/> Převislý břečťan</label>}</section>
    {(value.druh==="cesta"||value.druh==="zidka")&&<section><h4>Povrch</h4><div className="me-route-textures">{choices.map(t=><button key={t.id} title={t.nazev} aria-pressed={(value.t||"t-zahradni-cesta")===t.id} onClick={()=>onChange({t:t.id})}><img src={assetUrl(t.src)} alt=""/><span>{t.nazev}</span></button>)}</div></section>}
    <section><h4>Uzly a pravidla</h4><p>Klikáním přidávej body. Enter / dvojklik dokončí, Esc zruší, Backspace vrátí poslední bod.</p><p>Táhni za uzel. Alt + klik na úsek vloží nový. Vybraný uzel smaž tlačítkem nebo Delete. Alt při tažení vypne přichycení.</p><p>{value.druh==="plot"?"Blokuje pohyb i výhled a vrhá stín.":value.druh==="zidka"?"Poloviční kryt (+2 AC). Nepřekáží výhledu ani světlu, jako nízká stěna.":value.druh==="molo"?"Paluba přes vodu i propast je průchozí běžným krokem.":"Vizuální povrch; nemění pravidla terénu."}</p>{onDeletePoint&&<button className="me-btn" disabled={point==null||value.pts.length<=2} onClick={onDeletePoint}>Smazat vybraný uzel</button>}</section>
    {onDelete&&<button className="me-btn danger" onClick={onDelete}>Smazat trasu</button>}
  </div>;
}

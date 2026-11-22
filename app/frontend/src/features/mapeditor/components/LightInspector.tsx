import type { CSSProperties } from "react";
import { normalizeLight, type MapLightV2 } from "../../boj/model/mapV2";
import { applyLightPreset, LIGHT_PRESETS } from "../tools/lightEditing";
import "./lightEditor.css";

export function LightIcon({shape="bod",color="#f3c875",effect="zadny"}:{shape?:MapLightV2["tvar"];color?:string;effect?:MapLightV2["efekt"]}) {
  return <svg viewBox="0 0 64 44" aria-hidden="true" className={`me-light-icon me-light-preview-${effect}`} style={{"--light-preview-color":color} as CSSProperties}>
    <g fill={color}>
      {shape==="kuzel" ? <>{[.12,.18,.26,.5].map((opacity,i)=><path key={i} d={`M12 22 L53 ${4+i*4} Q62 22 53 ${40-i*4} Z`} opacity={opacity}/>)}</>
        : shape==="pruh" ? <>{[0,1,2,3].map(i=><rect key={i} x={8+i*2} y={9+i*3} width={48-i*4} height={26-i*6} rx={13-i*3} opacity={.12+i*.13}/>)}</>
        : <>{[18,13,8,3].map((r,i)=><circle key={r} cx="32" cy="22" r={r} opacity={.12+i*.2}/>)}</>}
    </g>
  </svg>;
}

export function LightShapePicker({value,onChange}:{value:MapLightV2;onChange:(changes:Partial<MapLightV2>)=>void}) {
  return <div className="me-light-shapes" role="group" aria-label="Tvar světla">{([["bod","Bod"],["kuzel","Kužel"],["pruh","Pruh"]] as const).map(([shape,label])=>
    <button type="button" key={shape} aria-pressed={(value.tvar || "bod")===shape} onClick={()=>onChange({tvar:shape})}><LightIcon shape={shape} color={value.color}/><span>{label}</span></button>
  )}</div>;
}

const EFFECTS=[["zadny","Žádný"],["mihot","Mihotání"],["plamen","Plamen"],["pulz","Pulz"],["magie","Magie"]] as const;
export function LightInspector({value,onChange,placement=false,onDelete}:{value:MapLightV2;onChange:(changes:Partial<MapLightV2>)=>void;placement?:boolean;onDelete?:()=>void}) {
  const l=normalizeLight(value);
  const number=(label:string,field:"bright"|"dim"|"smer"|"sirka"|"delka"|"rychlost"|"x"|"y",min:number,max:number,step=1)=>
    <label>{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={Math.round(l[field]*100)/100} onChange={e=>{if(e.target.value!=="")onChange({[field]:Math.max(min,Math.min(max,+e.target.value))});}}/></label>;
  return <div className="me-inspector me-light-inspector">
    <header className="me-inspector-header"><LightIcon shape={l.tvar} color={l.color}/><div><small>{placement?"Nové světlo":"Vybrané světlo"}</small><h3>{l.nazev || "Vlastní světlo"}</h3><span>{placement?"Klikni pro umístění · táhni pro namíření":"Tažením úchytů měň světlo přímo v mapě"}</span></div></header>
    {!placement && <div className="me-light-handle-key"><span>Poloha / směr</span><span>Jasné</span><span>Dosah / tvar</span></div>}
    <details className="me-section" open={placement}><summary>Předlohy světel <span>12</span></summary><div className="me-light-presets">{LIGHT_PRESETS.map(p=>{
      const selected=["bright","dim","color","tvar","efekt","delka","sirka","intenzita"].every(k=>l[k as keyof typeof l]===p.light[k as keyof typeof p.light]);
      return <button type="button" key={p.id} aria-label={`Předloha ${p.name}`} aria-pressed={selected} onClick={()=>onChange(applyLightPreset(l,p.id))}><LightIcon shape={p.light.tvar} color={p.light.color} effect={p.light.efekt}/><span>{p.name}</span><small>{p.light.bright} + {p.light.dim} ft</small></button>;
    })}</div></details>
    <details className="me-section" open><summary>Tvar a směr</summary><LightShapePicker value={l} onChange={onChange}/>
      {l.tvar!=="bod" && <><div className="me-light-direction"><input aria-label="Směr světla posuvník" type="range" min="0" max="359" value={l.smer} onChange={e=>onChange({smer:+e.target.value})}/>{number("Směr (°)","smer",0,360)}</div>
        <div className="me-light-quick">{[0,90,180,270].map(n=><button type="button" className="me-btn sm" key={n} onClick={()=>onChange({smer:n})}>{n}°</button>)}</div>
        {l.tvar==="pruh" && <div className="me-action-pair"><button type="button" className="me-btn" onClick={()=>onChange({smer:0})}>Vodorovně</button><button type="button" className="me-btn" onClick={()=>onChange({smer:90})}>Svisle</button></div>}
      </>}
      {l.tvar==="kuzel" && number("Šířka kužele (°)","sirka",10,180)}
      {l.tvar==="pruh" && number("Délka pruhu (pole)","delka",.1,200,.1)}
      {!placement && <div className="me-field-grid">{number("X světla","x",0,1000,.1)}{number("Y světla","y",0,1000,.1)}</div>}
    </details>
    <details className="me-section" open><summary>Dosah a barva</summary><div className="me-field-grid">{number("Jasné (ft)","bright",0,500)}{number("Přítmí navíc (ft)","dim",0,500)}</div>
      <p className="me-muted">Celkem {Math.round((l.bright+l.dim)*10)/10} ft · {Math.round((l.bright+l.dim)*2)/10} polí</p>
      <label>Barva světla<input aria-label="Barva světla" type="color" value={l.color || "#ffb85c"} onChange={e=>onChange({color:e.target.value})}/></label>
      <div className="me-light-colors">{["#ffb45c","#ff702e","#fff0bd","#bddeff","#a99aff","#70dfff"].map(c=><button type="button" key={c} aria-label={`Barva ${c}`} aria-pressed={l.color===c} style={{background:c}} onClick={()=>onChange({color:c})}/>)}</div>
      <label>Intenzita <output>{Math.round(l.intenzita*100)} %</output><input aria-label="Intenzita světla" type="range" min="0" max="1" step=".05" value={l.intenzita} onChange={e=>onChange({intenzita:+e.target.value})}/></label>
    </details>
    <details className="me-section" open><summary>Pohyb a stíny</summary><div className="me-light-effects" role="group" aria-label="Efekt světla">{EFFECTS.map(([effect,label])=><button type="button" key={effect} aria-pressed={l.efekt===effect} onClick={()=>onChange({efekt:effect,blikani:effect==="mihot"})}><LightIcon color={l.color} effect={effect}/><span>{label}</span></button>)}</div>
      <div className="me-light-direction"><input aria-label="Rychlost světla posuvník" type="range" min=".25" max="3" step=".05" value={l.rychlost} onChange={e=>onChange({rychlost:+e.target.value})}/>{number("Rychlost (×)","rychlost",.25,3,.05)}</div>
      <label className="me-switch"><input aria-label="Stíny světla" type="checkbox" checked={l.stiny} onChange={e=>onChange({stiny:e.target.checked})}/><span/>Stíny od zdí a zavřených dveří</label>
      <p className="me-muted">Animace respektují přepínač Animace a omezení pohybu.</p>
    </details>
    {!placement && <label className="me-light-name">Název světla<input aria-label="Název světla" value={l.nazev || ""} onChange={e=>onChange({nazev:e.target.value})}/></label>}
    {onDelete && <footer className="me-inspector-actions"><button type="button" className="me-btn danger" onClick={onDelete}>Smazat světlo</button></footer>}
  </div>;
}

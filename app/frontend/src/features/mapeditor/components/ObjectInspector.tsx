import React from "react";
import { Copy, Trash2, ArrowUp, ArrowDown, AlignHorizontalJustifyStart, AlignVerticalJustifyStart } from "lucide-react";
import type { MapV2, MapObject } from "../../boj/model/mapV2";
import { assetSrc, assetUrl, type AssetEntry } from "../assets/manifest";
import type { ObjectAction } from "../state/editorUx";
import { VariantStrip } from "./VariantStrip";

export function ObjectInspector({ objects, assets, push, onVariant, onAction, onDelete }: {
  objects: MapObject[]; assets: Record<string, AssetEntry>; push: (f: (m: MapV2) => void) => void;
  onVariant: (v: number | "next" | "random", asset?: string) => void; onAction: (action: ObjectAction) => void; onDelete: () => void;
}) {
  const first = objects[0], entry = assets[first.asset], ids = new Set(objects.map(o => o.id));
  const shared = <K extends keyof MapObject>(field: K): MapObject[K] | undefined => objects.every(o => o[field] === first[field]) ? first[field] : undefined;
  const edit = (changes: Partial<MapObject>) => { if (objects.every(o => Object.entries(changes).every(([key,v]) => JSON.stringify(o[key as keyof MapObject]) === JSON.stringify(v)))) return;
    push(m => { m.objekty = m.objekty?.map(o => ids.has(o.id) ? { ...o, ...changes } : o); }); };
  const check = (field: "flip" | "blocks" | "difficult" | "dmOnly", label: string) => <label className="me-switch"><input type="checkbox" checked={!!shared(field)} onChange={e => edit({[field]:e.target.checked})} /><span />{label}</label>;
  return <div className="me-inspector">
    <header className="me-inspector-header">{entry && <img src={assetUrl(assetSrc(entry,first.v))} alt="" />}<div><small>{objects.length > 1 ? "Hromadný výběr" : "Objekt"}</small><h3>{objects.length > 1 ? `${objects.length} vybraných objektů` : entry?.nazev || first.asset}</h3><span>{objects.length > 1 ? "Změny platí pro celý výběr" : `${first.w} × ${first.h} polí`}</span></div></header>
    <details className="me-section" open><summary>Umístění</summary><div className="me-field-grid">
      {([["x","X"],["y","Y"],["w","Šířka"],["h","Výška"],["rot","Úhel (°)"],["z","Pořadí"]] as const).map(([field,label]) => <label key={field}>{label}<input aria-label={field === "rot" ? "Úhel objektu" : label} type="number" step={field === "rot" || field === "z" ? 1 : .1} min={field === "w" || field === "h" ? .1 : undefined} value={shared(field) ?? ""} placeholder={objects.length > 1 ? "Různé" : "0"} onChange={e => { if (e.target.value !== "") edit({[field]:field === "w" || field === "h" ? Math.max(.1,+e.target.value) : +e.target.value}); }} /></label>)}
    </div><label className="me-angle-control"><span className="me-angle-dial" style={{ transform: `rotate(${shared("rot") || 0}deg)` }}>↑</span>Úhel<input aria-label="Otočení výběru" type="range" min="0" max="360" value={shared("rot") || 0} onChange={e => edit({rot:+e.target.value})} /><output>{shared("rot") ?? "—"}°</output></label>
      {check("flip","Překlopit vodorovně")}<div className="me-action-pair"><button className="me-btn" onClick={() => onAction("front")}><ArrowUp size={14} /> Dopředu</button><button className="me-btn" onClick={() => onAction("back")}><ArrowDown size={14} /> Dozadu</button></div>
      {objects.length > 1 && <div className="me-action-pair"><button className="me-btn" onClick={() => onAction("align-x")}><AlignHorizontalJustifyStart size={14} /> Zarovnat X</button><button className="me-btn" onClick={() => onAction("align-y")}><AlignVerticalJustifyStart size={14} /> Zarovnat Y</button></div>}
      <div className="me-action-pair"><button className="me-btn" onClick={() => onAction("rotate-left")}>↶ −15°</button><button className="me-btn" onClick={() => onAction("rotate-right")}>↷ +15°</button></div>
    </details>
    <details className="me-section" open><summary>Vzhled</summary>{[...new Set(objects.map(o => o.asset))].map(id => assets[id] && <div key={id} className="me-variant-section"><strong>{assets[id].nazev}</strong><VariantStrip entry={assets[id]} value={objects.find(o => o.asset === id)?.v} onChange={v => onVariant(v,id)} /></div>)}
      <div className="me-action-pair"><button className="me-btn" title="A" onClick={() => onVariant("next")}>Další <kbd>A</kbd></button><button className="me-btn" title="Shift+A" onClick={() => onVariant("random")}>Náhodně <kbd>⇧ A</kbd></button></div>
      <label>Odstín<input type="color" aria-label="Odstín objektu" value={shared("tint") || "#ffffff"} onChange={e => edit({tint:e.target.value})} /></label>
      <label>Animace<select aria-label="Animace objektu" value={shared("anim") === false ? "false" : shared("anim") || "auto"} onChange={e => edit({anim:e.target.value === "auto" ? undefined : e.target.value === "false" ? false : e.target.value as MapObject["anim"]})}>{[["auto","Automaticky"],["false","Bez pohybu"],["vitr","Vítr"],["portal","Portál"],["ohen","Oheň"],["zare","Záře"],["voda","Voda"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Vrhání stínů<select aria-label="Vrhání stínů" value={objects.every(o=>o.stin===first.stin)?String(first.stin ?? "auto"):"mixed"} onChange={e=>edit({stin:e.target.value==="auto"?undefined:e.target.value==="true"})}><option value="auto">Automaticky · pevné objekty a kryty</option><option value="true">Vždy vrhá stín</option><option value="false">Nevrhat stín</option>{!objects.every(o=>o.stin===first.stin) && <option value="mixed" disabled>Různé</option>}</select></label>
    </details>
    <details className="me-section"><summary>Mechanika</summary>{check("blocks","Blokuje pohyb")}{check("difficult","Těžký terén")}<label>Krytí<select aria-label="Krytí objektu" value={shared("cover") || 0} onChange={e => edit({cover:(+e.target.value || undefined) as MapObject["cover"]})}><option value="0">Bez krytu</option><option value="2">½ · poloviční</option><option value="3">¾ · tříčtvrteční</option></select></label></details>
    <details className="me-section"><summary>Světlo</summary><label className="me-switch"><input type="checkbox" checked={objects.every(o => !!o.light)} onChange={e => edit({light:e.target.checked ? {bright:10,dim:10} : undefined})} /><span />Vydává světlo</label>{objects.every(o => !!o.light) && <div className="me-field-grid">{(["bright","dim"] as const).map(f => <label key={f}>{f === "bright" ? "Jasné (ft)" : "Přítmí navíc (ft)"}<input type="number" min="0" value={first.light?.[f] || 0} onChange={e => push(m => { for (const o of m.objekty || []) if (ids.has(o.id) && o.light) o.light[f] = Math.max(0,+e.target.value); })} /></label>)}</div>}</details>
    <details className="me-section"><summary>Viditelnost</summary>{check("dmOnly","Jen pro vypravěče (DM)")}<p className="me-muted">Skryté objekty neuvidí hráči ani náhled hráče.</p></details>
    <footer className="me-inspector-actions"><button className="me-btn" onClick={() => onAction("duplicate")}><Copy size={15} /> Duplikovat</button><button className="me-btn danger" onClick={onDelete}><Trash2 size={15} /> Smazat</button></footer>
  </div>;
}

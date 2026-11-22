/* Pravé panely editoru: Vrstvy / Knihovna / Vlastnosti / Generátor / Mapa. */
import React from "react";
import { Layers, Library, Settings2, Wand2, Map as MapIcon, Upload, Download, FileUp, Trash2 } from "lucide-react";
import type { MapV2, MapWall, MapObject, MapLightV2, MapNote } from "../../boj/model/mapV2";
import { STAMPS, KATEGORIE, stampById, StampSvg, type StampDef } from "../assets/stamps";
import { TEXTURES } from "../assets/textures";
import { GENERATORS, type GenOut } from "../generators/generators";
import { assetUrl, useTextureManifest, type AssetEntry } from "../assets/manifest";

export function TexturePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data = {} } = useTextureManifest();
  const [query, setQuery] = React.useState("");
  const selected = data[value];
  const options = [...TEXTURES.filter(t => !data[t.id]), ...Object.values(data)].filter(t => t.nazev.toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs")));
  return <details className="me-texture-picker">
    <summary>{selected && <img src={assetUrl(selected.src)} alt="" />} {selected?.nazev || TEXTURES.find(t => t.id === value)?.nazev || value}</summary>
    <div className="me-lib-grid">
      <input className="me-texture-search" aria-label="Hledat texturu" placeholder="Hledat texturu…" value={query} onChange={e => setQuery(e.target.value)} />
      {options.map(t => <button type="button" key={t.id} className={value === t.id ? "on" : ""} title={t.nazev}
        onClick={e => { onChange(t.id); e.currentTarget.closest("details")?.removeAttribute("open"); }}>
        {data[t.id] ? <img src={assetUrl(data[t.id].src)} alt={t.nazev} loading="lazy" /> : t.nazev}
        <small>{t.nazev}</small>
      </button>)}
    </div>
  </details>;
}

const LIGHT_COLORS = [["#ffb85c", "Oheň"], ["#ffe6ad", "Svíčka"], ["#a9ceff", "Měsíc"], ["#7095ff", "Modrá"], ["#bd83ff", "Magie"], ["#72e9ae", "Zelená"], ["#ff7777", "Rudá"]] as const;
export function LightColors({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <div className="me-light-colors" role="group" aria-label="Barvy světla">
    {LIGHT_COLORS.map(([c, n]) => <button type="button" key={c} title={n} aria-label={n} aria-pressed={value === c}
      style={{ background: c }} onClick={() => onChange(c)} />)}
  </div>;
}

const ATMOSPHERES = [
  { n: "Den", amb: 1, barva: "#101522" }, { n: "Soumrak", amb: .55, barva: "#302038" },
  { n: "Noc", amb: .16, barva: "#090e24" }, { n: "Měsíc", amb: .32, barva: "#152d50" },
  { n: "Pochodně", amb: .12, barva: "#1e120c" }, { n: "Jeskyně", amb: .06, barva: "#080b12" },
  { n: "Magie", amb: .25, barva: "#281043" },
];

export const TABS = [["vrstvy", <Layers size={14} />, "Vrstvy"], ["knihovna", <Library size={14} />, "Knihovna"],
  ["vlastnosti", <Settings2 size={14} />, "Vlastnosti"], ["generator", <Wand2 size={14} />, "Generátor"],
  ["mapa", <MapIcon size={14} />, "Mapa"]] as const;
export type TabId = typeof TABS[number][0];
export const LAYERS: [string, string][] = [["obrazek", "Podklad"], ["textury", "Textury"], ["teren", "Terén"],
  ["malba", "Volná malba"], ["vyska", "Výška"], ["steny", "Stěny"], ["objekty", "Objekty"], ["kresby", "Kresby"], ["svetla", "Světla a atmosféra"],
  ["poznamky", "Poznámky"], ["mrizka", "Mřížka"], ["starty", "Starty"]];
export const WALL_TYPS: MapWall["typ"][] = ["wall", "door", "window", "secret", "half", "curtain"];
export const WALL_NAZVY: Record<string, string> = { wall: "Zeď", door: "Dveře", window: "Okno", secret: "Tajné", half: "Nízká", curtain: "Curtina" };

export function LayersPanel({ map, layerVis, setLayerVis }: {
  map: MapV2; layerVis: Record<string, boolean>; setLayerVis: (f: (s: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const counts: Record<string, number | string> = {
    steny: (map.steny || []).length, objekty: (map.objekty || []).length, kresby: (map.kresby || []).length,
    svetla: (map.svetla || []).length, poznamky: (map.poznamky || []).length, textury: Object.keys(map.textury || {}).length,
  };
  return (
    <ul className="me-layers">
      {LAYERS.map(([l, n]) => (
        <li key={l}>
          <button className={`me-eye ${layerVis[l] ? "on" : ""}`} onClick={() => setLayerVis((s) => ({ ...s, [l]: !s[l] }))} title={layerVis[l] ? "Skrýt" : "Zobrazit"}>👁</button>
          <span>{n}</span>
          <span className="me-layers-n">{counts[l] ?? ""}</span>
        </li>
      ))}
    </ul>
  );
}

export function LibraryPanel({ q, setQ, kat, setKat, stampId, onPick, ASSETS, onUpload }: {
  q: string; setQ: (v: string) => void; kat: string; setKat: (v: string) => void;
  stampId: string; onPick: (id: string) => void; ASSETS: Record<string, AssetEntry>;
  onUpload: (f: File) => void;
}) {
  const filtered = STAMPS.filter((s) => (!kat || s.kat === kat) && (!q || s.nazev.toLowerCase().includes(q.toLowerCase())));
  const extras = Object.values(ASSETS).filter((a) => !stampById(a.id) && (!q || a.nazev.toLowerCase().includes(q.toLowerCase())) && (!kat || (kat === "__custom" ? a.custom : a.kategorie === kat)));
  return (
    <div className="me-lib">
      <input placeholder="Hledat…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={kat} onChange={(e) => setKat(e.target.value)}>
        <option value="">Vše</option>
        {[...new Set([...KATEGORIE, ...Object.values(ASSETS).map(a => a.kategorie).filter((k): k is string => !!k)])].map((kk) => <option key={kk} value={kk}>{kk}</option>)}
        <option value="__custom">Vlastní</option>
      </select>
      <div className="me-lib-grid">
        {(kat === "__custom" ? [] : filtered).map((s) => {
          const man = ASSETS[s.id];
          return (
            <button key={s.id} className={`me-stamp ${stampId === s.id ? "on" : ""}`} title={`${s.nazev} (${s.w}×${s.h})`} onClick={() => onPick(s.id)}>
              {man ? <img src={assetUrl(man.src)} alt={s.nazev} loading="lazy" />
                   : <><svg viewBox="-13 -13 26 26"><StampSvg def={s} /></svg><span className="me-missing" title="Základní náhled — vygeneruj obrázek pomocí tools/mapa_assety.py">náhled</span></>}
            </button>
          );
        })}
        {extras.map((a) => (
          <button key={a.id} className={`me-stamp ${stampId === a.id ? "on" : ""}`} title={a.nazev} onClick={() => onPick(a.id)}>
            <img src={assetUrl(a.src)} alt={a.nazev} loading="lazy" />
          </button>
        ))}
      </div>
      <label className="me-btn sm"><Upload size={14} /> Nahrát obrázek
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} /></label>
    </div>
  );
}

export function PropertiesPanel({ map, selObj, push, onDelete }: {
  map: MapV2; selObj: { kind: string; id: string } | null;
  push: (f: (m: MapV2) => void) => void; onDelete: () => void;
}) {
  if (!selObj) return <p className="me-none">Vyber objekt / zeď / světlo / poznámku nástrojem Výběr.</p>;
  const selObject = selObj.kind === "objekt" ? (map.objekty || []).find((o) => o.id === selObj.id) : null;
  const selWall = selObj.kind === "stena" ? (map.steny || []).find((w) => w.id === selObj.id) : null;
  const selLight = selObj.kind === "svetlo" ? (map.svetla || []).find((l) => l.id === selObj.id) : null;
  const selNote = selObj.kind === "poznamka" ? (map.poznamky || []).find((n) => n.id === selObj.id) : null;
  return (
    <div className="me-props">
      {selObject && (
        <>
          <h4>Objekt — {stampById(selObject.asset)?.nazev || selObject.asset}</h4>
          {(["x", "y", "w", "h", "rot", "z"] as const).map((f) => (
            <label key={f}>{{x:"Poloha X",y:"Poloha Y",w:"Šířka",h:"Výška",rot:"Úhel (°)",z:"Pořadí"}[f]}<input aria-label={f === "rot" ? "Úhel objektu" : f} type="number" step={f === "rot" ? 1 : .1} value={(selObject as any)[f] ?? 0}
              onChange={(e) => push((m) => { const o = m.objekty!.find((o) => o.id === selObj.id)!; (o as any)[f] = +e.target.value; })} /></label>))}
          <label>tint<input type="color" value={selObject.tint || "#ffffff"} onChange={(e) => push((m) => { m.objekty!.find((o) => o.id === selObj.id)!.tint = e.target.value; })} /></label>
          {(["blocks", "difficult", "flip", "dmOnly"] as const).map((f) => (
            <label key={f} className="me-ctx-chk"><input type="checkbox" checked={!!selObject[f]}
              onChange={(e) => push((m) => { (m.objekty!.find((o) => o.id === selObj.id) as any)[f] = e.target.checked; })} /> {f}</label>))}
          <label>cover<select value={selObject.cover || 0} onChange={(e) => push((m) => { const o = m.objekty!.find((o) => o.id === selObj.id)!; o.cover = (+e.target.value || undefined) as any; })}>
            <option value={0}>žádné</option><option value={2}>half</option><option value={3}>¾</option></select></label>
          <label className="me-ctx-chk"><input type="checkbox" checked={!!selObject.light}
            onChange={(e) => push((m) => { const o = m.objekty!.find((o) => o.id === selObj.id)!; o.light = e.target.checked ? { bright: 10, dim: 10 } : undefined; })} /> světlo</label>
        </>
      )}
      {selWall && (
        <>
          <h4>Zeď</h4>
          <label>typ<select value={selWall.typ} onChange={(e) => push((m) => { m.steny!.find((w) => w.id === selObj.id)!.typ = e.target.value as any; })}>
            {WALL_TYPS.map((t) => <option key={t} value={t}>{WALL_NAZVY[t]}</option>)}</select></label>
          <label className="me-ctx-chk"><input type="checkbox" checked={!!selWall.open} onChange={(e) => push((m) => { m.steny!.find((w) => w.id === selObj.id)!.open = e.target.checked; })} /> otevřené</label>
          <label className="me-ctx-chk"><input type="checkbox" checked={!!selWall.locked} onChange={(e) => push((m) => { m.steny!.find((w) => w.id === selObj.id)!.locked = e.target.checked; })} /> zamčené</label>
        </>
      )}
      {selLight && (
        <>
          <h4>Světlo</h4>
          <label>Jasné (ft)<input type="number" min="0" value={selLight.bright} onChange={(e) => push((m) => { m.svetla!.find((l) => l.id === selObj.id)!.bright = Math.max(0, +e.target.value); })} /></label>
          <label>Přítmí navíc (ft)<input type="number" min="0" value={selLight.dim} onChange={(e) => push((m) => { m.svetla!.find((l) => l.id === selObj.id)!.dim = Math.max(0, +e.target.value); })} /></label>
          <LightColors value={selLight.color || "#fbbf24"} onChange={v => push(m => { m.svetla!.find(l => l.id === selObj.id)!.color = v; })} />
          <label>barva<input type="color" value={selLight.color || "#fbbf24"} onChange={(e) => push((m) => { m.svetla!.find((l) => l.id === selObj.id)!.color = e.target.value; })} /></label>
          <label>Intenzita<input type="range" min="0" max="1" step=".05" value={selLight.intenzita ?? 1} onChange={e => push(m => { m.svetla!.find(l => l.id === selObj.id)!.intenzita = +e.target.value; })} /></label>
          <label><input type="checkbox" checked={!!selLight.blikani} onChange={e => push(m => { m.svetla!.find(l => l.id === selObj.id)!.blikani = e.target.checked; })} /> Blikání</label>
        </>
      )}
      {selNote && (
        <>
          <h4>Poznámka DM</h4>
          <textarea value={selNote.text} onChange={(e) => push((m) => { m.poznamky!.find((n) => n.id === selObj.id)!.text = e.target.value; })} />
        </>
      )}
      <button className="me-btn danger sm" onClick={onDelete}><Trash2 size={13} /> Smazat</button>
    </div>
  );
}

export function GeneratorPanel({ genId, setGenId, seed, setSeed, onPreview, genPrev, onApply, onDiscard }: {
  genId: string; setGenId: (v: string) => void; seed: number; setSeed: (v: number) => void;
  onPreview: () => void; genPrev: GenOut | null; onApply: () => void; onDiscard: () => void;
}) {
  return (
    <div className="me-gen">
      <label>Typ<select value={genId} onChange={(e) => setGenId(e.target.value)}>
        {GENERATORS.map((g) => <option key={g.id} value={g.id}>{g.nazev}</option>)}</select></label>
      <label>Seed<input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} /></label>
      <button className="me-btn" onClick={onPreview}><Wand2 size={14} /> Náhled do mapy</button>
      {genPrev && (
        <>
          <p className="me-ctx-hint">Duch náhledu je přes mapu (jantar). {genPrev.steny.length} zdí.</p>
          <button className="me-btn primary" onClick={onApply}>Aplikovat</button>
          <button className="me-btn ghost" onClick={onDiscard}>Zahodit</button>
        </>
      )}
    </div>
  );
}

export function MapPanel({ map, push, onResize, onUploadImg, onImportUvtt, onExportUvtt, onExportJson, onImportJson, onExportPng, calib, setCalib }: {
  map: MapV2; push: (f: (m: MapV2) => void) => void;
  onResize: (dW: number, dH: number, dX: number, dY: number) => void;
  onUploadImg: (f: File) => void; onImportUvtt: (f: File) => void;
  onExportUvtt: () => void; onExportJson: () => void; onImportJson: (f: File) => void; onExportPng: () => void;
  calib: { step: 0 | 1 | 2; pts: [number, number][]; cells: number } | null;
  setCalib: (v: { step: 0 | 1 | 2; pts: [number, number][]; cells: number } | null) => void;
}) {
  const W = map.mrizka[0]?.length || 1, H = map.mrizka.length;
  return (
    <div className="me-mapmeta">
      <h4>Atmosféra</h4>
      <div className="me-atmo-presets">
        {ATMOSPHERES.map(a => <button key={a.n} type="button" aria-pressed={(map.atmosfera?.amb ?? 1) === a.amb && (map.atmosfera?.barva || "#101522") === a.barva}
          onClick={() => push(m => { m.atmosfera = { amb: a.amb, barva: a.barva }; })}>
          <span style={{ backgroundImage: "url(/repo/11_Mapy/bojove/textury/teren-les.webp)" }}>
            <i style={{ background: a.barva, opacity: 1 - a.amb }} />
          </span>{a.n}
        </button>)}
      </div>
      <label>Okolní světlo {Math.round((map.atmosfera?.amb ?? 1) * 100)} %
        <input aria-label="Okolní světlo" type="range" min="0" max="1" step=".01" value={map.atmosfera?.amb ?? 1}
          onChange={e => push(m => { m.atmosfera = { barva: m.atmosfera?.barva || "#101522", amb: +e.target.value }; })} />
      </label>
      <label>Odstín prostředí<input aria-label="Odstín prostředí" type="color" value={map.atmosfera?.barva || "#101522"}
        onChange={e => push(m => { m.atmosfera = { amb: m.atmosfera?.amb ?? 1, barva: e.target.value }; })} /></label>
      <label>Místo<input value={map.misto || ""} onChange={(e) => push((m) => { m.misto = e.target.value; })} /></label>
      <label>Osvětlení<input value={map.osvetleni || ""} onChange={(e) => push((m) => { m.osvetleni = e.target.value; })} /></label>
      <label>Popis<textarea value={map.popis || ""} onChange={(e) => push((m) => { m.popis = e.target.value; })} /></label>
      <h4>Rozměr {W}×{H}</h4>
      <div className="me-resize">
        <button className="me-btn sm" onClick={() => onResize(0, 0, 1, 0)}>← +</button>
        <button className="me-btn sm" onClick={() => onResize(0, 0, -1, 0)}>← −</button>
        <button className="me-btn sm" onClick={() => onResize(1, 0, 0, 0)}>+ →</button>
        <button className="me-btn sm" onClick={() => onResize(-1, 0, 0, 0)}>− →</button>
        <button className="me-btn sm" onClick={() => onResize(0, 0, 0, 1)}>↑ +</button>
        <button className="me-btn sm" onClick={() => onResize(0, 0, 0, -1)}>↑ −</button>
        <button className="me-btn sm" onClick={() => onResize(0, 1, 0, 0)}>+ ↓</button>
        <button className="me-btn sm" onClick={() => onResize(0, -1, 0, 0)}>− ↓</button>
      </div>
      <h4>Podkladový obrázek</h4>
      <label className="me-btn sm"><Upload size={14} /> Nahrát<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUploadImg(e.target.files[0])} /></label>
      {map.obrazek && <>
        <label>cellPx<input type="number" value={map.kalibrace?.cellPx || 150} onChange={(e) => push((m) => { m.kalibrace = { ...(m.kalibrace || { offX: 0, offY: 0 }), cellPx: +e.target.value }; })} /></label>
        <label>offsetX<input type="number" value={map.kalibrace?.offX || 0} onChange={(e) => push((m) => { m.kalibrace = { ...(m.kalibrace || { cellPx: 150, offY: 0 }), offX: +e.target.value }; })} /></label>
        <label>offsetY<input type="number" value={map.kalibrace?.offY || 0} onChange={(e) => push((m) => { m.kalibrace = { ...(m.kalibrace || { cellPx: 150, offX: 0 }), offY: +e.target.value }; })} /></label>
        <button className={`me-btn sm ${calib ? "on" : ""}`} onClick={() => setCalib(calib ? null : { step: 1, pts: [], cells: 4 })}>
          Kalibrovat 2 body</button>
        {calib && <p className="me-ctx-hint">Klikni 2 protilehlé rohy mřížky na obrázku, pak zadej počet buněk mezi nimi.</p>}
      </>}
      <h4>Mřížka</h4>
      <label>typ<select value={map.mrizkaStyl?.typ || "lines"} onChange={(e) => push((m) => { m.mrizkaStyl = { ...(m.mrizkaStyl || { barva: "#000000", opacita: .18 }), typ: e.target.value as any }; })}>
        <option value="lines">čáry</option><option value="dots">tečky</option><option value="none">žádná</option></select></label>
      <label>barva<input type="color" value={map.mrizkaStyl?.barva || "#000000"} onChange={(e) => push((m) => { m.mrizkaStyl = { ...(m.mrizkaStyl || { typ: "lines", opacita: .18 }), barva: e.target.value }; })} /></label>
      <label>krytí<input type="range" min={0} max={.6} step={.02} value={map.mrizkaStyl?.opacita ?? .18} onChange={(e) => push((m) => { m.mrizkaStyl = { ...(m.mrizkaStyl || { typ: "lines", barva: "#000000" }), opacita: +e.target.value }; })} /></label>
      <h4>Import / export</h4>
      <label className="me-btn sm"><FileUp size={14} /> UVTT import<input type="file" accept=".uvtt,.dd2vtt,.df2vtt,.json" hidden onChange={(e) => e.target.files?.[0] && onImportUvtt(e.target.files[0])} /></label>
      <button className="me-btn sm" onClick={onExportUvtt}><Download size={14} /> UVTT export</button>
      <button className="me-btn sm" onClick={onExportJson}><Download size={14} /> JSON export</button>
      <label className="me-btn sm"><FileUp size={14} /> JSON import<input type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportJson(f); }} /></label>
      <button className="me-btn sm" onClick={onExportPng}><Download size={14} /> PNG export</button>
    </div>
  );
}

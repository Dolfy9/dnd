/* Pravé panely editoru: Vrstvy / Knihovna / Vlastnosti / Generátor / Mapa. */
import React from "react";
import { Layers, Library, Settings2, Wand2, Map as MapIcon, Upload, Download, FileUp, Trash2, Eye, EyeOff, MousePointer2 } from "lucide-react";
import type { MapV2, MapWall, MapObject, MapLightV2, MapNote } from "../../boj/model/mapV2";
import { TEXTURES } from "../assets/textures";
import { GENERATORS, type GenOut } from "../generators/generators";
import { assetUrl, useTextureManifest, type AssetEntry } from "../assets/manifest";
import { EditorWeather as WeatherPicker } from "./EditorChrome";
import { ObjectInspector } from "./ObjectInspector";
import { LightInspector } from "./LightInspector";
import { editedLight, updateLight } from "../tools/lightEditing";
import type { ObjectAction } from "../state/editorUx";
export { AssetLibrary as LibraryPanel } from "./AssetLibrary";
import { MapPreview } from "./MapPreview";
import { TILES } from "../../boj/types";
import { terrainTexture, terrainProp } from "../../boj/model/terrainArt";
import { useMapManifests, MapGridLayer } from "../../boj/components/MapV2Layers";

export function TilePicker({ value, onChange, ground }: { value: string; onChange: (v: string) => void; ground: string }) {
  const { textures, assets } = useMapManifests();
  const [query, setQuery] = React.useState("");
  return <details className="me-texture-picker"><summary>Terén · {TILES[value]?.nazev}</summary><div className="me-visual-grid me-tile-cards">
    <input placeholder="Hledat terén…" value={query} onChange={e => setQuery(e.target.value)} />
    {Object.entries(TILES).filter(([,d]) => d.nazev.toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs"))).map(([c,d]) => {
      const tex = textures[terrainTexture(c, ground)], prop = assets["gen2-"+terrainProp(c,ground,0,0)];
      return <button key={c} aria-pressed={c === value} onClick={e => { onChange(c); e.currentTarget.closest("details")?.removeAttribute("open"); }}>
        <span style={{ backgroundImage: tex ? `url(${assetUrl(tex.src)})` : undefined }}>{prop && <img src={assetUrl(prop.src)} alt="" />}</span>{d.nazev}
      </button>;
    })}
  </div></details>;
}
export function WallPicker({ value, onChange }: { value: MapWall["typ"]; onChange: (v: MapWall["typ"]) => void }) {
  return <div className="me-visual-grid me-wall-cards">{WALL_TYPS.map(typ => <button key={typ} aria-pressed={value === typ} onClick={() => onChange(typ)}>
    <svg viewBox="0 0 70 24" aria-hidden="true"><path d="M4 12H66" stroke={typ === "door" ? "#8d5430" : "#60533d"} strokeWidth={typ === "half" ? 3 : 6} strokeDasharray={typ === "window" ? "8 5" : typ === "curtain" ? "2 3" : undefined} />
      {typ === "door" && <image href="/repo/11_Mapy/bojove/ikony/plus.webp" x="27" y="3" width="18" height="18" />}
      {typ === "secret" && <text x="35" y="17" textAnchor="middle" fill="#e9dcbf" fontSize="14">?</text>}</svg>{WALL_NAZVY[typ]}
  </button>)}</div>;
}

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

export const TABS = [["knihovna", <Library size={16} />, "Knihovna"], ["vlastnosti", <Settings2 size={16} />, "Vlastnosti"],
  ["vrstvy", <Layers size={16} />, "Vrstvy"], ["mapa", <MapIcon size={16} />, "Mapa"], ["generator", <Wand2 size={16} />, "Generátor"]] as const;
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
    <><h3>Vrstvy mapy</h3><div className="me-action-pair"><button className="me-btn" onClick={() => setLayerVis(() => Object.fromEntries(LAYERS.map(([l]) => [l,true])))}><Eye size={15} /> Zobrazit vše</button><button className="me-btn" onClick={() => setLayerVis(() => Object.fromEntries(LAYERS.map(([l]) => [l,false])))}><EyeOff size={15} /> Skrýt vše</button></div><ul className="me-layers">
      {LAYERS.map(([l, n]) => (
        <li key={l}>
          <button className={`me-eye ${layerVis[l] ? "on" : ""}`} aria-label={`${layerVis[l] ? "Skrýt" : "Zobrazit"} ${n}`} aria-pressed={layerVis[l]} onClick={() => setLayerVis((s) => ({ ...s, [l]: !s[l] }))}>{layerVis[l] ? <Eye size={16} /> : <EyeOff size={16} />}</button>
          <span>{n}</span>
          <span className="me-layers-n">{counts[l] ?? ""}</span>
        </li>
      ))}
    </ul></>
  );
}

export function PropertiesPanel({ map, selObj, push, onDelete, objects, assets, onVariant, onAction }: {
  map: MapV2; selObj: { kind: string; id: string } | null;
  push: (f: (m: MapV2) => void) => void; onDelete: () => void;
  objects: MapObject[]; assets: Record<string, AssetEntry>;
  onVariant: (action: number | "next" | "random", asset?: string) => void;
  onAction: (action: ObjectAction) => void;
}) {
  if (objects.length) return <ObjectInspector objects={objects} assets={assets} push={push} onVariant={onVariant} onAction={onAction} onDelete={() => onAction("delete")} />;
  if (!selObj) return <div className="me-empty"><MousePointer2 size={36} /><h3>Všechno začíná výběrem</h3><p>Klikni na objekt, stěnu, světlo nebo poznámku v mapě.</p><p><kbd>V</kbd> Výběr a přesun<br /><kbd>Shift + klik</kbd> Přidat do výběru<br /><kbd>Táhni</kbd> Vybrat více prvků</p></div>;
  const selWall = selObj.kind === "stena" ? (map.steny || []).find((w) => w.id === selObj.id) : null;
  const selLight = selObj.kind === "svetlo" ? (map.svetla || []).find((l) => l.id === selObj.id) : null;
  const selNote = selObj.kind === "poznamka" ? (map.poznamky || []).find((n) => n.id === selObj.id) : null;
  if (selLight) return <LightInspector value={selLight} onChange={patch=>{
    if(editedLight(selLight,patch)!==selLight) push(m=>{updateLight(m,selLight.id,patch);});
  }} onDelete={onDelete}/>;
  return (
    <div className="me-props">
      {selWall && (
        <>
          <h4>Zeď</h4>
          <WallPicker value={selWall.typ} onChange={typ => push(m => { m.steny!.find(w => w.id === selObj.id)!.typ = typ; })} />
          <label className="me-ctx-chk"><input type="checkbox" checked={!!selWall.open} onChange={(e) => push((m) => { m.steny!.find((w) => w.id === selObj.id)!.open = e.target.checked; })} /> otevřené</label>
          <label className="me-ctx-chk"><input type="checkbox" checked={!!selWall.locked} onChange={(e) => push((m) => { m.steny!.find((w) => w.id === selObj.id)!.locked = e.target.checked; })} /> zamčené</label>
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
  const previews = React.useMemo(() => GENERATORS.map(g => ({ ...g, map: { id: g.id, nazev: g.nazev,
    podklad: g.id === "cave" ? "jeskyne" : g.id === "outdoor" ? "les" : "krypta", ...g.fn(24, 18, seed) } as MapV2 })), [seed]);
  return (
    <div className="me-gen">
      <div className="me-visual-grid me-generator-cards">{previews.map(g => <button key={g.id} aria-pressed={genId === g.id} onClick={() => setGenId(g.id)}>
        <MapPreview map={g.map} />{g.nazev}</button>)}</div>
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
      <details className="me-section"><summary>Rozměry a mřížka · {W} × {H}</summary>
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
      <div className="me-visual-grid">{(["lines", "dots", "none"] as const).map(typ => <button key={typ} aria-pressed={(map.mrizkaStyl?.typ || "lines") === typ}
        onClick={() => push(m => { m.mrizkaStyl = { ...(m.mrizkaStyl || { barva: "#000000", opacita: .18 }), typ }; })}>
        <svg viewBox="0 0 96 48" style={{ background: "url(/repo/11_Mapy/bojove/textury/teren-les.webp) center/cover" }}>
          <MapGridLayer map={{ ...map, mrizkaStyl: { typ, barva: "#ffffff", opacita: .8 } }} W={4} H={2} />
        </svg>{{lines:"Čáry",dots:"Tečky",none:"Bez mřížky"}[typ]}</button>)}</div>
      <label>barva<input type="color" value={map.mrizkaStyl?.barva || "#000000"} onChange={(e) => push((m) => { m.mrizkaStyl = { ...(m.mrizkaStyl || { typ: "lines", opacita: .18 }), barva: e.target.value }; })} /></label>
      <label>krytí<input type="range" min={0} max={.6} step={.02} value={map.mrizkaStyl?.opacita ?? .18} onChange={(e) => push((m) => { m.mrizkaStyl = { ...(m.mrizkaStyl || { typ: "lines", barva: "#000000" }), opacita: +e.target.value }; })} /></label>
      </details>
      <WeatherPicker map={map} value={map.pocasi} onChange={value => push(m => { m.pocasi = value; })} />
      <details className="me-section" open><summary>Atmosféra a světlo</summary>
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
      </details>
      <details className="me-section"><summary>Popis a místo</summary>
      <label>Místo<input value={map.misto || ""} onChange={(e) => push((m) => { m.misto = e.target.value; })} /></label>
      <label>Osvětlení<input value={map.osvetleni || ""} onChange={(e) => push((m) => { m.osvetleni = e.target.value; })} /></label>
      <label>Popis<textarea value={map.popis || ""} onChange={(e) => push((m) => { m.popis = e.target.value; })} /></label>
      </details>
      <details className="me-section"><summary>Podklad / import / export</summary>
      <label className="me-btn sm"><Upload size={14} /> Nahrát<input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUploadImg(e.target.files[0])} /></label>
      {map.obrazek && <>
        <label>cellPx<input type="number" value={map.kalibrace?.cellPx || 150} onChange={(e) => push((m) => { m.kalibrace = { ...(m.kalibrace || { offX: 0, offY: 0 }), cellPx: +e.target.value }; })} /></label>
        <label>offsetX<input type="number" value={map.kalibrace?.offX || 0} onChange={(e) => push((m) => { m.kalibrace = { ...(m.kalibrace || { cellPx: 150, offY: 0 }), offX: +e.target.value }; })} /></label>
        <label>offsetY<input type="number" value={map.kalibrace?.offY || 0} onChange={(e) => push((m) => { m.kalibrace = { ...(m.kalibrace || { cellPx: 150, offX: 0 }), offY: +e.target.value }; })} /></label>
        <button className={`me-btn sm ${calib ? "on" : ""}`} onClick={() => setCalib(calib ? null : { step: 1, pts: [], cells: 4 })}>
          Kalibrovat 2 body</button>
        {calib && <p className="me-ctx-hint">Klikni 2 protilehlé rohy mřížky na obrázku, pak zadej počet buněk mezi nimi.</p>}
      </>}
      <label className="me-btn sm"><FileUp size={14} /> UVTT import<input type="file" accept=".uvtt,.dd2vtt,.df2vtt,.json" hidden onChange={(e) => e.target.files?.[0] && onImportUvtt(e.target.files[0])} /></label>
      <button className="me-btn sm" onClick={onExportUvtt}><Download size={14} /> UVTT export</button>
      <button className="me-btn sm" onClick={onExportJson}><Download size={14} /> JSON export</button>
      <label className="me-btn sm"><FileUp size={14} /> JSON import<input type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportJson(f); }} /></label>
      <button className="me-btn sm" onClick={onExportPng}><Download size={14} /> PNG export</button>
      </details>
    </div>
  );
}

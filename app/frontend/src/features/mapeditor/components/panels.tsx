/* Pravé panely editoru: Vrstvy / Knihovna / Vlastnosti / Generátor / Mapa. */
import React from "react";
import { Layers, Library, Settings2, Wand2, Map as MapIcon, Upload, Download, FileUp, Trash2 } from "lucide-react";
import type { MapV2, MapWall, MapObject, MapLightV2, MapNote } from "../../boj/model/mapV2";
import { STAMPS, KATEGORIE, stampById, StampSvg, type StampDef } from "../assets/stamps";
import { TEXTURES } from "../assets/textures";
import { GENERATORS, type GenOut } from "../generators/generators";
import { assetUrl, assetSrc, useTextureManifest, type AssetEntry } from "../assets/manifest";
import { VariantStrip } from "./VariantStrip";
import { WeatherPicker } from "../../boj/components/MapMotion";
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

export function LibraryPanel({ q, setQ, kat, setKat, stampId, onPick, ASSETS, onUpload, variant, onVariant }: {
  q: string; setQ: (v: string) => void; kat: string; setKat: (v: string) => void;
  stampId: string; onPick: (id: string) => void; ASSETS: Record<string, AssetEntry>;
  onUpload: (f: File) => void;
  variant: number; onVariant: (value: number) => void;
}) {
  const filtered = STAMPS.filter((s) => (!kat || s.kat === kat) && (!q || s.nazev.toLowerCase().includes(q.toLowerCase())));
  const extras = Object.values(ASSETS).filter((a) => !stampById(a.id) && (!q || a.nazev.toLowerCase().includes(q.toLowerCase())) && (!kat || (kat === "__custom" ? a.custom : a.kategorie === kat)));
  return (
    <div className="me-lib">
      <input placeholder="Hledat…" value={q} onChange={(e) => setQ(e.target.value)} />
      {ASSETS[stampId] && <section className="me-variant-section"><strong>{ASSETS[stampId].nazev} · varianty</strong>
        <VariantStrip entry={ASSETS[stampId]} value={variant} onChange={onVariant} />
      </section>}
      <div className="me-category-chips" aria-label="Kategorie knihovny">
        {["", ...new Set([...KATEGORIE, ...Object.values(ASSETS).map(a => a.kategorie).filter((k): k is string => !!k)]), "__custom"].map(kk => {
          const rep = Object.values(ASSETS).find(a => !kk || (kk === "__custom" ? a.custom : a.kategorie === kk));
          return <button key={kk} aria-pressed={kat === kk} onClick={() => setKat(kk)}>
            <img src={rep ? assetUrl(assetSrc(rep)) : "/repo/11_Mapy/bojove/ikony/plus.webp"} alt="" />{kk === "" ? "Vše" : kk === "__custom" ? "Vlastní" : kk}
          </button>;
        })}
      </div>
      <div className="me-lib-grid">
        {(kat === "__custom" ? [] : filtered).map((s) => {
          const man = ASSETS[s.id];
          return (
            <button key={s.id} className={`me-stamp ${stampId === s.id ? "on" : ""}`} title={`${s.nazev} (${s.w}×${s.h})`} onClick={() => onPick(s.id)}>
              {man ? <img src={assetUrl(assetSrc(man, s.id === stampId ? variant : 0))} alt={s.nazev} loading="lazy" />
                   : <><svg viewBox="-13 -13 26 26"><StampSvg def={s} /></svg><span className="me-missing" title="Základní náhled — vygeneruj obrázek pomocí tools/mapa_assety.py">náhled</span></>}
              {!!man?.varianty?.length && <small className="me-variant-count" title={"Základ + " + man.varianty.length + " varianty"}>+{man.varianty.length}</small>}
            </button>
          );
        })}
        {extras.map((a) => (
          <button key={a.id} className={`me-stamp ${stampId === a.id ? "on" : ""}`} title={a.nazev} onClick={() => onPick(a.id)}>
            <img src={assetUrl(assetSrc(a, a.id === stampId ? variant : 0))} alt={a.nazev} loading="lazy" />
            {!!a.varianty?.length && <small className="me-variant-count" title={"Základ + " + a.varianty.length + " varianty"}>+{a.varianty.length}</small>}
          </button>
        ))}
      </div>
      <label className="me-btn sm"><Upload size={14} /> Nahrát obrázek
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} /></label>
    </div>
  );
}

export function PropertiesPanel({ map, selObj, push, onDelete, objects, assets, onVariant }: {
  map: MapV2; selObj: { kind: string; id: string } | null;
  push: (f: (m: MapV2) => void) => void; onDelete: () => void;
  objects: MapObject[]; assets: Record<string, AssetEntry>;
  onVariant: (action: number | "next" | "random", asset?: string) => void;
}) {
  const variants = objects.length ? <section className="me-variant-section">
    <h4>Varianty · {objects.length} objektů</h4>
    {[...new Set(objects.map(o => o.asset))].map(id => assets[id] && <div key={id}>
      <strong>{assets[id].nazev}</strong>
      <VariantStrip entry={assets[id]} value={objects.find(o => o.asset === id)?.v}
        onChange={v => onVariant(v, id)} />
    </div>)}
    <button className="me-btn sm" title="Další varianta (A)" onClick={() => onVariant("next")}>Další (A)</button>
    <button className="me-btn sm" title="Náhodná varianta (Shift+A)" onClick={() => onVariant("random")}>Náhodně</button>
  </section> : null;
  if (!selObj) return variants || <p className="me-none">Vyber objekt / zeď / světlo / poznámku nástrojem Výběr.</p>;
  const selObject = selObj.kind === "objekt" ? (map.objekty || []).find((o) => o.id === selObj.id) : null;
  const selWall = selObj.kind === "stena" ? (map.steny || []).find((w) => w.id === selObj.id) : null;
  const selLight = selObj.kind === "svetlo" ? (map.svetla || []).find((l) => l.id === selObj.id) : null;
  const selNote = selObj.kind === "poznamka" ? (map.poznamky || []).find((n) => n.id === selObj.id) : null;
  return (
    <div className="me-props">
      {variants}
      {selObject && (
        <>
          <h4>Objekt — {stampById(selObject.asset)?.nazev || selObject.asset}</h4>
          <div className="me-visual-grid">{([[undefined,"Automaticky"],[false,"Bez pohybu"],["vitr","Vítr"],["portal","Portál"],["ohen","Oheň"],["zare","Záře"],["voda","Voda"]] as const).map(([anim,label]) =>
            <button key={label} aria-pressed={selObject.anim === anim} onClick={() => push(m => { m.objekty!.find(o => o.id === selObj.id)!.anim = anim; })}>
              <img width="24" height="24" src="/repo/11_Mapy/bojove/ikony/nastaveni.webp" alt="" />{label}</button>)}</div>
          {(["x", "y", "w", "h", "rot", "z"] as const).map((f) => (
            <label key={f}>{{x:"Poloha X",y:"Poloha Y",w:"Šířka",h:"Výška",rot:"Úhel (°)",z:"Pořadí"}[f]}<input aria-label={f === "rot" ? "Úhel objektu" : f} type="number" step={f === "rot" ? 1 : .1} value={(selObject as any)[f] ?? 0}
              onChange={(e) => push((m) => { const o = m.objekty!.find((o) => o.id === selObj.id)!; (o as any)[f] = +e.target.value; })} /></label>))}
          <label>tint<input type="color" value={selObject.tint || "#ffffff"} onChange={(e) => push((m) => { m.objekty!.find((o) => o.id === selObj.id)!.tint = e.target.value; })} /></label>
          {(["blocks", "difficult", "flip", "dmOnly"] as const).map((f) => (
            <label key={f} className="me-ctx-chk"><input type="checkbox" checked={!!selObject[f]}
              onChange={(e) => push((m) => { (m.objekty!.find((o) => o.id === selObj.id) as any)[f] = e.target.checked; })} /> {f}</label>))}
          <h4>Krytí</h4><div className="me-visual-grid">{([0,2,3] as const).map(cover => <button key={cover} aria-pressed={(selObject.cover || 0) === cover}
            onClick={() => push(m => { m.objekty!.find(o => o.id === selObj.id)!.cover = cover || undefined; })}>
            <svg viewBox="0 0 50 24"><rect x="5" y="2" width="40" height="20" rx="3" fill="#e1d2af" /><rect x="5" y={22-cover*6} width="40" height={cover*6} fill="#796647" /></svg>
            {cover === 0 ? "Žádné" : cover === 2 ? "Poloviční" : "Tříčtvrteční"}</button>)}</div>
          <label className="me-ctx-chk"><input type="checkbox" checked={!!selObject.light}
            onChange={(e) => push((m) => { const o = m.objekty!.find((o) => o.id === selObj.id)!; o.light = e.target.checked ? { bright: 10, dim: 10 } : undefined; })} /> světlo</label>
        </>
      )}
      {selWall && (
        <>
          <h4>Zeď</h4>
          <WallPicker value={selWall.typ} onChange={typ => push(m => { m.steny!.find(w => w.id === selObj.id)!.typ = typ; })} />
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
      <WeatherPicker map={map} value={map.pocasi} onChange={value => push(m => { m.pocasi = value; })} />
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
      <div className="me-visual-grid">{(["lines", "dots", "none"] as const).map(typ => <button key={typ} aria-pressed={(map.mrizkaStyl?.typ || "lines") === typ}
        onClick={() => push(m => { m.mrizkaStyl = { ...(m.mrizkaStyl || { barva: "#000000", opacita: .18 }), typ }; })}>
        <svg viewBox="0 0 96 48" style={{ background: "url(/repo/11_Mapy/bojove/textury/teren-les.webp) center/cover" }}>
          <MapGridLayer map={{ ...map, mrizkaStyl: { typ, barva: "#ffffff", opacita: .8 } }} W={4} H={2} />
        </svg>{{lines:"Čáry",dots:"Tečky",none:"Bez mřížky"}[typ]}</button>)}</div>
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

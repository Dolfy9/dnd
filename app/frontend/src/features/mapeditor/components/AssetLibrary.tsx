import React, { useEffect, useState } from "react";
import { Search, Star, Upload, Sparkles, Lightbulb, Shield, Package } from "lucide-react";
import { assetSrc, assetUrl, type AssetEntry, useTextureManifest } from "../assets/manifest";
import { STAMPS, StampSvg, stampById } from "../assets/stamps";
import { TEXTURES } from "../assets/textures";
import { TILES } from "../../boj/types";
import { terrainTexture } from "../../boj/model/terrainArt";
import { fuzzyScore, readPreference, rememberAsset, writePreference } from "../state/editorUx";
import { VariantStrip } from "./VariantStrip";

export type LibraryMode = "objects" | "terrain" | "textures";
export function AssetLibrary({ q, setQ, kat, setKat, stampId, onPick, ASSETS, onUpload, variant, onVariant, mode, onMode, ground, tile, texture, onTile, onTexture }: {
  q: string; setQ: (v: string) => void; kat: string; setKat: (v: string) => void;
  stampId: string; onPick: (id: string) => void; ASSETS: Record<string, AssetEntry>; onUpload: (f: File) => void;
  variant: number; onVariant: (v: number) => void; mode: LibraryMode; onMode: (mode: LibraryMode) => void;
  ground: string; tile: string; texture: string; onTile: (id: string) => void; onTexture: (id: string) => void;
}) {
  const textures = useTextureManifest().data || {};
  const [favorites, setFavorites] = useState<string[]>(() => { const v = readPreference("me-favorite-assets", []); return Array.isArray(v) ? v : []; });
  const [recent, setRecent] = useState<string[]>(() => { const v = readPreference("me-recent-assets", []); return Array.isArray(v) ? v : []; });
  const [size, setSize] = useState(() => { const v = readPreference("me-card-size", 1); return [0,1,2].includes(v) ? v : 1; });
  useEffect(() => { const update = () => { const v = readPreference("me-recent-assets", []); setRecent(Array.isArray(v) ? v : []); }; window.addEventListener("me-library-change", update); return () => window.removeEventListener("me-library-change", update); }, []);
  const all = [...STAMPS.map(s => ASSETS[s.id] || { id: s.id, nazev: s.nazev, kategorie: s.kat, src: "", w: s.w, h: s.h }), ...Object.values(ASSETS).filter(a => !stampById(a.id))];
  const matches = (a: AssetEntry) => (!kat || (kat === "__custom" ? a.custom : a.kategorie === kat)) && fuzzyScore(a.nazev, q) >= 0;
  const filtered = all.filter(matches);
  const pick = (id: string) => { rememberAsset(id); onPick(id); };
  const cards = (items: AssetEntry[]) => <div className="me-asset-grid" style={{ "--asset-card-size": `${[72,88,128][size]}px` } as React.CSSProperties}>
    {items.map(a => <div key={a.id} className="me-asset-card">
      <button className={`me-stamp ${stampId === a.id ? "on" : ""}`} draggable title={`${a.nazev} · ${a.w || 1}×${a.h || 1} · táhni do mapy`}
        onDragStart={e => { e.dataTransfer.setData("application/x-montelien-asset", a.id); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => pick(a.id)}>
        <span className="me-asset-image">{a.src ? <img src={assetUrl(assetSrc(a, a.id === stampId ? variant : 0))} alt={a.nazev} loading="lazy" style={{mixBlendMode:a.blend}} /> : <svg viewBox="-13 -13 26 26"><StampSvg def={stampById(a.id)!} /></svg>}
          <span className="me-asset-badges">{!!a.varianty?.length && <small title="Počet variant">+{a.varianty.length}</small>}{a.anim && <small title="Animovaný"><Sparkles size={11} /></small>}{a.light && <small title="Vydává světlo"><Lightbulb size={11} /></small>}{a.blocks && <small title="Blokuje pohyb"><Shield size={11} /></small>}</span>
        </span><span className="me-asset-name">{a.nazev}</span>
      </button>
      <button className={`me-favorite ${favorites.includes(a.id) ? "on" : ""}`} aria-label={`${favorites.includes(a.id) ? "Odebrat z" : "Přidat do"} oblíbených: ${a.nazev}`} aria-pressed={favorites.includes(a.id)} onClick={() => { const next = favorites.includes(a.id) ? favorites.filter(id => id !== a.id) : [...favorites, a.id]; setFavorites(next); writePreference("me-favorite-assets", next); }}><Star size={13} fill={favorites.includes(a.id) ? "currentColor" : "none"} /></button>
    </div>)}
  </div>;
  const texOptions = [...TEXTURES.filter(t => !textures[t.id]), ...Object.values(textures)].filter(t => fuzzyScore(t.nazev,q) >= 0);
  const terrainOptions = Object.entries(TILES).filter(([,d]) => fuzzyScore(d.nazev,q) >= 0);
  return <div className="me-library">
    <div className="me-library-sticky"><div className="me-search"><Search size={16} /><input data-library-search aria-label="Hledat v knihovně" placeholder="Hledat v knihovně…" value={q} onChange={e => setQ(e.target.value)} /><kbd>/</kbd></div>
      <div className="me-segments" aria-label="Obsah knihovny">{([["objects","Objekty"],["terrain","Terén"],["textures","Textury"]] as const).map(([id,label]) => <button key={id} aria-pressed={mode === id} onClick={() => onMode(id)}>{label}</button>)}</div>
      <label className="me-card-size">Velikost karet <span>S</span><input aria-label="Velikost karet" type="range" min="0" max="2" step="1" aria-valuetext={["Malé","Střední","Velké"][size]} value={size} onChange={e => { setSize(+e.target.value); writePreference("me-card-size",+e.target.value); }} /><span>L</span></label>
    </div>
    {mode === "objects" ? <>
      <div className="me-category-chips" aria-label="Kategorie knihovny">{["",...new Set(all.map(a => a.kategorie).filter((k): k is string => !!k)),"__custom"].map(k => {
        const entries = all.filter(a => !k || (k === "__custom" ? a.custom : a.kategorie === k)), rep = entries.find(a => a.src);
        return <button key={k} aria-pressed={kat === k} onClick={() => setKat(k)}>{rep ? <img src={assetUrl(rep.src)} alt="" /> : <Package size={20} />}{k === "" ? "Vše" : k === "__custom" ? "Vlastní" : k}<small>{entries.length}</small></button>;
      })}</div>
      {ASSETS[stampId] && <details className="me-library-variants"><summary>{ASSETS[stampId].nazev} · varianty</summary><VariantStrip entry={ASSETS[stampId]} value={variant} onChange={onVariant} /></details>}
      {!!filtered.filter(a => favorites.includes(a.id)).length && <section><h4>Oblíbené</h4>{cards(filtered.filter(a => favorites.includes(a.id)))}</section>}
      {!!recent.filter(id => filtered.some(a => a.id === id)).length && <section><h4>Nedávné</h4>{cards(recent.map(id => filtered.find(a => a.id === id)).filter((a): a is AssetEntry => !!a))}</section>}
      <section><h4>Všechny objekty <span className="me-count">{filtered.length}</span></h4>{cards(filtered)}</section>
      {!filtered.length && <div className="me-empty"><Search size={28} /><strong>Nic jsme nenašli</strong><p>Zkus jiný název nebo kategorii.</p><button className="me-btn" onClick={() => { setQ(""); setKat(""); }}>Zrušit filtry</button></div>}
      <label className="me-btn me-upload"><Upload size={15} /> Nahrát vlastní obrázek<input type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} /></label>
    </> : <><p className="me-muted">{mode === "terrain" ? "Terén určuje průchodnost mapy." : "Vyber texturu a maluj přímo do mapy."}</p><div className="me-visual-grid me-library-surfaces">
      {mode === "terrain" ? terrainOptions.map(([id,d]) => <button key={id} aria-pressed={tile === id} onClick={() => onTile(id)}><img src={assetUrl(textures[terrainTexture(id,ground)]?.src || `bojove/textury/${terrainTexture(id,ground)}.webp`)} alt="" loading="lazy" />{d.nazev}</button>) : texOptions.map(t => <button key={t.id} aria-pressed={texture === t.id} onClick={() => onTexture(t.id)}>{textures[t.id] && <img src={assetUrl(textures[t.id].src)} alt="" loading="lazy" />}{t.nazev}</button>)}
    </div>{!(mode === "terrain" ? terrainOptions : texOptions).length && <div className="me-empty"><Search size={28} /><strong>Žádné výsledky</strong><p>Zkus jiný název.</p></div>}</>}
  </div>;
}

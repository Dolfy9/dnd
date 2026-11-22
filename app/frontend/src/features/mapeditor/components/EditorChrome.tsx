import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Command, Keyboard, Search, X } from "lucide-react";
import type { MapV2, MapWeather } from "../../boj/model/mapV2";
import { normalizeWeather, WEATHER } from "../../boj/model/mapV2";
import { weatherPreviewTexture } from "../../boj/components/MapMotion";
import { fuzzyScore, TOOL_GROUPS, TOOL_HINTS } from "../state/editorUx";
import { MapPreview } from "./MapPreview";

export interface EditorTool { id: string; icon: React.ReactElement; nazev: string; key: string }
export interface EditorCommand { id: string; label: string; group: string; icon?: React.ReactNode; image?: string; run: () => void }

export function ToolRail({ tools, active, onPick }: { tools: EditorTool[]; active: string; onPick: (id: string) => void }) {
  const [tip, setTip] = useState<{ tool: EditorTool; group: string; top: number } | null>(null);
  return <nav className="me-rail" aria-label="Nástroje mapy" onMouseLeave={() => setTip(null)} onScroll={() => setTip(null)}>
    {TOOL_GROUPS.map(([group, ids]) => <div className="me-tool-group" key={group} aria-label={group}>
      <span className="me-group-caption">{group}</span>
      {ids.map(id => { const t = tools.find(t => t.id === id)!; return <button key={id} className={`me-tool ${active === id ? "on" : ""}`}
        aria-label={`${t.nazev} (${t.key})`} aria-pressed={active === id}
        onMouseEnter={e => setTip({ tool: t, group, top: Math.min(window.innerHeight - 145, e.currentTarget.getBoundingClientRect().top) })}
        onFocus={e => setTip({ tool: t, group, top: Math.min(window.innerHeight - 145, e.currentTarget.getBoundingClientRect().top) })}
        onBlur={() => setTip(null)} onClick={() => { onPick(id); setTip(null); }}>{t.icon}<span className="me-tool-label">{t.nazev}</span></button>; })}
    </div>)}
    {tip && <div className="me-tool-tip" role="tooltip" style={{ top: tip.top }}><small>{tip.group}</small>
      <strong>{tip.tool.nazev}<kbd>{tip.tool.key}</kbd></strong><p>{TOOL_HINTS[tip.tool.id]}</p></div>}
  </nav>;
}

export function EditorDialog({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    (dialog.querySelector<HTMLElement>("input") || dialog.querySelector<HTMLElement>("button") || dialog).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close.current(); }
      if (e.key === "Tab") {
        const nodes = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')];
        const index = nodes.indexOf(document.activeElement as HTMLElement);
        if (!nodes.length) { e.preventDefault(); return; }
        if (e.shiftKey && index <= 0) { e.preventDefault(); nodes[nodes.length - 1].focus(); }
        else if (!e.shiftKey && index === nodes.length - 1) { e.preventDefault(); nodes[0].focus(); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); previous?.focus(); };
  }, []);
  return <div className="me-modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`me-dialog ${className}`}>
      <header><h2>{title}</h2><button className="me-btn sm" aria-label="Zavřít" onClick={onClose}><X size={17} /></button></header>{children}
    </div>
  </div>;
}

export function CommandPalette({ commands, onClose }: { commands: EditorCommand[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => commands.map(c => ({ c, score: fuzzyScore(c.label + " " + c.group, query) }))
    .filter(x => x.score >= 0).sort((a, b) => b.score - a.score).slice(0, 60).map(x => x.c), [commands, query]);
  useEffect(() => { document.getElementById(`me-command-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active]);
  const run = (c: EditorCommand) => { onClose(); c.run(); };
  return <EditorDialog title="Rychlé příkazy" onClose={onClose} className="me-command-dialog">
    <div className="me-command-search"><Search size={19} /><input autoFocus aria-label="Hledat příkaz" role="combobox" aria-expanded="true"
      aria-controls="me-command-results" aria-activedescendant={results.length ? `me-command-${active}` : undefined}
      placeholder="Nástroj, objekt, textura nebo počasí…" value={query} onChange={e => { setQuery(e.target.value); setActive(0); }}
      onKeyDown={e => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive(i => results.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0); }
        if (e.key === "Enter" && results[active]) { e.preventDefault(); run(results[active]); }
      }} /><kbd>Esc</kbd></div>
    <div id="me-command-results" className="me-command-results" role="listbox" aria-label="Výsledky příkazů">
      {results.map((c, i) => <button key={c.id} id={`me-command-${i}`} role="option" aria-selected={active === i}
        onMouseEnter={() => setActive(i)} onClick={() => run(c)}>
        {c.image ? <img src={c.image} alt="" /> : c.icon || <Command size={18} />}<span>{c.label}<small>{c.group}</small></span>{i === active && <kbd>Enter</kbd>}
      </button>)}
      {!results.length && <div className="me-empty"><Search size={30} /><strong>Žádný příkaz nenalezen</strong><p>Zkus kratší název nebo jiná klíčová slova.</p></div>}
    </div><footer><span>↑ ↓ vybrat</span><span>Enter spustit</span><span>Esc zavřít</span></footer>
  </EditorDialog>;
}

export function ShortcutHelp({ tools, onClose }: { tools: EditorTool[]; onClose: () => void }) {
  const extras = [
    ["Historie a soubory", [["Ctrl+S", "Uložit"], ["Ctrl+Z", "Zpět"], ["Ctrl+Y / Ctrl+Shift+Z", "Znovu"], ["Ctrl+K", "Rychlé příkazy"], ["?", "Tato nápověda"]]],
    ["Výběr a objekty", [["Shift+klik / tažení", "Přidat do výběru / obdélníkový výběr"], ["Ctrl+D", "Duplikovat"], ["Ctrl+C / Ctrl+V", "Kopírovat / vložit"], ["Delete / Backspace", "Smazat výběr"], ["Šipky / Shift+šipky", "Posun / větší krok"], ["Q / E", "Otočit −15° / +15°"], ["Alt+Q / Alt+E", "Otočit o 1°"], ["Ctrl+kolečko", "Otáčet výběr"], ["A / Shift+A", "Další / náhodná varianta"]]],
    ["Pohled a práce", [["Mezerník+tažení", "Posun plátna"], ["Prostřední / pravé tažení", "Posun plátna"], ["Kolečko / + / −", "Přiblížit / oddálit"], ["0", "Přizpůsobit mapu"], ["Tab", "Skrýt / zobrazit panel"], ["/", "Hledat v knihovně"], ["Enter / Escape", "Dokončit / zrušit polygon"], ["Alt+klik", "Odebrat interiér / otevřít dveře"], ["Shift při stěně", "Přichytit úhel"]]],
  ] as const;
  return <EditorDialog title="Klávesové zkratky" onClose={onClose} className="me-help-dialog">
    <p className="me-dialog-intro"><Keyboard size={17} /> Méně klikání, více tvoření. Zkratky se nespouštějí při psaní.</p>
    <div className="me-shortcut-grid">{TOOL_GROUPS.map(([group, ids]) => <section key={group}><h3>{group}</h3>
      {ids.map(id => { const t = tools.find(t => t.id === id)!; return <div key={id}><span>{t.nazev}</span><kbd>{t.key}</kbd></div>; })}
    </section>)}{extras.map(([group, items]) => <section key={group}><h3>{group}</h3>{items.map(([key, label]) => <div key={key}><span>{label}</span><kbd>{key}</kbd></div>)}</section>)}</div>
  </EditorDialog>;
}

export const EditorMinimap = memo(function EditorMinimap({ map, view, width, height, onCenter }: {
  map: MapV2; view: { x: number; y: number; k: number }; width: number; height: number; onCenter: (x: number, y: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const preview = useMemo(() => <MapPreview map={map} />, [map]);
  const W = (map.mrizka[0]?.length || 1) * 24, H = map.mrizka.length * 24;
  const x = Math.max(0, Math.min(W, -view.x / view.k)), y = Math.max(0, Math.min(H, -view.y / view.k));
  const right = Math.max(x, Math.min(W, (width - view.x) / view.k)), bottom = Math.max(y, Math.min(H, (height - view.y) / view.k));
  const center = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onCenter(Math.max(0, Math.min(W, (e.clientX - r.left) / r.width * W)), Math.max(0, Math.min(H, (e.clientY - r.top) / r.height * H)));
  };
  return <section className={`me-overview ${collapsed ? "collapsed" : ""}`} aria-label="Minimapa">
    <button className="me-overview-title" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>Přehled mapy{collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
    {!collapsed && <div className="me-overview-image" style={{ aspectRatio: `${W}/${H}` }} role="slider" tabIndex={0} aria-label="Pozice pohledu na minimapě"
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(x / W * 100)} aria-valuetext={`X ${Math.round(x / 24)}, Y ${Math.round(y / 24)}`}
      onKeyDown={e => { if (!e.key.startsWith("Arrow")) return; e.preventDefault(); e.stopPropagation(); onCenter((width / 2 - view.x) / view.k + (e.key === "ArrowLeft" ? -24 : e.key === "ArrowRight" ? 24 : 0), (height / 2 - view.y) / view.k + (e.key === "ArrowUp" ? -24 : e.key === "ArrowDown" ? 24 : 0)); }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); center(e); }}
      onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) center(e); }}>
      {preview}<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"><rect x={x} y={y} width={right - x} height={bottom - y} fill="#d4a24c18" stroke="#f8d692" strokeWidth={Math.max(W / 120, 2)} /></svg>
    </div>}
  </section>;
});

export function EditorWeather({ map, value, onChange }: { map: MapV2; value?: MapWeather; onChange: (value: MapWeather) => void }) {
  const weather = normalizeWeather(value), terrain = weatherPreviewTexture(map);
  const fx: Record<string, string> = { dest: "dest-svetly", bourka: "blesk", snih: "snih", mlha: "mraky-svetle", popel: "jiskry", vanice: "snih2" };
  return <section className="me-weather" aria-label="Počasí"><h4>Počasí</h4>
    <div className="me-weather-cards">{WEATHER.map(([typ, name]) => <button type="button" key={typ} aria-pressed={weather.typ === typ} onClick={() => onChange({ ...weather, typ })}>
      <span className={`me-weather-art weather-${typ || "jasno"}`} style={{ backgroundImage: `url(/repo/11_Mapy/bojove/textury/${terrain}.webp)` }}>
        {typ && <img src={`/repo/11_Mapy/bojove/fx/${fx[typ]}.webp`} alt="" />}</span><span>{name}</span>
    </button>)}</div>
    <label>Síla <output>{Math.round(weather.sila! * 100)} %</output><input aria-label="Síla počasí" type="range" min="0" max="1" step=".05" value={weather.sila} onChange={e => onChange({ ...weather, sila: +e.target.value })} /></label>
    <label>Vítr <output>{Math.round(weather.vitr!)}°</output><input aria-label="Směr větru" type="range" min="0" max="359" value={weather.vitr} onChange={e => onChange({ ...weather, vitr: +e.target.value })} /></label>
  </section>;
}

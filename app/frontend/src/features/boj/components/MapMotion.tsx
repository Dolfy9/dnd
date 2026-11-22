import { memo, useEffect, useId, useRef, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { normalizeWeather, WEATHER, type MapV2, type MapObject, type MapWeather } from "../model/mapV2";
import type { AssetEntry } from "../../mapeditor/assets/manifest";
import { terrainTexture } from "../model/terrainArt";
import "./mapAtmo.css";

export const FX = "/repo/11_Mapy/bojove/fx/";
const animationTypes = new Set(["voda", "portal", "vitr", "ohen", "zare"]);
export function resolveAnimation(object: Pick<MapObject, "anim">, asset?: AssetEntry): string {
  const value = object.anim !== undefined ? object.anim : asset?.anim ||
    asset?.tags?.find(t => animationTypes.has(t)) || (asset?.id.includes("portal") ? "portal" : "");
  return typeof value === "string" && animationTypes.has(value) ? value : "";
}
export function animationPhase(id: string) {
  const hash = [...id].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
  return -((Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0) % 1700) / 100;
}
const KEY = "montelien-map-animations";
const enabled = () => typeof localStorage === "undefined" || localStorage.getItem(KEY) !== "off";
function subscribe(callback: () => void) {
  window.addEventListener("map-animations", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("map-animations", callback); window.removeEventListener("storage", callback); };
}
export function AnimationButton() {
  const on = useSyncExternalStore(subscribe, enabled, () => true);
  useEffect(() => { document.documentElement.dataset.mapAnimations = on ? "on" : "off"; }, [on]);
  return <button className="me-btn sm map-animation-toggle" aria-pressed={on} onClick={() => {
    localStorage.setItem(KEY, on ? "off" : "on"); window.dispatchEvent(new Event("map-animations"));
  }}><img src="/repo/11_Mapy/bojove/ikony/nastaveni.webp" alt="" />Animace</button>;
}
export function WeatherPicker({ value, onChange, compact = false }: {
  value?: MapWeather; onChange: (value: MapWeather) => void; compact?: boolean;
}) {
  const weather = normalizeWeather(value);
  const cards = <div className="map-weather-cards">{WEATHER.map(([typ, label, fx]) =>
    <button type="button" key={typ} aria-pressed={weather.typ === typ} onClick={() => onChange({ ...weather, typ })}>
      <span style={{ backgroundImage: `url(/repo/11_Mapy/bojove/textury/teren-g.webp)` }}>
        {fx && <img src={FX + (typ === "dest" ? "dest-svetly" : typ === "mlha" ? "mraky-svetle" : fx) + ".webp"} alt="" style={{filter:"brightness(3) contrast(1.2)"}} />}
      </span>{label}
    </button>)}</div>;
  const controls = <><label>Síla {Math.round(weather.sila! * 100)} %<input aria-label="Síla počasí" type="range" min="0" max="1" step=".05" value={weather.sila}
    onChange={e => onChange({ ...weather, sila: +e.target.value })} /></label>
    <label>Vítr {Math.round(weather.vitr!)}°<input aria-label="Směr větru" type="range" min="0" max="359" step="1" value={weather.vitr}
      onChange={e => onChange({ ...weather, vitr: +e.target.value })} /></label></>;
  return compact ? <details className="map-weather-quick"><summary>Počasí</summary>{cards}{controls}<small>Živé počasí · ukládá se do stavu boje</small></details>
    : <section aria-label="Počasí"><h4>Počasí</h4>{cards}{controls}</section>;
}

export const MapWeatherLayer = memo(function MapWeatherLayer({ map }: { map: MapV2 }) {
  const w = normalizeWeather(map.pocasi);
  const lightning = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (w.typ !== "bourka" || !w.sila) return;
    let timer: ReturnType<typeof setTimeout>;
    const flash = () => {
      if (enabled() && !matchMedia("(prefers-reduced-motion: reduce)").matches && lightning.current) {
        lightning.current.style.setProperty("--bolt-x", Math.random() * 80 + "%");
        lightning.current.animate([{ opacity: 0 }, { opacity: .9, offset: .12 }, { opacity: .1, offset: .35 },
          { opacity: .65, offset: .5 }, { opacity: 0 }], { duration: 420 });
      }
      timer = setTimeout(flash, 6000 + Math.random() * 9000);
    };
    timer = setTimeout(flash, 6000 + Math.random() * 9000);
    return () => clearTimeout(timer);
  }, [w.typ, w.sila]);
  if (!w.typ || !w.sila) return null;
  const rain = w.typ === "dest" || w.typ === "bourka";
  const snow = w.typ === "snih" || w.typ === "vanice";
  const fog = w.typ === "mlha";
  const files = rain ? ["dest-svetly", "dest2-svetly"] : snow ? ["snih", "snih2"] : fog ? ["mraky-svetle", "mraky-svetle"] : ["jiskry", "jiskry"];
  return <div data-map-weather={w.typ} className={`map-weather weather-${w.typ}`} style={{ "--wind": `${w.vitr! - 90}deg`, "--strength": w.sila } as CSSProperties}>
      <div className="map-weather-wind" style={{ width: Math.hypot((map.mrizka[0]?.length || 1)*24,map.mrizka.length*24), height: Math.hypot((map.mrizka[0]?.length || 1)*24,map.mrizka.length*24) }}>{files.map((file, i) => <div key={i} className={`map-weather-sheet sheet-${i}`}
        style={{ backgroundImage: `url(${FX + file}.webp)` }} />)}</div>
      {(w.typ === "bourka" || w.typ === "vanice") && <div className="map-weather-cloud" style={{ backgroundImage: `url(${FX}mraky.webp)` }} />}
      {w.typ === "bourka" && <div ref={lightning} className="map-lightning"><img src={FX + "blesk.webp"} alt="" /></div>}
  </div>;
});

export const MapWeatherOverlay = memo(function MapWeatherOverlay({ map, view, px = 24 }: {
  map: MapV2; view: { x: number; y: number; k: number }; px?: number;
}) {
  return <div className="map-weather-overlay" aria-hidden="true"><div style={{
    width: (map.mrizka[0]?.length || 1)*24, height: map.mrizka.length*24,
    transform: `translate(${view.x}px,${view.y}px) scale(${view.k * px / 24})`, transformOrigin: "0 0",
  }}><MapWeatherLayer map={map} /></div></div>;
});

export const MapWaterLayer = memo(function MapWaterLayer({ map }: { map: MapV2 }) {
  const id = useId().replace(/:/g, "");
  const water = (key: string) => /voda|melcina|more|vlny/.test(key);
  const cells: [number, number][] = [];
  map.mrizka.forEach((row, y) => [...row].forEach((c, x) => {
    if (water(map.textury?.[x + "," + y] || terrainTexture(c, map.podklad))) cells.push([x, y]);
  }));
  const strokes = map.malba || [];
  if (!cells.length && !strokes.some(s => water(s.t))) return null;
  const W = (map.mrizka[0]?.length || 1) * 24, H = map.mrizka.length * 24;
  return <g pointerEvents="none" opacity=".24" style={{ mixBlendMode: "screen" }} data-map-water>
    <defs><mask id={id + "water"} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
      {cells.map(([x,y]) => <rect key={x+","+y} x={x*24} y={y*24} width="24.5" height="24.5" fill="white" />)}
      {strokes.map(s => <path key={s.id} d={s.p.map(([x,y],i) => `${i ? "L" : "M"}${x*24},${y*24}`).join(" ") + (s.poly ? "Z" : s.p.length === 1 ? "l.001,0" : "")}
        fill={s.poly ? water(s.t) ? "white" : "black" : "none"} stroke={s.poly ? "none" : water(s.t) ? "white" : "black"} strokeWidth={s.b*24} strokeLinecap="round" strokeLinejoin="round" opacity={s.o} />)}
    </mask><pattern id={id+"waves"} width="96" height="96" patternUnits="userSpaceOnUse">
      <g>{[-96,0].flatMap(x => [-96,0].map(y => <image key={x+","+y} href={FX+"vlny.webp"} x={x} y={y} width="96" height="96" />))}</g>
    </pattern></defs>
    <rect width={W} height={H} mask={`url(#${id}water)`} fill={`url(#${id}waves)`} />
  </g>;
});

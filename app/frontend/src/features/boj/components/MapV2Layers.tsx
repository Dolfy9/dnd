/* Sdílené v2 vrstvy mapy (boj + editor): textury, výška, stěny/dveře, objekty,
   kresby, světla, poznámky, mřížka. Vše memoizované — statické podle `map`. */
import React, { memo, useSyncExternalStore } from "react";
import type { MapV2, MapWall, MapObject } from "../model/mapV2";
import { edgeKey } from "../model/mapV2";
import { TextureDefs, texUrl, textureById } from "../../mapeditor/assets/textures";
import { stampById, StampSvg } from "../../mapeditor/assets/stamps";
import { assetUrl, type AssetEntry, type TextureEntry } from "../../mapeditor/assets/manifest";
import { resolveAnimation, animationPhase } from "./MapMotion";

/** Synchronní cache manifestů — plní ji useAssetManifest/useTextureManifest;
    v editoru i boji se volá dřív, než se renderují vrstvy. */
export let ASSETS: Record<string, AssetEntry> = {};
export let TEXIMG: Record<string, TextureEntry> = {};
let snapshot = { assets: ASSETS, textures: TEXIMG };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => snapshot;
export function useMapManifests() { return useSyncExternalStore(subscribe, getSnapshot, getSnapshot); }
export function setManifests(a: Record<string, AssetEntry>, t: Record<string, TextureEntry>) {
  if (ASSETS === a && TEXIMG === t) return;
  ASSETS = a; TEXIMG = t; snapshot = { assets: a, textures: t };
  listeners.forEach(listener => listener());
}

export const PX = 24;
const k = (x: number, y: number) => `${x},${y}`;

export const MapTextureLayer = memo(function MapTextureLayer({ map }: { map: MapV2 }) {
  const { textures } = useMapManifests();
  if (!map.textury || !Object.keys(map.textury).length) return null;
  return (
    <g>
      <defs>
        <TextureDefs />
        {Object.values(textures).map((t) => (
          <pattern key={t.id} id={`texi-${t.id}`} width={t.cells * PX} height={t.cells * PX} patternUnits="userSpaceOnUse">
            <image href={assetUrl(t.src)} width={t.cells * PX} height={t.cells * PX} preserveAspectRatio="xMidYMid slice" />
          </pattern>
        ))}
      </defs>
      {Object.entries(map.textury).map(([key, tid]) => {
        const [x, y] = key.split(",").map(Number);
        const imgT = textures[tid];
        if (!imgT && !textureById(tid)) return null;
        return <rect key={key} x={x * PX} y={y * PX} width={PX} height={PX}
                     fill={imgT ? `url(#texi-${tid})` : texUrl(tid)} />;
      })}
    </g>
  );
});

export const MapElevationLayer = memo(function MapElevationLayer({ map }: { map: MapV2 }) {
  const e = map.vyska;
  if (!e || !Object.keys(e).length) return null;
  const vals = Object.values(e);
  const max = Math.max(...vals.map(Math.abs), 5);
  return (
    <g pointerEvents="none">
      {Object.entries(e).map(([key, v]) => {
        const [x, y] = key.split(",").map(Number);
        const a = Math.min(.28, (Math.abs(v) / max) * .28);
        return (
          <g key={key}>
            <rect x={x * PX} y={y * PX} width={PX} height={PX}
                  fill={v > 0 ? "#fbbf24" : "#1e293b"} opacity={v === 0 ? 0 : a} />
            {v !== 0 && <text x={x * PX + 2} y={y * PX + 7} fontSize={5.5} fill="#f8fafc"
                              style={{ paintOrder: "stroke" }} stroke="#0008" strokeWidth={1}>{v > 0 ? `+${v}` : v}</text>}
          </g>
        );
      })}
    </g>
  );
});

const WALL_STYLE: Record<string, { color: string; w: number; dash?: string }> = {
  wall: { color: "#292524", w: 3 },
  door: { color: "#8a6a44", w: 3.4 },
  window: { color: "#7dd3fc", w: 2.4 },
  secret: { color: "#a78bfa", w: 2.6, dash: "4 2" },
  half: { color: "#78716c", w: 1.8 },
  curtain: { color: "#c084fc", w: 1.6, dash: "2 2" },
};

export const MapWallLayer = memo(function MapWallLayer({ map, doors, onDoor, dm, revealedSecrets }:
  { map: MapV2; doors?: Record<string, boolean>; onDoor?: (w: MapWall) => void; dm?: boolean; revealedSecrets?: Record<string, 1> }) {
  const steny = map.steny || [];
  if (!steny.length) return null;
  return (
    <g>
      {steny.map((w) => {
        if (w.typ === "secret" && !dm && !(revealedSecrets && revealedSecrets[w.id])) return null;
        const st = WALL_STYLE[w.typ] || WALL_STYLE.wall;
        const open = w.typ === "door" && (doors?.[w.id] ?? w.open);
        const x1 = w.a[0] * PX, y1 = w.a[1] * PX, x2 = w.b[0] * PX, y2 = w.b[1] * PX;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        return (
          <g key={w.id} data-door={w.typ === "door" ? w.id : undefined}
             onClick={w.typ === "door" && onDoor ? () => onDoor(w) : undefined}
             style={w.typ === "door" && onDoor ? { cursor: "pointer" } : undefined}>
            {w.typ === "door" && <circle cx={mx} cy={my} r={8} fill="transparent" />}
            <line x1={x1 + 1.2} y1={y1 + 1.6} x2={x2 + 1.2} y2={y2 + 1.6} stroke="#000"
                  strokeWidth={st.w} opacity={.3} strokeLinecap="square" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={st.color} strokeWidth={st.w}
                  strokeDasharray={st.dash} strokeLinecap="square" opacity={w.typ === "curtain" ? .75 : 1} />
            {w.typ === "door" && (
              <g transform={`translate(${mx},${my}) rotate(${Math.atan2(y2-y1,x2-x1)*180/Math.PI})`}>
                {open && <path d="M0 0 A9 9 0 0 1 8.5 -3" fill="none" stroke={st.color} strokeWidth={.9} opacity={.8} />}
                <rect x={-4.5} y={-1.5} width={9} height={3} rx={1}
                      fill={open ? "#c9b489" : "#6b4f30"} stroke="#292524" strokeWidth={.8}
                      transform={open ? "rotate(-38)" : undefined} />
                {w.locked && <circle cx={0} cy={0} r={1.6} fill="#fbbf24" stroke="#292524" strokeWidth={.5} />}
              </g>
            )}
            {w.typ === "window" && <>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0c4a6e" strokeWidth={.7} strokeDasharray="2 2" />
              <line x1={x1 + (x1 === x2 ? 2 : 0)} y1={y1 + (x1 === x2 ? 0 : 2)} x2={x2 + (x1 === x2 ? 2 : 0)} y2={y2 + (x1 === x2 ? 0 : 2)} stroke={st.color} strokeWidth={.9} opacity={.7} /></>}
          </g>
        );
      })}
    </g>
  );
});

export const MapObjectLayer = memo(function MapObjectLayer({ map, dm, staticOnly = false }: { map: MapV2; dm?: boolean; staticOnly?: boolean }) {
  const { assets } = useMapManifests();
  const objs = (map.objekty || []).slice().sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  if (!objs.length) return null;
  return (
    <g pointerEvents="none">
      {objs.map((o: MapObject) => {
        if (o.dmOnly && !dm) return null;
        const isImg = o.asset.startsWith("img:");
        const man = assets[o.asset];
        if (staticOnly && resolveAnimation(o, man)) return null;
        const def = isImg || man ? null : stampById(o.asset);
        const src = man ? assetUrl(man.src) : isImg ? `/repo/11_Mapy/bojove/${o.asset.slice(4)}` : null;
        return (
          <g key={o.id} transform={`translate(${o.x * PX},${o.y * PX}) rotate(${o.rot || 0}) ${o.flip ? "scale(-1,1)" : ""}`}
             opacity={o.dmOnly ? .55 : 1}>
            {!staticOnly && ["portal", "ohen", "zare"].includes(resolveAnimation(o, man)) && <g opacity=".35"><image href="/repo/11_Mapy/bojove/ovl/zar.webp"
              x={-o.w*PX*.8} y={-o.h*PX*.8} width={o.w*PX*1.6} height={o.h*PX*1.6}
              style={{ mixBlendMode: "screen", animationDelay: `${animationPhase(o.id)}s`, filter: resolveAnimation(o, man) === "portal" ? "hue-rotate(165deg)" : undefined }} /></g>}
            {def && <defs><filter id="stamp-shade" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="1" dy="2" stdDeviation="1.2" floodColor="#000" floodOpacity="0.45" /></filter></defs>}
            {src ? <image href={src} x={-o.w * PX / 2} y={-o.h * PX / 2} width={o.w * PX} height={o.h * PX}
                          preserveAspectRatio="xMidYMid meet"
                          style={{ filter: "drop-shadow(1px 2px 2px #0008)", animationDelay: `${animationPhase(o.id)}s` }} />
                 : def ? <g filter="url(#stamp-shade)"><StampSvg def={def} tint={o.tint} /></g>
                 : <rect x={-o.w * PX / 2} y={-o.h * PX / 2} width={o.w * PX} height={o.h * PX} fill="#8a6a44" opacity={.6} />}
          </g>
        );
      })}
    </g>
  );
});

export const MapDrawingLayer = memo(function MapDrawingLayer({ map, dm }: { map: MapV2; dm?: boolean }) {
  const ks = map.kresby || [];
  if (!ks.length) return null;
  const pts = (p: [number, number][]) => p.map(([x, y]) => `${x * PX},${y * PX}`).join(" ");
  return (
    <g pointerEvents="none">
      {ks.map((d) => {
        if (d.dmOnly && !dm) return null;
        const sw = d.width || .12;
        const op = d.dmOnly ? .6 : 1;
        switch (d.kind) {
          case "free": return <polyline key={d.id} points={pts(d.pts)} fill="none" stroke={d.stroke} strokeWidth={sw * PX} opacity={op} strokeLinecap="round" strokeLinejoin="round" />;
          case "line": return d.pts.length >= 2 ? <line key={d.id} x1={d.pts[0][0] * PX} y1={d.pts[0][1] * PX} x2={d.pts[1][0] * PX} y2={d.pts[1][1] * PX} stroke={d.stroke} strokeWidth={sw * PX} opacity={op} /> : null;
          case "rect": return d.pts.length >= 2 ? <rect key={d.id} x={Math.min(d.pts[0][0], d.pts[1][0]) * PX} y={Math.min(d.pts[0][1], d.pts[1][1]) * PX} width={Math.abs(d.pts[1][0] - d.pts[0][0]) * PX} height={Math.abs(d.pts[1][1] - d.pts[0][1]) * PX} fill={d.fill || "none"} stroke={d.stroke} strokeWidth={sw * PX} opacity={op} /> : null;
          case "ellipse": {
            if (d.pts.length < 2) return null;
            const cx = (d.pts[0][0] + d.pts[1][0]) / 2 * PX, cy = (d.pts[0][1] + d.pts[1][1]) / 2 * PX;
            return <ellipse key={d.id} cx={cx} cy={cy} rx={Math.abs(d.pts[1][0] - d.pts[0][0]) / 2 * PX} ry={Math.abs(d.pts[1][1] - d.pts[0][1]) / 2 * PX} fill={d.fill || "none"} stroke={d.stroke} strokeWidth={sw * PX} opacity={op} />;
          }
          case "poly": return <polygon key={d.id} points={pts(d.pts)} fill={d.fill || "none"} stroke={d.stroke} strokeWidth={sw * PX} opacity={op} />;
          case "text": return <text key={d.id} x={d.pts[0]?.[0] * PX} y={d.pts[0]?.[1] * PX} fontSize={(d.size || .7) * PX} fill={d.stroke} opacity={op}>{d.text}</text>;
          default: return null;
        }
      })}
    </g>
  );
});

export const MapLightLayer = memo(function MapLightLayer({ map }: { map: MapV2 }) {
  const ls = map.svetla || [];
  if (!ls.length) return null;
  return (
    <g pointerEvents="none">
      {ls.map((l) => (
        <g key={l.id} transform={`translate(${l.x * PX},${l.y * PX})`}>
          <circle r={(l.dim || l.bright || 5) / 5 * PX} fill={l.color || "#fbbf24"} opacity={.08} />
          <circle r={(l.bright || 5) / 5 * PX} fill={l.color || "#fbbf24"} opacity={.1} />
          <circle r={3} fill={l.color || "#fbbf24"} opacity={.9} />
        </g>
      ))}
    </g>
  );
});

export const MapNoteLayer = memo(function MapNoteLayer({ map }: { map: MapV2 }) {
  const ns = map.poznamky || [];
  if (!ns.length) return null;
  return (
    <g pointerEvents="none">
      {ns.map((n) => (
        <g key={n.id} transform={`translate(${n.x * PX},${n.y * PX})`}>
          <circle r={4.5} fill="#a78bfa" stroke="#2e1065" strokeWidth={1} />
          <text textAnchor="middle" y={2.6} fontSize={7} fill="#fff" fontWeight={800}>!</text>
          <title>{n.text}</title>
        </g>
      ))}
    </g>
  );
});

export const MapGridLayer = memo(function MapGridLayer({ map, W, H }: { map: MapV2; W: number; H: number }) {
  const st = map.mrizkaStyl;
  const typ = st?.typ || "lines";
  if (typ === "none") return null;
  const color = st?.barva || "#000";
  const op = st?.opacita ?? .18;
  if (typ === "dots") {
    const dots: React.ReactElement[] = [];
    for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++)
      dots.push(<circle key={k(x, y)} cx={x * PX} cy={y * PX} r={.9} fill={color} opacity={op + .1} />);
    return <g pointerEvents="none">{dots}</g>;
  }
  return (
    <g pointerEvents="none">
      {Array.from({ length: W + 1 }, (_, i) => <line key={"v" + i} x1={i * PX} y1={0} x2={i * PX} y2={H * PX} stroke={color} opacity={op} strokeWidth={.8} />)}
      {Array.from({ length: H + 1 }, (_, i) => <line key={"h" + i} x1={0} y1={i * PX} x2={W * PX} y2={i * PX} stroke={color} opacity={op} strokeWidth={.8} />)}
    </g>
  );
});

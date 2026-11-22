/* Pomocné vrstvy mapy: zóny (animované vzory), terén overrides,
   osvětlení (darkness overlay + světelné díry), fog of war. */
import type { StavBoje, Zone, Token } from "../types";
import { tileAt, tileDef } from "../rules/grid";
import { lightAt } from "../rules/lighting";
import type { BattleMapData } from "../types";
import { assetUrl } from "../../mapeditor/assets/manifest";
import { useMapManifests } from "./MapV2Layers";
import { terrainTexture, terrainProp, interiorWall } from "../model/terrainArt";
import { useId } from "react";

export const ZONES_STYLE: Record<string, { fill: string; stroke: string; tint?: string; op?: number }> = {
  fire: { fill: "url(#zp-fire)", stroke: "#f97316", tint: "#7c2d12", op: 0.42 },
  fog: { fill: "url(#zp-fog)", stroke: "#94a3b8", tint: "#64748b", op: 0.34 },
  darkness: { fill: "url(#zp-dark)", stroke: "#a78bfa", tint: "#05030f", op: 0.88 },
  ice: { fill: "url(#zp-ice)", stroke: "#7dd3fc", tint: "#0c4a6e", op: 0.34 },
  web: { fill: "url(#zp-web)", stroke: "#e2e8f0", tint: "#334155", op: 0.36 },
  radiant: { fill: "url(#zp-radiant)", stroke: "#fde047", tint: "#713f12", op: 0.32 },
  necrotic: { fill: "url(#zp-necro)", stroke: "#4d7c0f", tint: "#1a2e05", op: 0.4 },
  poison: { fill: "url(#zp-poison)", stroke: "#22c55e", tint: "#14532d", op: 0.4 },
  thorns: { fill: "url(#zp-thorns)", stroke: "#65a30d", tint: "#1a2e05", op: 0.36 },
  water: { fill: "url(#zp-water)", stroke: "#38bdf8", tint: "#0c4a6e", op: 0.4 },
  storm: { fill: "url(#zp-storm)", stroke: "#a78bfa", tint: "#1e1b4b", op: 0.42 },
  moon: { fill: "url(#zp-radiant)", stroke: "#e0e7ff", tint: "#713f12", op: 0.3 },
  grease: { fill: "url(#zp-fog)", stroke: "#a3a3a3", tint: "#3f3f46", op: 0.4 },
  silence: { fill: "url(#zp-fog)", stroke: "#64748b", tint: "#1e293b", op: 0.42 },
  daggers: { fill: "url(#zp-web)", stroke: "#cbd5e1", tint: "#334155", op: 0.4 },
  tentacles: { fill: "url(#zp-necro)", stroke: "#312e81", tint: "#1e1b4b", op: 0.45 },
  force: { fill: "url(#zp-ice)", stroke: "#c4b5fd", tint: "#1e1b4b", op: 0.32 },
  insects: { fill: "url(#zp-poison)", stroke: "#65a30d", tint: "#14532d", op: 0.42 },
  dim: { fill: "url(#zp-fog)", stroke: "#94a3b8", tint: "#475569", op: 0.3 },
  terrain: { fill: "url(#zp-thorns)", stroke: "#a8a29e", tint: "#44403c", op: 0.34 },
  hazard: { fill: "url(#zp-fire)", stroke: "#f97316", tint: "#7c2d12", op: 0.42 },
};

/** Menší štítek nad zónou: název + zbývající kola / concentration. */
function ZoneChip({ x, y, z, lab = 1 }: { x: number; y: number; z: Zone; lab?: number }) {
  const parts = [z.nazev];
  if (z.duration?.rounds != null) parts.push(`${z.duration.rounds}k`);
  if (z.conc) parts.push("⛁");
  const label = parts.join(" · ");
  const w = label.length * 7.5 + 18;
  return (
    <g transform={`translate(${x},${y}) scale(${lab})`} pointerEvents="none" className="boj-zone-chip">
      <rect x={-w / 2} y={-10} width={w} height={19} rx={9.5} fill="#0f172ae6" stroke="#ffffff2e" strokeWidth={0.7} />
      <text textAnchor="middle" dy={3.4} fontSize={11.5} fill="#e2e8f0" fontWeight={700}>{label}</text>
    </g>
  );
}

export function ZoneShape({ z, px, tokens, lab = 1, edit, onMove, onResize }: {
  z: Zone; px: number; tokens: Token[]; lab?: number;
  edit?: boolean; onMove?: (ax: number, ay: number) => void; onResize?: (size: number) => void;
}) {
  const handles = edit ? (
    <g className="boj-zone-handles">
      <rect
        x={(z.anchor[0] + 0.5) * px - 10} y={(z.anchor[1] + 0.5) * px - 10} width={20} height={20} rx={4}
        fill="#0f172acc" stroke="#60a5fa" strokeWidth={1.5} style={{ cursor: "move", pointerEvents: "auto" }}
        onPointerDown={(e) => {
          e.stopPropagation(); e.preventDefault();
          const svg = (e.target as Element).closest("svg")!; const r0 = svg.getBoundingClientRect();
          const sc = px / (r0.width / svg.viewBox.baseVal.width || 1);
          const mv = (ev: PointerEvent) => {
            const gx = (ev.clientX - r0.left) / (r0.width / svg.viewBox.baseVal.width) / px - 0.5;
            const gy = (ev.clientY - r0.top) / (r0.width / svg.viewBox.baseVal.width) / px - 0.5;
            onMove?.(Math.max(0, Math.floor(gx)), Math.max(0, Math.floor(gy)));
          };
          const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
          window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
        }}
      />
      {!z.tokenId && (
        <circle
          cx={(z.anchor[0] + 0.5) * px + (z.shape.size / 5) * px} cy={(z.anchor[1] + 0.5) * px} r={7}
          fill="#0f172acc" stroke="#60a5fa" strokeWidth={1.5} style={{ cursor: "nwse-resize", pointerEvents: "auto" }}
          onPointerDown={(e) => {
            e.stopPropagation(); e.preventDefault();
            const svg = (e.target as Element).closest("svg")!; const r0 = svg.getBoundingClientRect();
            const ax = z.anchor[0] + 0.5, ay = z.anchor[1] + 0.5;
            const mv = (ev: PointerEvent) => {
              const gx = (ev.clientX - r0.left) / (r0.width / svg.viewBox.baseVal.width) / px;
              const dist = Math.max(1, Math.round(Math.hypot(gx - ax, ((ev.clientY - r0.top) / (r0.width / svg.viewBox.baseVal.width) / px) - ay) * 5 / 5) * 5);
              onResize?.(dist * 5);
            };
            const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
            window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
          }}
        />
      )}
    </g>
  ) : null;
  const st = ZONES_STYLE[z.style] || ZONES_STYLE.fire;
  const cls = `boj-zone boj-zone-${z.style}`;
  const dark = z.style === "darkness";
  const fillOp = st.op ?? 0.4;
  const body = (shape: JSX.Element, chipX: number, chipY: number, edgeR?: number, edgeCx?: number, edgeCy?: number) => (
    <g className={cls} pointerEvents="none">{handles}
      {shape}
      {edgeR != null && (
        <>
          <circle cx={edgeCx} cy={edgeCy} r={edgeR} fill="none" stroke={st.stroke} strokeWidth={dark ? 6 : 2} opacity={dark ? 0.5 : 0.9} className={dark ? "boj-dark-edge" : ""} />
          <circle cx={edgeCx} cy={edgeCy} r={edgeR} fill="none" stroke={st.stroke} strokeWidth={1.2} strokeDasharray="6 5" opacity={0.85} />
        </>
      )}
      <ZoneChip x={chipX} y={chipY} z={z} lab={lab} />
    </g>
  );
  const src = z.tokenId ? tokens.find((t) => t.id === z.tokenId) : undefined;
  if (z.shape.kind === "emanation" && src?.x != null) {
    const r = z.shape.size / 5 * px + (src.s * px) / 2;
    const cx = (src.x + src.s / 2) * px, cy = (src.y! + src.s / 2) * px;
    const shape = (
      <>
        {st.tint && <circle cx={cx} cy={cy} r={r} fill={st.tint} opacity={dark ? 0.6 : 0.4} />}
        <circle cx={cx} cy={cy} r={r} fill={st.fill} opacity={dark ? 1 : fillOp} />
      </>
    );
    return body(shape, cx, cy - r - 4, r, cx, cy);
  }
  const [ax, ay] = z.anchor;
  if (z.shape.kind === "sphere" || z.shape.kind === "cylinder") {
    const r = z.shape.size / 5 * px;
    const cx = (ax + 0.5) * px, cy = (ay + 0.5) * px;
    const shape = (
      <>
        {st.tint && <circle cx={cx} cy={cy} r={r} fill={st.tint} opacity={dark ? 0.6 : 0.4} />}
        <circle cx={cx} cy={cy} r={r} fill={st.fill} opacity={dark ? 1 : fillOp} />
      </>
    );
    return body(shape, cx, cy - r - 4, r, cx, cy);
  }
  if (z.shape.kind === "rect" || z.shape.kind === "cube") {
    const w = (z.shape.w || Math.max(1, z.shape.size / 5)) * px, h = (z.shape.h || Math.max(1, z.shape.size / 5)) * px;
    const half = z.shape.kind === "cube" ? Math.ceil(z.shape.size / 10) : 0;
    const x = (ax - half) * px, y = (ay - half) * px;
    const shape = (
      <>
        {st.tint && <rect x={x} y={y} width={w} height={h} fill={st.tint} opacity={0.4} />}
        <rect x={x} y={y} width={w} height={h} fill={st.fill} opacity={fillOp} />
        <rect x={x} y={y} width={w} height={h} fill="none" stroke={st.stroke} strokeWidth={2} opacity={0.9} />
        <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} fill="none" stroke={st.stroke} strokeWidth={1} strokeDasharray="6 5" opacity={0.7} />
      </>
    );
    return body(shape, x + w / 2, y - 4);
  }
  // line / cone → buňky (omez na rozumný rozsah kolem anchoru)
  const cells: [number, number][] = [];
  const lim = z.shape.size / 5 + 4;
  for (let x = Math.floor(ax - lim); x <= ax + lim; x++)
    for (let y = Math.floor(ay - lim); y <= ay + lim; y++) {
      const { size, w } = z.shape;
      const r = size / 5;
      const dir = ((z.dir ?? 0) * Math.PI) / 180;
      const dx = x + 0.5 - (ax + 0.5), dy = y + 0.5 - (ay + 0.5);
      const along = dx * Math.cos(dir) + dy * Math.sin(dir);
      const perp = Math.abs(dx * Math.sin(dir) - dy * Math.cos(dir));
      const hit = z.shape.kind === "line"
        ? along >= -0.5 && along <= r + 0.5 && perp <= (w ? w / 10 : 0.5) + 0.001
        : along > -0.5 && along <= r + 0.5 && perp <= Math.max(0, along) / 2 + 0.5;
      if (hit) cells.push([x, y]);
    }
  const shape = (
    <>
      {cells.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x * px} y={y * px} width={px} height={px}
              fill={st.fill} opacity={fillOp} stroke={st.stroke} strokeWidth={1} />
      ))}
    </>
  );
  return body(shape, (ax + 0.5) * px, (ay + 0.5) * px - z.shape.size / 5 * px / 2 - 4);
}

/** Namalované terén override dlaždice. */
export function TerenLayer({ S, map, px, illustration = false }: {
  S?: Pick<StavBoje, "teren">; map: BattleMapData; px: number; illustration?: boolean;
}) {
  const { textures, assets } = useMapManifests();
  const id = useId().replace(/:/g, "");
  const at = (x: number, y: number) => S?.teren?.[`${x},${y}`] ?? map.mrizka[y]?.[x];
  const surfaces = new Map<string, string[]>();
  const props: JSX.Element[] = [];
  map.mrizka.forEach((row, y) => [...row].forEach((_, x) => {
    const c = at(x, y) || ".", override = S?.teren?.[`${x},${y}`] !== undefined;
    if (!illustration || override) {
      const tid = terrainTexture(c, map.podklad, c === "#" && interiorWall(x, y, at));
      const path = surfaces.get(tid) || [];
      path.push(`M${x * px},${y * px}h${px}v${px}h-${px}z`);
      surfaces.set(tid, path);
    }
    if (illustration && !override) return;
    const key = terrainProp(c, map.podklad, x, y), prop = key && assets["gen2-" + key];
    if (prop) {
      const size = c === "T" ? px * 1.3 : px;
      props.push(<image key={`${x},${y}`} href={assetUrl(prop.src)}
        x={x * px + (px - size) / 2} y={y * px + (px - size) / 2}
        width={size} height={size} preserveAspectRatio="xMidYMid meet" />);
    }
  }));
  return <g pointerEvents="none" data-terrain-art>
    <defs>{[...surfaces.keys()].map(tid => {
      const t = textures[tid];
      return t ? <pattern key={tid} id={`${id}-${tid}`} width={t.cells * px} height={t.cells * px} patternUnits="userSpaceOnUse">
        <image href={assetUrl(t.src)} width={t.cells * px} height={t.cells * px} preserveAspectRatio="xMidYMid slice" />
      </pattern> : null;
    })}</defs>
    {[...surfaces].map(([tid, paths]) => <path key={tid} d={paths.join("")}
      fill={textures[tid] ? `url(#${id}-${tid})` : "#57524d"} />)}
    {props}
  </g>;
}

/** Darkness overlay s dírami od světel — pro DM slabší, pro hráče silnější. */
export function LightingLayer({ S, map, px, W, H, dm }: {
  S: StavBoje; map: BattleMapData; px: number; W: number; H: number; dm: boolean;
}) {
  const globalLvl = S.lightLevel || "bright";
  const anyDarkZones = (S.zones || []).some((z) => z.blocksLos);
  if (globalLvl === "bright" && !(S.lights || []).length && !anyDarkZones) return null;
  const alphaBase = globalLvl === "dark" ? (dm ? 0.5 : 0.78) : globalLvl === "dim" ? (dm ? 0.22 : 0.4) : 0;
  const cells: JSX.Element[] = [];
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const lvl = lightAt(S, map, x, y);
    const a = lvl === "dark" ? Math.max(alphaBase, anyDarkZones ? 0.55 : alphaBase) : lvl === "dim" ? alphaBase * 0.55 : 0;
    if (a > 0.01) cells.push(<rect key={`${x},${y}`} x={x * px} y={y * px} width={px} height={px} fill="#030712" opacity={a} />);
  }
  return <g pointerEvents="none">{cells}</g>;
}

/** Fog of war: odhalené buňky průhledné, neodhalené černé (hráči) / tmavé (DM). */
export function FogLayer({ S, px, W, H, dm }: { S: StavBoje; px: number; W: number; H: number; dm: boolean }) {
  if (!S.fog?.on) return null;
  const a = dm ? 0.45 : 0.97;
  const dimA = dm ? 0.18 : 0.55;                       // explored-but-not-visible veil
  const cells: JSX.Element[] = [];
  const hasVis = !!S.fog.visible;
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const rev = S.fog.revealed[`${x},${y}`];
    if (!rev) cells.push(<rect key={`${x},${y}`} x={x * px} y={y * px} width={px} height={px} fill="#000" opacity={a} />);
    else if (hasVis && !S.fog.visible![`${x},${y}`])
      cells.push(<rect key={`${x},${y}`} x={x * px} y={y * px} width={px} height={px} fill="#000" opacity={dimA} />);
  }
  return <g pointerEvents="none">{cells}</g>;
}

export function tileTint(c: string, map: BattleMapData, x: number, y: number, teren?: Record<string, string>) {
  const t = tileAt(map, x, y, teren);
  const d = tileDef(t);
  if (!d.cost) return { fill: "#000", opacity: t === "_" ? 0.55 : 0.38 };
  if (d.difficult) return { fill: "#7c2d12", opacity: 0.14 };
  if (t === "x") return { fill: "#f97316", opacity: 0.25 };
  if (d.cover) return { fill: "#0ea5e9", opacity: 0.12 };
  return null;
}

export function ZonePatterns() {
  return (
    <defs>
      <pattern id="zp-fire" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#7c2d12" opacity="0.5" />
        <circle cx="6" cy="6" r="3" fill="#f97316" opacity="0.5" className="zp-f1" />
        <circle cx="17" cy="15" r="4" fill="#fbbf24" opacity="0.4" className="zp-f2" />
      </pattern>
      <pattern id="zp-fog" width="30" height="30" patternUnits="userSpaceOnUse">
        <rect width="30" height="30" fill="#64748b" opacity="0.4" />
        <ellipse cx="10" cy="12" rx="9" ry="4" fill="#cbd5e1" opacity="0.35" className="zp-drift" />
        <ellipse cx="22" cy="22" rx="8" ry="3.4" fill="#e2e8f0" opacity="0.3" className="zp-drift2" />
      </pattern>
      <pattern id="zp-dark" width="28" height="28" patternUnits="userSpaceOnUse">
        <rect width="28" height="28" fill="#05030f" />
        <ellipse cx="9" cy="11" rx="8" ry="5" fill="#1e1b4b" opacity="0.5" className="zp-drift" />
        <ellipse cx="21" cy="21" rx="7" ry="4.5" fill="#2e1065" opacity="0.45" className="zp-drift2" />
      </pattern>
      <pattern id="zp-ice" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#0c4a6e" opacity="0.4" />
        <path d="M4 20 20 4M4 4l6 6M20 20l-6-6" stroke="#7dd3fc" strokeWidth="1" opacity="0.5" />
      </pattern>
      <pattern id="zp-web" width="26" height="26" patternUnits="userSpaceOnUse">
        <rect width="26" height="26" fill="#475569" opacity="0.5" />
        <path d="M0 0 26 26M26 0 0 26M13 0v26M0 13h26" stroke="#f1f5f9" strokeWidth="1" opacity="0.8" />
        <circle cx="13" cy="13" r="4" fill="none" stroke="#f1f5f9" strokeWidth="0.8" opacity="0.7" />
        <circle cx="13" cy="13" r="7.5" fill="none" stroke="#f1f5f9" strokeWidth="0.6" opacity="0.5" />
      </pattern>
      <pattern id="zp-radiant" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#713f12" opacity="0.3" />
        <path d="M12 2v20M2 12h20" stroke="#fde047" strokeWidth="1" opacity="0.35" />
      </pattern>
      <pattern id="zp-necro" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#1a2e05" opacity="0.6" />
        <circle cx="8" cy="8" r="2" fill="#4d7c0f" opacity="0.5" /><circle cx="18" cy="17" r="2.6" fill="#365314" opacity="0.6" />
      </pattern>
      <pattern id="zp-poison" width="26" height="26" patternUnits="userSpaceOnUse">
        <rect width="26" height="26" fill="#14532d" opacity="0.45" />
        <circle cx="8" cy="9" r="3" fill="#22c55e" opacity="0.4" className="zp-f1" /><circle cx="19" cy="18" r="2" fill="#4ade80" opacity="0.35" className="zp-f2" />
      </pattern>
      <pattern id="zp-thorns" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#1a2e05" opacity="0.35" />
        <path d="M4 20c3-6 5-8 8-8M12 22c2-5 5-7 9-7" stroke="#65a30d" strokeWidth="1.4" fill="none" opacity="0.6" />
      </pattern>
      <pattern id="zp-water" width="26" height="26" patternUnits="userSpaceOnUse">
        <rect width="26" height="26" fill="#0c4a6e" opacity="0.4" />
        <path d="M0 8q6-4 13 0t13 0M0 18q6-4 13 0t13 0" stroke="#38bdf8" strokeWidth="1" fill="none" opacity="0.5" />
      </pattern>
      <pattern id="zp-storm" width="30" height="30" patternUnits="userSpaceOnUse">
        <rect width="30" height="30" fill="#1e1b4b" opacity="0.4" />
        <path d="M4 10l4 6h3l-3 8 9-11h-4l3-6" stroke="#a78bfa" strokeWidth="1.2" fill="none" opacity="0.6" />
      </pattern>
    </defs>
  );
}

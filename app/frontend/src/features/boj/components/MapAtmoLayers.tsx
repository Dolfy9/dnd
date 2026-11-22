import { memo, useId } from "react";
import type { MapV2, MapPaintStroke } from "../model/mapV2";
import { assetUrl } from "../../mapeditor/assets/manifest";
import { useMapManifests, PX } from "./MapV2Layers";
import "./mapAtmo.css";

export const GLOW = "/repo/11_Mapy/bojove/ovl/zar.webp";
const color = (value?: string) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffb85c";
const clamp = (n: number, fallback: number, max = 1) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback;

export const MapPaintLayer = memo(function MapPaintLayer({ map, preview }: { map: MapV2; preview?: MapPaintStroke }) {
  const { textures } = useMapManifests();
  const uid = useId().replace(/:/g, "");
  const W = (map.mrizka[0]?.length || 1) * PX, H = map.mrizka.length * PX;
  return <svg width={W} height={H} overflow="hidden" pointerEvents="none" data-map-paint>
    {(preview ? [...(map.malba || []), preview] : map.malba || []).map((s, i) => {
      const t = textures[s.t];
      if (!t || !s.p.length) return null;
      const id = uid + "-" + i, blur = (1 - s.h) * s.b * PX * .18;
      const d = s.p.map(([x, y], j) => `${j ? "L" : "M"}${x * PX},${y * PX}`).join(" ")
        + (s.p.length === 1 ? "l.001,0" : "");
      return <g key={s.id}>
        <defs>
          <pattern id={id + "tex"} width={t.cells * PX} height={t.cells * PX} patternUnits="userSpaceOnUse">
            <image href={assetUrl(t.src)} width={t.cells * PX} height={t.cells * PX} />
          </pattern>
          <filter id={id + "blur"} filterUnits="userSpaceOnUse" x={-PX * 8} y={-PX * 8} width={W + PX * 16} height={H + PX * 16} colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
          <mask id={id + "mask"} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <path d={d} fill="none" stroke="white" strokeWidth={s.b * PX} strokeLinecap="round" strokeLinejoin="round"
              filter={blur ? `url(#${id}blur)` : undefined} />
          </mask>
        </defs>
        <rect width={W} height={H} fill={`url(#${id}tex)`} mask={`url(#${id}mask)`} opacity={s.o} />
      </g>;
    })}
  </svg>;
});

export function visualLights(map: MapV2) {
  return [...(map.svetla || []), ...(map.objekty || []).filter(o => o.light && !o.dmOnly).map(o => ({
    id: "object-" + o.id, x: o.x, y: o.y, bright: o.light!.bright, dim: o.light!.dim,
    color: "#ffac52", intenzita: 1, blikani: true,
  }))].map(l => ({ ...l, color: color(l.color), intenzita: clamp(l.intenzita ?? 1, 1),
    bright: clamp(l.bright, 0, 500) / 5 * PX,
    radius: (clamp(l.bright, 0, 500) + clamp(l.dim, 0, 500)) / 5 * PX }));
}

export const MapAtmosphereLayer = memo(function MapAtmosphereLayer({ map }: { map: MapV2 }) {
  const uid = useId().replace(/:/g, "");
  const W = (map.mrizka[0]?.length || 1) * PX, H = map.mrizka.length * PX;
  const lights = visualLights(map).filter(l => l.radius > 0 && l.intenzita > 0);
  const amb = clamp(map.atmosfera?.amb ?? 1, 1);
  if (amb === 1 && !lights.length) return null;
  const sprite = (l: typeof lights[number], radius: number) => ({
    href: GLOW, x: l.x * PX - radius, y: l.y * PX - radius, width: radius * 2, height: radius * 2,
  });
  return <svg width={W} height={H} overflow="hidden" pointerEvents="none" data-map-atmosphere>
    <defs>
      <filter id={uid + "black"} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
      {lights.map((l, i) => <filter key={l.id} id={uid + "tint" + i} colorInterpolationFilters="sRGB">
        <feFlood floodColor={l.color} /><feComposite in2="SourceAlpha" operator="in" />
      </filter>)}
      <mask id={uid + "dark"} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
        <rect width={W} height={H} fill="white" />
        {lights.map((l, i) => <g key={l.id} opacity={l.intenzita}>
          <g className={l.blikani ? "map-light-flicker" : undefined} style={{ animationDelay: `-${i * .73}s` }}>
          <image {...sprite(l, l.radius)} filter={`url(#${uid}black)`} />
          {l.bright > 0 && <image {...sprite(l, l.bright)} filter={`url(#${uid}black)`} />}
          </g>
        </g>)}
      </mask>
    </defs>
    <rect width={W} height={H} fill={color(map.atmosfera?.barva || "#101522")}
      opacity={1 - amb} mask={`url(#${uid}dark)`} />
    {lights.map((l, i) => <g key={l.id} opacity={l.intenzita * .48} style={{ mixBlendMode: "screen" }}>
      <g className={l.blikani ? "map-light-flicker" : undefined} style={{ animationDelay: `-${i * .73}s` }}>
      <image {...sprite(l, l.radius)} filter={`url(#${uid}tint${i})`} />
      </g>
    </g>)}
  </svg>;
});

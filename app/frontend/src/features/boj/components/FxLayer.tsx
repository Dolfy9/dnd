/* FX vrstva: projektily, slash oblouk, AoE bloom, plovoucí čísla, shake.
   Respektuje prefers-reduced-motion (kratší/žádná animace). */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { FxEvent } from "../types";
import { dmgStyle } from "./visual";

const RM = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const TTL: Record<string, number> = RM
  ? { slash: 300, bolt: 350, projectile: 350, aoe: 400, dmg: 900, heal: 900, miss: 700, crit: 900, zone: 400, shake: 250 }
  : { slash: 650, bolt: 900, projectile: 900, aoe: 1100, dmg: 1500, heal: 1500, miss: 1000, crit: 1400, zone: 800, shake: 450 };

function subscribeMotion(callback: () => void) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("map-animations", callback); window.addEventListener("storage", callback); media.addEventListener("change", callback);
  return () => { window.removeEventListener("map-animations", callback); window.removeEventListener("storage", callback); media.removeEventListener("change", callback); };
}
const motionOn = () => localStorage.getItem("montelien-map-animations") !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
function Live({ e, px, k = 1, done, motion }: { e: FxEvent; px: number; k?: number; done: (id: string) => void; motion: boolean }) {
  const sc = Math.min(2.2, Math.max(0.6, 1 / k)); // konstantní on-screen velikost textů
  useEffect(() => {
    const t = setTimeout(() => done(e.id), TTL[e.typ] || 800);
    return () => clearTimeout(t);
  }, [e.id, e.typ, done]);
  const F = (p?: [number, number]) => p ? [(p[0] + 0.5) * px, (p[1] + 0.5) * px] : [0, 0];
  const [x1, y1] = F(e.from), [x2, y2] = F(e.to || e.at);
  const ds = dmgStyle(e.dmgType);
  if (!motion && !["dmg", "heal", "miss", "crit"].includes(e.typ)) return e.from && e.to ? <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ds.c} strokeWidth={2 * sc} opacity={0.7} /> : null;
  switch (e.typ) {
    case "slash": {
      const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      return (
        <g><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ds.c} strokeWidth={2 * sc} opacity={0.65} /><g className="bfx-slash" transform={`translate(${x2},${y2}) rotate(${ang})`}>
          <path d={`M ${-px * 0.55} ${-px * 0.35} A ${px * 0.65} ${px * 0.65} 0 0 1 ${px * 0.55} ${-px * 0.35}`}
                fill="none" stroke={ds.c} strokeWidth={4} strokeLinecap="round" />
          <path d={`M ${-px * 0.4} ${-px * 0.15} A ${px * 0.45} ${px * 0.45} 0 0 1 ${px * 0.4} ${-px * 0.15}`}
                fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        </g></g>
      );
    }
    case "bolt": case "projectile": {
      return (
        <g className="bfx-proj">
          <line x1={x1} y1={y1} x2={x1} y2={y1} stroke={ds.c} strokeWidth={e.typ === "bolt" ? 5 : 2.5} strokeLinecap="round">
            <animate attributeName="x2" from={x1} to={x2} dur={`${(TTL[e.typ] || 800) * 0.6}ms`} fill="freeze" />
            <animate attributeName="y2" from={y1} to={y2} dur={`${(TTL[e.typ] || 800) * 0.6}ms`} fill="freeze" />
          </line>
          <circle r={e.typ === "bolt" ? 6 : 4} fill={ds.c}>
            <animate attributeName="cx" from={x1} to={x2} dur={`${(TTL[e.typ] || 800) * 0.6}ms`} fill="freeze" />
            <animate attributeName="cy" from={y1} to={y2} dur={`${(TTL[e.typ] || 800) * 0.6}ms`} fill="freeze" />
          </circle>
        </g>
      );
    }
    case "aoe": {
      const r = (e.area?.size || 5) / 5 * px;
      const [ax, ay] = F(e.area?.anchor);
      return (
        <g className="bfx-aoe">
          <circle cx={ax} cy={ay} r={4} fill={ds.c} opacity={0.5}>
            <animate attributeName="r" from={4} to={r} dur="500ms" fill="freeze" />
            <animate attributeName="opacity" from={0.65} to={0.12} dur={`${TTL.aoe}ms`} fill="freeze" />
          </circle>
          <circle cx={ax} cy={ay} r={4} fill="none" stroke={ds.c} strokeWidth={3} opacity={0.9}>
            <animate attributeName="r" from={4} to={r} dur="500ms" fill="freeze" />
            <animate attributeName="opacity" from={0.9} to={0} dur={`${TTL.aoe}ms`} fill="freeze" />
          </circle>
        </g>
      );
    }
    case "dmg": case "heal": {
      const isHeal = e.typ === "heal";
      const c = isHeal ? "#4ade80" : e.dmgType === "Immune" ? "#60a5fa" : e.dmgType === "Resist" ? "#f59e0b" : ds.c;
      return (
        <g><circle className="bfx-hit-flash" cx={x2} cy={y2} r={px * .48} fill={isHeal ? "#4ade8055" : "#fbbf2455"} stroke={c} strokeWidth={3 * sc} /><text x={x2} y={y2 - 6} textAnchor="middle" className="bfx-num"
              fill={c} stroke="#000" strokeWidth={3.5 * sc} paintOrder="stroke"
              fontSize={(e.dmgType === "Immune" || e.dmgType === "Resist" ? 18 : 26) * sc} fontWeight={900}>
          {isHeal ? e.text : e.dmgType === "Immune" ? "Immune" : e.dmgType === "Resist" ? `Resist ${e.text}` : `−${e.text}`}
        </text></g>
      );
    }
    case "miss":
      return (
        <g><circle className="bfx-hit-flash" cx={x2} cy={y2} r={px * .48} fill="#94a3b833" stroke="#94a3b8" strokeWidth={2 * sc} /><text x={x2} y={y2 - 4} textAnchor="middle" className="bfx-num bfx-miss"
              fill="#cbd5e1" stroke="#000" strokeWidth={3 * sc} paintOrder="stroke" fontSize={20 * sc} fontWeight={800}>
          {e.text || "Mine"}
        </text></g>
      );
    case "crit":
      return (
        <g className="bfx-crit" transform={`translate(${x2},${y2 - px * 0.5})`}>
          <path d="M0,-14 L3.5,-4 L14,-4 L5.5,2.5 L9,13 L0,6.5 L-9,13 L-5.5,2.5 L-14,-4 L-3.5,-4 Z"
                fill="#f59e0b" stroke="#fff" strokeWidth={1} />
          <text y={-20} textAnchor="middle" fill="#fde047" stroke="#000" strokeWidth={3} paintOrder="stroke" fontSize={34 * sc} fontWeight={900}>{e.text || "KRIT!"}</text>
        </g>
      );
    case "shake":
      return null; // shake se aplikuje na coin přes tokenId — zde jen text
    default:
      return e.text ? (
        <text x={x2} y={y2 - 4} textAnchor="middle" className="bfx-num" fill={ds.c} stroke="#000" strokeWidth={3 * sc} paintOrder="stroke" fontSize={20 * sc} fontWeight={800}>{e.text}</text>
      ) : null;
  }
}

export default function FxLayer({ events, px, k = 1, onDone, shakingIds }: {
  events: FxEvent[]; px: number; k?: number; onDone: (ids: string[]) => void; shakingIds: Set<string>;
}) {
  const [live, setLive] = useState<Set<string>>(new Set());
  const motion = useSyncExternalStore(subscribeMotion, motionOn, () => false);
  useEffect(() => {
    if (events.length) setLive((s) => new Set([...s, ...events.map((e) => e.id)]));
  }, [events]);
  const done = (id: string) => {
    setLive((s) => { const n = new Set(s); n.delete(id); return n; });
    onDone([id]);
  };
  void shakingIds;
  return (
    <g className="boj-fx" data-motion={motion ? "on" : "off"} pointerEvents="none">
      {events.filter((e) => live.has(e.id)).map((e) => <Live key={e.id} e={e} px={px} k={k} done={done} motion={motion} />)}
    </g>
  );
}

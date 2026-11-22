/* Mince žetonu (coin) — prémiový SVG token: portrét/emblem, kovový lem, HP oblouk,
   condition badge kolečka, concentration prstenec, stavové vizuály. */
import { useId } from "react";
import { publicHpFraction } from "./combatHudModel";
import type { Token } from "../types";
import { CONDITIONS, hasCond, isProne } from "../rules/conditions";
import { SIDE_STYLE } from "./visual";
import { Engraved, emblemFor, dupNumber } from "./emblems";

/** Výchozí ořez portrétu: hlava/hrudník (full-body portréty mají obličej ~28 % shora). */
export const PORTRAIT_DEFAULT = { x: 0.5, y: 0.28, zoom: 1.7 };
export const fokusOf = (t: Token) => t.portretFokus || PORTRAIT_DEFAULT;

interface Props {
  t: Token;
  px: number;               // průměr za buňku (vizuální, ~0.94 kroku)
  step?: number;            // krok mřížky (PX) — pro centrovaní na buňku
  active: boolean;
  selected: boolean;
  hovered: boolean;
  dm: boolean;              // ukazovat čísla HP
  dead?: boolean;
  lab?: number;             // counter-scale (1/zoom) pro badges/jmenovky — konstantní on-screen
  names?: "hover" | "always";
  plateClamp?: [number, number]; // viditelné meze ve world px — jmenovka se clapne do obrazu
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const hpFrac = (t: Token) => Math.max(0, Math.min(1, t.hp / Math.max(1, t.max)));
const hpColor = (f: number) => f > 0.5 ? "#4ade80" : f > 0.25 ? "#f59e0b" : "#ef4444";

export default function TokenCoin({ t, step, active, selected, hovered, dm, lab = 1, names = "hover", plateClamp }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const st = step || 48; // krok buňky — coin je centrovaný na buňku, ne na škálovanou mřížku
  const D = t.s * st * 0.9; // mince vyplní ~90 % své plochy (HP oblouk uvnitř lemu)
  const R = D / 2;
  const cx = (t.x ?? 0) * st + (t.s * st) / 2;
  const cy = (t.y ?? 0) * st + (t.s * st) / 2;
  const side = SIDE_STYLE[t.side] || SIDE_STYLE.neutral;
  const prone = isProne(t) && !t.dead;
  const invis = hasCond(t, "Invisible") && !t.dead;
  const dying = t.dying && !t.dead;
  const ring = 2 * Math.PI * (R - 3);
  const health = dm ? hpFrac(t) : publicHpFraction(t);
  const hpLen = health * ring * 0.75; // oblouk 270°
  const tmpLen = dm && t.tmp > 0 ? Math.min(ring * 0.25, (t.tmp / Math.max(1, t.max)) * ring * 0.75) : 0;
  const conds = (t.cond || []).filter((c) => c.n !== "Exhaustion");
  const shown = conds.slice(0, 5);
  const extra = conds.length - shown.length;
  const cls = ["boj-coin",
    active ? "is-active" : "", selected ? "is-sel" : "", hovered ? "is-hover" : "",
    t.dead ? "is-dead" : "", prone ? "is-prone" : "", invis ? "is-invis" : "", dying ? "is-dying" : "",
    t.skryty ? "is-hidden" : ""].filter(Boolean).join(" ");
  const portUrl = t.portret ? (/^(https?:)?\//.test(t.portret) ? t.portret : `/repo/${t.portret}`) : null;
  const fok = fokusOf(t);
  const faceR = R - 5.4;
  const B = faceR * 2 * Math.max(1, fok.zoom); // box portrétu = obličej × zoom
  const dup = dupNumber(t);
  const faceTint = t.side === "nepratele" ? "#f2cfc4" : "#e8e0cd";
  return (
    <g className={cls} transform={`translate(${cx},${cy})${prone ? " scale(1,0.82) rotate(-8)" : ""}`}
       opacity={invis ? 0.45 : t.dead ? 0.75 : 1} data-tid={t.id}>
      {/* stín + glow */}
      <circle r={R} fill="#000" opacity={0.35} cy={2.5} />
      {active && <><circle r={R + 5} fill="none" stroke="#071019" strokeWidth={6} /><circle r={R + 5} fill="none" stroke="#f8d477" strokeWidth={2.8} /></>}
      {selected && <circle r={R + 2.5} fill="none" stroke="#eab308" strokeWidth={2.4} strokeDasharray="6 3" className="boj-coin-selring" />}
      {/* reeded hrana */}
      <circle r={R} fill={`url(#rim-${t.side})`} />
      <circle r={R - 0.6} fill="none" stroke="#0008" strokeWidth={1} strokeDasharray="1.5 1.8" opacity={0.7} />
      {/* smaltový prstenec strany */}
      <circle r={R - 3} fill="none" stroke={side.ring} strokeWidth={2.2} opacity={0.95} />
      {/* obličej */}
      <g filter={t.dead ? "url(#coin-grey)" : undefined}>
      {portUrl ? (
        <>
          <clipPath id={`clip-${uid}`}><circle r={faceR} /></clipPath>
          <image href={portUrl} x={-fok.x * B} y={-fok.y * B} width={B} height={B}
                 preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-${uid})`} />
          <circle r={faceR} fill="url(#coin-vign)" />
        </>
      ) : (
        <>
          <circle r={faceR} fill={`url(#face-${t.side})`} />
          <circle r={faceR * 0.82} fill="none" stroke="#0006" strokeWidth={1.2} />
          <g transform={`scale(${faceR / 10}) translate(-12,-12)`} opacity={0.97}>
            <Engraved color={faceTint}>{emblemFor(t)}</Engraved>
          </g>
          <circle r={faceR} fill="url(#coin-vign)" opacity={0.5} />
        </>
      )}
      </g>
      {/* číslo duplikátu na lemu (Guard 1/2/3…) */}
      {dup != null && (
        <g transform={`translate(0,${-R}) scale(${lab})`}>
          <circle r={9} fill={`url(#rim-${t.side})`} stroke="#000a" strokeWidth={1} />
          <circle r={7.4} fill="#16130f" stroke={side.ring} strokeWidth={0.8} />
          <text textAnchor="middle" dy={3.6} fontSize={11} fill="#e8e0cd" fontWeight={800}>{dup}</text>
        </g>
      )}
      {/* HP oblouk (od -225° po 270°) + temp */}
      <circle r={R - 3} fill="none" stroke="#071019" strokeWidth={4} />
      <circle r={R - 3} fill="none" stroke={t.dead ? "#666" : hpColor(health)} strokeWidth={2.8}
              strokeDasharray={`${hpLen} ${ring}`} transform="rotate(135)" strokeLinecap="round" />
      {tmpLen > 0 && (
        <circle r={R - 3} fill="none" stroke="#60a5fa" strokeWidth={2.2}
                strokeDasharray={`${tmpLen} ${ring}`} transform="rotate(45)" strokeLinecap="round" />
      )}
      {/* concentration: rotující tečkovaný zlatý prstenec */}
      {t.conc && <circle r={R + 6} fill="none" stroke="#f5d76e" strokeWidth={1.6} strokeDasharray="0.5 4.5" strokeLinecap="round" className="boj-conc-ring" />}
      {/* elevation */}
      {(t.elev || 0) > 0 && (
        <g transform={`translate(${R * 0.72},${-R * 0.72}) scale(${lab})`}>
          <circle r={9.5} fill="#1e293b" stroke="#7dd3fc" strokeWidth={1.2} />
          <text textAnchor="middle" dy={3.4} fontSize={11} fill="#7dd3fc" fontWeight={700}>{t.elev}′</text>
        </g>
      )}
      {/* condition badges kolem spodního okraje */}
      {shown.map((c, i) => {
        const ang = (200 + i * 28) * Math.PI / 180;
        const bx = Math.cos(ang) * (R + 4), by = Math.sin(ang) * (R + 4);
        return (
          <g key={c.n + i} transform={`translate(${bx},${by}) scale(${lab})`}>
            <circle r={8.5} fill="#312e81" stroke="#c7d2fe" strokeWidth={1} />
            <text textAnchor="middle" dy={4.2} fontSize={10}>{CONDITIONS[c.n]?.icon || "?"}</text>
            {c.lvl ? <text textAnchor="middle" dy={14.5} fontSize={9} fill="#fde68a" fontWeight={800} stroke="#000" strokeWidth={2} paintOrder="stroke">{c.lvl}</text> : null}
          </g>
        );
      })}
      {extra > 0 && (
        <g transform={`translate(${Math.cos(340 * Math.PI / 180) * (R + 4)},${Math.sin(340 * Math.PI / 180) * (R + 4)}) scale(${lab})`}>
          <circle r={8.5} fill="#334155" stroke="#94a3b8" strokeWidth={1} />
          <text textAnchor="middle" dy={4} fontSize={10} fill="#e2e8f0" fontWeight={800}>+{extra}</text>
        </g>
      )}
      {/* dead / dying overlay — prasklá mince, tvář zůstává čitelná (šedá) */}
      {t.dead && (
        <g pointerEvents="none">
          <circle r={faceR} fill="#0f172a" opacity={0.35} />
          <path d={`M${-R * 0.55},${-R * 0.6} l${R * 0.3},${R * 0.28} l${-R * 0.12},${R * 0.3} l${R * 0.28},${R * 0.2} l${-R * 0.08},${R * 0.3}`}
                stroke="#cbd5e1" strokeWidth={1.1} fill="none" opacity={0.8} strokeLinecap="round" />
          <path d={`M${R * 0.5},${-R * 0.65} l${-R * 0.2},${R * 0.3} l${R * 0.15},${R * 0.35}`}
                stroke="#94a3b8" strokeWidth={0.9} fill="none" opacity={0.6} strokeLinecap="round" />
          <g transform={`translate(${R * 0.58},${R * 0.58}) scale(${lab})`}>
            <circle r={9} fill={`url(#rim-${t.side})`} stroke="#000a" strokeWidth={0.9} />
            <circle r={7.2} fill="#16130f" />
            <text textAnchor="middle" dy={3.6} fontSize={10}>💀</text>
          </g>
        </g>
      )}
      {dying && (
        <g>
          <circle r={R - 5.4} fill="#0f172a" opacity={0.4} />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${(i - 1) * 8},${R - 8})`}>
              <circle r={2.6} fill={t.ds.s > i ? "#4ade80" : t.ds.f > i ? "#ef4444" : "#1e293b"} stroke="#0008" strokeWidth={0.6} />
            </g>
          ))}
        </g>
      )}
      {/* jmenovka — konstantní on-screen velikost, pilulka pro kontrast */}
      {(names === "always" || hovered || selected || active) && !t.dead && (() => {
        const plateW = Math.max(68, t.nazev.length * 8) * lab;
        const dx = plateClamp ? clamp(0, plateClamp[0] + plateW / 2 - cx, plateClamp[1] - plateW / 2 - cx) : 0;
        return (
        <g transform={`translate(${dx},${R + 3}) scale(${lab})`} className="boj-coin-name">
          <rect x={-Math.max(34, t.nazev.length * 4)} y={0} width={Math.max(68, t.nazev.length * 8)} height={dm ? 30 : 18} rx={9}
                fill="#0f172ae6" stroke="#334155" strokeWidth={0.8} />
          <text textAnchor="middle" dy={13} fontSize={11.5} fill="#f1f5f9" fontWeight={700}>{t.nazev}</text>
          {dm && <text textAnchor="middle" dy={25} fontSize={10.5} fill="#94a3b8">{t.hp}{t.tmp ? `+${t.tmp}` : ""}/{t.max} · AC {t.ac}</text>}
        </g>
        );
      })()}
    </g>
  );
}

/** <defs> s gradienty — jednou na mapu. */
export function CoinDefs() {
  return (
    <defs>
      <radialGradient id="coin-vign" cx="0.5" cy="0.42" r="0.75">
        <stop offset="0.62" stopColor="#0000" /><stop offset="1" stopColor="#0009" />
      </radialGradient>
      <filter id="coin-grey"><feColorMatrix type="saturate" values="0" /></filter>
      {(["druzina", "nepratele", "neutral"] as const).map((s) => {
        const c = SIDE_STYLE[s];
        return (
          <g key={s}>
            <linearGradient id={`rim-${s}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={c.rim} /><stop offset="0.45" stopColor="#d7d3c8" />
              <stop offset="0.55" stopColor={c.rim} /><stop offset="1" stopColor="#3f3a30" />
            </linearGradient>
            <radialGradient id={`face-${s}`} cx="0.38" cy="0.35" r="0.85">
              <stop offset="0" stopColor="#4b463c" /><stop offset="1" stopColor="#1c1a16" />
            </radialGradient>
          </g>
        );
      })}
    </defs>
  );
}

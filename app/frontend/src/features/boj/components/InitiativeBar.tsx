/* Iniciativní pás nahoře: mini-mince (portrét/emblem, lem strany, HP oblouk),
   kolo, další tah, hod iniciativy. */
import { useId } from "react";
import type { StavBoje, Token } from "../types";
import { byId, cur } from "../rules/turn";
import { hasCond, isProne } from "../rules/conditions";
import { SIDE_STYLE } from "./visual";
import { sg } from "../types";
import { Engraved, emblemFor, dupNumber } from "./emblems";
import { fokusOf } from "./TokenCoin";
import { Dices, SkipForward, RotateCcw, RotateCw } from "lucide-react";

/** Mini mince pro iniciativní pás (44px SVG). */
export function MiniCoin({ t, size = 40, active }: { t: Token; size?: number; active?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const side = SIDE_STYLE[t.side] || SIDE_STYLE.neutral;
  const R = 20;
  const ring = 2 * Math.PI * (R - 3);
  const frac = Math.max(0, Math.min(1, t.hp / Math.max(1, t.max)));
  const hpC = t.dead ? "#666" : frac > 0.5 ? "#4ade80" : frac > 0.25 ? "#f59e0b" : "#ef4444";
  const portUrl = t.portret ? (/^(https?:)?\//.test(t.portret) ? t.portret : `/repo/${t.portret}`) : null;
  const fok = fokusOf(t);
  const fR = R - 5, B = fR * 2 * Math.max(1, fok.zoom);
  const dup = dupNumber(t);
  return (
    <svg width={size} height={size} viewBox="-24 -24 48 48" className={`boj-minicoin${active ? " on" : ""}`}>
      <defs><filter id={`mcg-${uid}`}><feColorMatrix type="saturate" values="0" /></filter></defs>
      {active && <circle r={R + 3} fill="none" stroke={side.glow} strokeWidth={2.5} className="boj-coin-pulse" />}
      <circle r={R} fill={side.rim} />
      <circle r={R - 0.6} fill="none" stroke="#0008" strokeWidth={1} strokeDasharray="1.5 1.8" opacity={0.7} />
      <circle r={R - 3} fill="none" stroke={side.ring} strokeWidth={2} />
      <g filter={t.dead ? `url(#mcg-${uid})` : undefined}>
      {portUrl ? (
        <>
          <clipPath id={`mc-${uid}`}><circle r={fR} /></clipPath>
          <image href={portUrl} x={-fok.x * B} y={-fok.y * B} width={B} height={B}
                 preserveAspectRatio="xMidYMid slice" clipPath={`url(#mc-${uid})`} />
        </>
      ) : (
        <>
          <circle r={fR} fill="#2a2721" />
          <circle r={fR * 0.82} fill="none" stroke="#0006" strokeWidth={0.8} />
          <g transform={`scale(${fR / 12}) translate(-12,-12)`} opacity={0.97}>
            <Engraved color={t.side === "nepratele" ? "#f2cfc4" : "#e8e0cd"}>{emblemFor(t)}</Engraved>
          </g>
        </>
      )}
      </g>
      {dup != null && (
        <g transform={`translate(0,${-R + 1.5})`}>
          <circle r={6} fill={side.rim} stroke="#000a" strokeWidth={0.7} />
          <circle r={4.9} fill="#16130f" />
          <text textAnchor="middle" dy={3.2} fontSize={9} fill="#e8e0cd" fontWeight={800}>{dup}</text>
        </g>
      )}
      {isProne(t) && !t.dead && <circle r={R} fill="#0f172a" opacity={0.25} />}
      {hasCond(t, "Invisible") && !t.dead && <circle r={R} fill="#e0e7ff" opacity={0.3} />}
      <circle r={R - 3} fill="none" stroke="#0007" strokeWidth={2} />
      <circle r={R - 3} fill="none" stroke={hpC} strokeWidth={2}
              strokeDasharray={`${frac * ring * 0.75} ${ring}`} transform="rotate(135)" strokeLinecap="round" />
      {t.conc && <circle r={R + 1.5} fill="none" stroke="#f5d76e" strokeWidth={1.2} strokeDasharray="0.5 4" strokeLinecap="round" className="boj-conc-ring" />}
      {t.dead && (
        <g>
          <circle r={fR} fill="#0f172a" opacity={0.35} />
          <path d="M-8,-9 l4.5,4.5 -2,4.5 4,3" stroke="#cbd5e1" strokeWidth={0.9} fill="none" opacity={0.8} />
          <g transform="translate(9,9)">
            <circle r={5.5} fill={side.rim} stroke="#000a" strokeWidth={0.7} />
            <circle r={4.4} fill="#16130f" />
            <text textAnchor="middle" dy={2.2} fontSize={6}>💀</text>
          </g>
        </g>
      )}
    </svg>
  );
}

export default function InitiativeBar({ S, sel, onSelect, onNext, onRoll, onUndo, onRedo, canUndo, canRedo, saving, dm, onRound }: {
  S: StavBoje; sel: string | null;
  onSelect: (id: string) => void;
  onNext: () => void; onRoll: () => void;
  onUndo: () => void; onRedo: () => void;
  canUndo: boolean; canRedo: boolean; saving: boolean; dm?: boolean; onRound?: (d: number) => void;
}) {
  const c = cur(S);
  const started = S.round >= 1 && S.turn >= 0;
  return (
    <div className="boj-init">
      <div className="boj-round">
        <b>{started ? `Kolo ${S.round}` : "Příprava"}</b>
        {dm && onRound && <span className="boj-round-ctl">
          <button title="Kolo −1" onClick={() => onRound(-1)}>−</button>
          <button title="Kolo +1" onClick={() => onRound(1)}>+</button>
        </span>}
        {saving && <i className="boj-saving">ukládám…</i>}
      </div>
      <div className="boj-init-strip">
        {S.ord.map((id, i) => {
          const t = byId(S, id);
          if (!t) return null;
          const frac = Math.max(0, Math.min(1, t.hp / Math.max(1, t.max)));
          const hpC = t.dead ? "#64748b" : frac > 0.5 ? "#4ade80" : frac > 0.25 ? "#f59e0b" : "#ef4444";
          return (
            <button key={id} className={`boj-init-item ${i === S.turn ? "on" : ""} ${t.dead ? "dead" : ""} ${sel === id ? "sel" : ""}`}
                    onClick={() => onSelect(id)}
                    title={`${t.nazev} — init ${t.init ?? "?"}${t.dead ? " (mrtvý)" : ""}`}>
              <MiniCoin t={t} size={i === S.turn ? 56 : 44} active={i === S.turn} />
              <span className="boj-init-name">{t.nazev}</span>
              <span className="boj-init-meta">
                <i className="boj-init-num">{t.init ?? "–"}</i>
                {dm && <span className="boj-init-hp" title={`${t.hp}${t.tmp ? `+${t.tmp}` : ""}/${t.max} HP`}><i style={{ width: `${frac * 100}%`, background: hpC }} /></span>}
              </span>
            </button>
          );
        })}
        {!S.ord.length && <span className="boj-init-empty">Přidej účastníky →</span>}
      </div>
      {dm !== false && (
        <div className="boj-init-actions">
          <button className="boj-btn2" onClick={onUndo} disabled={!canUndo} title="Zpět (Ctrl+Z)"><RotateCcw size={14} /></button>
          <button className="boj-btn2" onClick={onRedo} disabled={!canRedo} title="Vpřed (Ctrl+Shift+Z)"><RotateCw size={14} /></button>
          <button className="boj-btn2 pri" onClick={onRoll} title="Hodit iniciativu za všechny"><Dices size={14} /> Iniciativa</button>
          <button className="boj-btn2 acc" onClick={onNext} disabled={!S.ord.length} title={c ? `Další tah (teď: ${c.nazev})` : "Další tah"}>
            <SkipForward size={14} /> {S.legendaryWindow ? "Pokračovat" : c ? <>Další<span className="boj-init-next"> ({c.nazev.split(" ")[0]})</span></> : "Začít"}
          </button>
        </div>
      )}
    </div>
  );
}

export function EcoPips({ S, t }: { S: StavBoje; t: Token }) {
  const e = S.eco[t.id];
  if (!e) return null;
  const mv = Math.max(0, (t.speed || 0) + e.dash * (t.speed || 0) - e.moved);
  const Pip = ({ ok, l }: { ok: boolean; l: string }) => <i className={ok ? "on" : ""} title={l}>{l[0]}</i>;
  return (
    <div className="boj-eco">
      <span title="Action"><Pip ok={!e.a} l="Akce" /></span>
      <span title="Bonus Action"><Pip ok={!e.b} l="Bonus" /></span>
      <span title="Reaction"><Pip ok={!e.r} l="Reakce" /></span>
      <span title="Object Interaction"><Pip ok={!e.objInt} l="Objekt" /></span>
      <b title="Zbývající pohyb">{mv} ft</b>
    </div>
  );
}
export { sg };

/* Dialog řešení útoku/oblasti: adv/dis důvody jako chips (přepínatelné), kryt,
   AC, šance, hodit / ruční hodnoty fyzických kostek, per-target náhled, Apply. */
import { useEffect, useMemo, useState } from "react";
import { slotsLeft } from "../state/commands";
import type { AttackDef, BattleMapData, StavBoje } from "../types";
import { evaluateAttack } from "../rules/attack";
import { evalSave } from "../rules/saves";
import { byId } from "../rules/turn";
import { settingsOf } from "../rules/settings";
import { dmgStyle } from "./visual";
import { Dices, Keyboard, X } from "lucide-react";

export interface ResolveAttack { kind: "attack"; atk: AttackDef; srcId: string; tgtId: string; force?: boolean }
export interface ResolveArea { kind: "area"; atk: AttackDef; srcId: string; spec: { shape: any; size: number; anchor: [number, number]; dir?: number }; tgtIds: string[]; slot?: number; force?: boolean }
export type Resolve = ResolveAttack | ResolveArea;

export default function ResolveDialog({ S, map, r, onApply, onClose }: {
  S: StavBoje; map: BattleMapData; r: Resolve;
  onApply: (opts: { overrideAdv?: number | null; manualD20?: number; manualDmg?: number }) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  const [adv, setAdv] = useState<number | null>(null);
  const [slot, setSlot] = useState<number>(r.atk.lvl || 0);
  const [manual, setManual] = useState(() => settingsOf(S).automatizace.hodUtoku === "rucne");
  const [d20v, setD20v] = useState("");
  const [dmgv, setDmgv] = useState("");
  const A = byId(S, r.srcId);
  const tgt = r.kind === "attack" ? byId(S, r.tgtId) : undefined;
  const ev = useMemo(() => {
    if (r.kind !== "attack" || !A || !tgt) return null;
    return evaluateAttack({ attacker: A, target: tgt, atk: r.atk, map, tokens: S.tok, overrideAdv: adv, state: S, teren: S.teren });
  }, [S, map, r, A, tgt, adv]);
  if (!A) return null;
  const ds = dmgStyle(r.atk.typ);
  const opts = {
    slot: slot === -1 ? undefined : slot || undefined, pact: slot === -1,
    overrideAdv: adv,
    manualD20: manual && d20v ? Number(d20v) : undefined,
    manualDmg: manual && dmgv ? Number(dmgv) : undefined,
  };
  return (
    <div className="boj-modal" onClick={onClose}>
      <div className="boj-modal-in" onClick={(e) => e.stopPropagation()}>
        <div className="boj-modal-head" style={{ borderColor: ds.c }}>
          <span className="boj-modal-ico" style={{ background: ds.bg, color: ds.c }}>{ds.icon}</span>
          <b>{r.atk.nazev}</b>
          <span>{A.nazev}{tgt ? ` → ${tgt.nazev}` : ` → ${(r as ResolveArea).tgtIds.length} cílů`}</span>
          <button className="boj-x" onClick={onClose}><X size={14} /></button>
        </div>

        {r.kind === "attack" && ev && tgt && (
          <>
            <div className="boj-chips">
              {ev.advSources.map((s) => <i key={s} className="adv" onClick={() => setAdv(adv === -1 ? null : -1)} title="přepnout na Dis">+ {s}</i>)}
              {ev.disSources.map((s) => <i key={s} className="dis" onClick={() => setAdv(adv === 1 ? null : 1)} title="přepnout na Adv">− {s}</i>)}
              {!ev.advSources.length && !ev.disSources.length && <i>rovný hod</i>}
              {adv != null && <i className="man">ručně: {adv > 0 ? "Advantage" : "Disadvantage"}</i>}
              <i className="cov">{ev.coverText}</i>
            </div>
            <div className="boj-res-row">
              <span>vzdálenost <b>{ev.dist} ft</b>{ev.longRange ? " (dlouhý)" : ""}</span>
              <span>{ev.acBreak}</span>
              <span>šance <b className={ev.hitChance > 0.6 ? "ok" : ev.hitChance < 0.35 ? "bad" : ""}>{Math.round(ev.hitChance * 100)}%</b></span>
              <span>EV <b>{ev.expectedDmg.toFixed(1)}</b></span>
            </div>
          </>
        )}

        {r.kind === "area" && (
          <div className="boj-res-targets">
            {r.tgtIds.map((id) => {
              const T = byId(S, id); if (!T) return null;
              const sv = r.atk.save && r.atk.dc ? evalSave(T, r.atk.save, r.atk.dc, {}) : null;
              return (
                <div key={id} className="boj-res-tgt">
                  <b>{T.nazev}</b>
                  {sv && <span>{r.atk.save} {sv.bonus >= 0 ? "+" : ""}{sv.bonus} vs {r.atk.dc}{sv.autoFail ? " (autofail)" : ` — fail ${Math.round(sv.pf * 100)}%`}{r.atk.half ? " · half" : ""}</span>}
                  {r.atk.condOnHit?.map((c) => <i key={c.n}>→ {c.n}</i>)}
                </div>
              );
            })}
            {!r.tgtIds.length && <i className="boj-none">nikdo v oblasti</i>}
          </div>
        )}

        {r.atk.lvl != null && r.atk.lvl > 0 && (
          <div className="boj-res-row">
            <span>slot</span>
            <select className="boj-slot-sel" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
              {Array.from({ length: (A.slots?.length || 0) }, (_, i) => i + 1)
                .filter((l) => l >= r.atk.lvl! && slotsLeft(A, l) > 0)
                .map((l) => <option key={l} value={l}>{l}. úroveň ({slotsLeft(A, l)} volných)</option>)}
              {A.pact && A.pact.used < A.pact.max && A.pact.lvl >= r.atk.lvl && (
                <option value={-1}>Pact {A.pact.lvl}. ({A.pact.max - A.pact.used}×)</option>
              )}
            </select>
          </div>
        )}
        <label className="boj-manual"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> <Keyboard size={13} /> Ruční hodnoty (fyzické kostky)</label>
        {manual && (
          <div className="boj-manual-row">
            {r.kind === "attack" && <label>d20 <input type="number" min={1} max={20} value={d20v} onChange={(e) => setD20v(e.target.value)} placeholder="–" /></label>}
            <label>damage <input type="number" min={0} value={dmgv} onChange={(e) => setDmgv(e.target.value)} placeholder="auto" /></label>
          </div>
        )}

        <div className="boj-modal-foot">
          <button className="boj-btn2" onClick={onClose}>Zrušit</button>
          <button className="boj-btn2 acc" onClick={() => onApply(opts)}>
            <Dices size={14} /> {r.kind === "attack" ? "Hodit útok" : `Zásah ${r.tgtIds.length}×`}
          </button>
        </div>
      </div>
    </div>
  );
}

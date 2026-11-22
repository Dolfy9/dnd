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
import type { ResolutionDraft, ResolutionOptions } from "../state/resolution";

export interface ResolveAttack { kind: "attack"; atk: AttackDef; srcId: string; tgtId: string; extraTgtIds?: string[]; slot?: number; pact?: boolean; force?: boolean; meta?: string[] }
export interface ResolveArea { kind: "area"; atk: AttackDef; srcId: string; spec: { shape: any; size: number; anchor: [number, number]; dir?: number }; tgtIds: string[]; slot?: number; pact?: boolean; force?: boolean; meta?: string[] }
export type Resolve = ResolveAttack | ResolveArea;

export default function ResolveDialog({ S, map, r, draft, onApply, onAdjust, onCommit, onClose, initialOptions }: {
  S: StavBoje; map: BattleMapData; r: Resolve;
  draft?: ResolutionDraft | null;
  onApply: (opts: ResolutionOptions) => void;
  onAdjust: (opts: ResolutionOptions) => void;
  onCommit: () => void;
  onClose: () => void;
  initialOptions?: ResolutionOptions;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  const [adv, setAdv] = useState<number | null>(null);
  const [slot, setSlot] = useState<number>(r.pact ? -1 : r.slot || r.atk.lvl || 0);
  const [manual, setManual] = useState(() => !!initialOptions?.manualD20 || initialOptions?.manualDmg != null || settingsOf(S).automatizace.hodUtoku === "rucne");
  const [d20v, setD20v] = useState(String(initialOptions?.manualD20 ?? ""));
  const [dmgv, setDmgv] = useState(String(initialOptions?.manualDmg ?? ""));
  const [override, setOverride] = useState(!!initialOptions?.override);
  const [collapsed, setCollapsed] = useState(false);
  const A = byId(S, r.srcId);
  const tgt = r.kind === "attack" ? byId(S, r.tgtId) : undefined;
  const ev = useMemo(() => {
    if (r.kind !== "attack" || !A || !tgt) return null;
    return evaluateAttack({ attacker: A, target: tgt, atk: r.atk, map, tokens: S.tok, overrideAdv: adv, state: S, teren: S.teren });
  }, [S, map, r, A, tgt, adv]);
  if (!A) return null;
  const ds = dmgStyle(r.atk.typ);
  const opts = {
    override,
    slot: slot === -1 ? undefined : slot || undefined, pact: slot === -1,
    overrideAdv: adv,
    manualD20: manual && d20v ? Number(d20v) : undefined,
    manualDmg: manual && dmgv ? Number(dmgv) : undefined,
  };
  const canLucky = !!(A as any).zdroje?.some((z: any) => /lucky|luck/i.test(z.nazev) && z.max - z.used > 0) || (A.feats || []).some((f: string) => /^lucky$/i.test(f));
  return (
    <section className="boj-resolution-dock" aria-label="Vyhodnocení akce">
      <div className="boj-modal-in">
        <div className="boj-modal-head" style={{ borderColor: ds.c }}>
          <span className="boj-modal-ico" style={{ background: ds.bg, color: ds.c }}>{ds.icon}</span>
          <b>{r.atk.nazev}</b>
          <span>{A.nazev}{tgt ? ` → ${tgt.nazev}` : ` → ${(r as ResolveArea).tgtIds.length} cílů`}</span>
          <button className="boj-mini" aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)}>{collapsed ? "Rozbalit" : "Sbalit"}</button>
          <button className="boj-x" onClick={onClose}><X size={14} /></button>
        </div>

        {!collapsed && <>
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

        {r.kind === "area" && !draft && (
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
        <div className="boj-luck-row">
          {canLucky && <>
            <button className="boj-mini" title="Lucky: vlastní hod s výhodou" onClick={() => { setAdv(1); onApply({ ...opts, overrideAdv: 1, lucky: "adv" }); }}>🍀 Lucky +Adv</button>
            <button className="boj-mini" title="Lucky: nevýhoda na tento hod" onClick={() => { setAdv(-1); onApply({ ...opts, overrideAdv: -1, lucky: "dis" }); }}>🍀 Lucky +Dis</button>
          </>}
          {!!A.heroicInspiration && r.kind === "attack" && (
            <button className="boj-mini" title="Heroic Inspiration: přehoď d20" onClick={() => onApply({ ...opts, manualD20: undefined, inspire: true })}>✦ Přehodit</button>
          )}
        </div>
        <label className="boj-manual"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> <Keyboard size={13} /> Ruční hodnoty (fyzické kostky)</label>
        {manual && (
          <div className="boj-manual-row">
            {r.kind === "attack" && <label>d20 <input type="number" min={1} max={20} value={d20v} onChange={(e) => setD20v(e.target.value)} placeholder="–" /></label>}
            <label>damage <input type="number" min={0} value={dmgv} onChange={(e) => setDmgv(e.target.value)} placeholder="auto" /></label>
          </div>
        )}
        <label className="boj-manual"><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} /> PJ: obejít omezení</label>
        {draft && <div className="combat-results" aria-live="polite">
          {draft.error && <p role="alert" className="bad">{draft.error}</p>}
          {draft.results.map((result, i) => <article className={`combat-result is-${result.outcome}`} key={`${result.tokenId}:${i}`}>
            <header><b>{byId(S, result.tokenId)?.nazev || result.tokenId}</b><strong>{{ hit: "ZÁSAH", miss: "MINUL", crit: "KRITICKÝ ZÁSAH", save: "ZÁCHRANA", heal: "LÉČENÍ", cast: "KOUZLO" }[result.outcome]}</strong></header>
            <small>{result.breakdown}</small>
            {result.parts.map((part, n) => <div className="combat-result-part" key={n}><span>{part.type}</span><span>{part.in} → <b>{part.out}</b>{part.mod && ` · ${part.mod}`}</span></div>)}
            <p>{result.outcome === "heal" ? "+" : "−"}{result.applied} HP{result.outcome !== "heal" && " · po odolnostech, před dočasnými HP"}</p>
            {(r.kind === "area" || r.atk.save) && <div className="combat-result-adjust">
              <label>save d20 <input aria-label={`${byId(S, result.tokenId)?.nazev} save d20`} type="number" min={1} max={20} value={draft.options.manualSaves?.[result.tokenId] ?? ""} placeholder="auto" onChange={e => { const values = { ...draft.options.manualSaves }; if (e.target.value === "") delete values[result.tokenId]; else values[result.tokenId] = Number(e.target.value); onAdjust({ ...draft.options, manualSaves: values }); }} /></label>
              <label>damage před odolností <input aria-label={`${byId(S, result.tokenId)?.nazev} damage`} type="number" min={0} value={draft.options.targetDamage?.[result.tokenId] ?? ""} placeholder="auto" onChange={e => { const values = { ...draft.options.targetDamage }; if (e.target.value === "") delete values[result.tokenId]; else values[result.tokenId] = Number(e.target.value); onAdjust({ ...draft.options, targetDamage: values }); }} /></label>
            </div>}
          </article>)}
          {!draft.error && !draft.results.length && <p>Akce bez zásahu cíle · zkontroluj log po použití.</p>}
          {JSON.stringify(S) !== draft.before && <p className="bad">Boj se změnil. Vyhodnoť akci znovu.</p>}
          {draft.reactions.some(o => !draft.accepted.includes(o.key) && !draft.skipped.includes(o.key)) && <p>Nejdřív vyřeš nebo přeskoč reakce v čekající frontě.</p>}
        </div>}

        <div className="boj-modal-foot">
          <button className="boj-btn2" onClick={onClose}>Zrušit</button>
          <button className="boj-btn2 acc" onClick={() => onApply(opts)}>
            <Dices size={14} /> {draft ? "Vyhodnotit znovu" : r.kind === "attack" ? "Hodit útok" : `Hodit záchrany ${r.tgtIds.length}×`}
          </button>
          {draft && <button className="boj-btn2 pri" disabled={!!draft.error || JSON.stringify(S) !== draft.before || draft.reactions.some(o => !draft.accepted.includes(o.key) && !draft.skipped.includes(o.key))} onClick={onCommit}>Použít výsledek</button>}
        </div>
        </>}
      </div>
    </section>
  );
}

/* Panel aktivního/vybraného účastníka: útoky, kouzla (výběr slotu), standardní
   akce 2024, sloty/zdroje (klikatelné), action economy. Pro hráče read-only. */
import type { AttackDef, StavBoje, Token } from "../types";
import { STD_ACTIONS, ecoOf, moveLeft } from "../rules/turn";
import { featureActions } from "../state/commands/features";
import { METAMAGIC, isSorcerer } from "../rules/actions/features";
import { useState } from "react";
import { slotsLeft } from "../state/commands";
import { dmgStyle, SIDE_STYLE } from "./visual";
import ConditionIcon from "./ConditionIcon";
import { sg } from "../types";
import { Sword, Wand2, Hand, Zap, ChevronRight, Shield } from "lucide-react";
import type { Targeting } from "./BattleMap";
import { isFree } from "../rules/free";
import { actorReason, attackGroup, economyReason, unusableReason, hpDescription, type ActionGroup } from "./combatHudModel";
import { resourceAction } from "../rules/resources";

export default function ActorPanel({ S, t, targeting, onAttack, onStdAction, onResource, onUndoMove, onHoverAtk, dm, playerControl = false, onCheck, onUseItem, onFeature, group = "all", onGroup }: {
  S: StavBoje; t: Token; targeting: Targeting | null;
  onAttack: (atk: AttackDef, opts?: { slot?: number; pact?: boolean; meta?: string[] }) => void;
  onStdAction: (id: string) => void;
  onResource: (idx: number) => void;
  onUndoMove?: () => void;
  onHoverAtk?: (a: AttackDef | null) => void;
  onCheck?: (name: string, mod: number, mode: "adv" | "dis" | "norm") => void;
  onUseItem?: (idx: number, asBA?: boolean) => void;
  onFeature?: (key: string) => void;
  dm: boolean;
  playerControl?: boolean;
  group?: ActionGroup;
  onGroup?: (group: ActionGroup) => void;
}) {
  const [metaSel, setMetaSel] = useState<string[]>([]);
  const [slotFor, setSlotFor] = useState<AttackDef | null>(null);
  const e = ecoOf(S, t);
  const mv = moveLeft(S, t);
  const side = SIDE_STYLE[t.side];
  const canAct = dm || playerControl;
  const matches = (a: AttackDef) => group === "all" || attackGroup(a) === group;
  const actions = (t.atk || []).filter((a) => !a.ba && !a.rea && a.legendaryCost == null && matches(a));
  const bonus = (t.atk || []).filter((a) => a.ba && matches(a));
  const reac = (t.atk || []).filter((a) => a.rea && matches(a));
  const legendary = (t.atk || []).filter((a) => a.legendaryCost != null && matches(a));
  const spells = (t.kouzla || []).filter(matches);
  if (!dm && !playerControl && t.side !== "druzina") return <div className="boj-actor"><h3>{t.nazev}</h3><p>{hpDescription(t)}</p><div className="combat-target-conditions">{t.cond.map((c, i) => <ConditionIcon key={i} n={c.n} lvl={c.lvl} />)}</div><p className="combat-muted">Statistiky a akce tvora spravuje PJ.</p></div>;

  const attackRow = (a: AttackDef, key: number) => {
    const used = a.rc && t.spent?.[a.nazev];
    const reason = unusableReason(S, t, a, canAct);
    const busy = !!reason;
    const ds = dmgStyle(a.typ);
    const active = targeting?.atk === a;
    const leveled = (a.lvl || 0) > 0;
    const noSlots = reason === "Došly sloty";
    const pick = () => {
      if (!canAct) return;
      if (leveled && !a.lvl) return;
      if (leveled && !a.innate && (t.slots?.length || t.pact)) { setSlotFor(slotFor === a ? null : a); return; }
      onAttack(a, metaSel.length ? { meta: metaSel } : undefined);
    };
    return (
      <div key={key} className={`boj-atkwrap ${slotFor === a ? "open" : ""}`}>
        <button className={`boj-atk ${busy ? "off" : ""} ${active ? "on" : ""}`} onClick={pick}
                disabled={!!reason}
                onMouseEnter={() => onHoverAtk?.(a)} onMouseLeave={() => onHoverAtk?.(null)}
                title={reason || a.text || a.nazev}>
          <span className="boj-atk-ico" style={{ background: ds.bg, color: ds.c }}>{ds.icon}</span>
          <span className="boj-atk-name">{a.nazev}{a.n && a.n > 1 ? ` ×${a.n}` : ""}
            <small>{a.legendaryCost != null ? `L · ${a.legendaryCost}` : a.ba ? "B · Bonus" : a.rea ? "R · Reakce" : "A · Action"}{a.melee ? ` · ${a.reach || 5} ft` : a.range ? ` · ${a.range} ft` : ""}</small>
            {reason && <small className="combat-unusable">{reason}</small>}
          </span>
          <span className="boj-atk-meta">
            {a.bonus != null && <b>{sg(a.bonus)}</b>}
            {(a.dmg || a.heal) && <i>{a.dmg || (typeof a.heal === "string" ? a.heal : a.heal ? `${a.heal.dice}${a.heal.flat ? `+${a.heal.flat}` : ""}` : "")}{a.dmg2 ? ` +${a.dmg2}` : ""} {a.typ || "léčení"}</i>}
            {a.save && <i>{a.save} DC {a.dc}</i>}
            {a.rc && <i className="rc">{used ? "recharge…" : `R${a.rc}–6`}</i>}
            {a.xd && <i className="rc">{a.xd}×/Day</i>}
            {noSlots && <i className="rc">∅ sloty</i>}
          </span>
          <ChevronRight size={14} />
        </button>
        {slotFor === a && canAct && (
          <div className="boj-slots-pick">
            {Array.from({ length: t.slots?.length || 0 }, (_, i) => i + 1)
              .filter((l) => l >= (a.lvl || 1))
              .map((l) => {
                const left = t.slots[l - 1].max - t.slots[l - 1].used;
                return (
                  <button key={l} disabled={!left} onClick={() => { setSlotFor(null); onAttack(a, { slot: l, meta: metaSel.length ? metaSel : undefined }); }}
                          title={a.upcast ? `upcast +${(l - (a.lvl || 0))}×${a.upcast.dice}` : `${l}. slot`}>
                    {l}. ({left}×){a.upcast && l > (a.lvl || 0) ? ` +${l - (a.lvl || 0)}${a.upcast.dice}` : ""}
                  </button>
                );
              })}
            {t.pact && t.pact.lvl >= (a.lvl || 1) && (
              <button disabled={t.pact.used >= t.pact.max} onClick={() => { setSlotFor(null); onAttack(a, { pact: true, meta: metaSel.length ? metaSel : undefined }); }}>
                Pact {t.pact.lvl}. ({t.pact.max - t.pact.used}×)
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="boj-actor">
      {onGroup && <nav className="combat-group-tabs" aria-label="Skupiny akcí">{(["all", "a", "b", "r", "legendary"] as const).filter(g => g !== "legendary" || t.legendary).map(g => <button key={g} aria-pressed={group === g} onClick={() => onGroup(g)}>{{ all: "Vše", a: "Action", b: "Bonus", r: "Reaction", legendary: "Legendární" }[g]}</button>)}</nav>}
      <div className="boj-actor-head" style={{ borderColor: side.ring }}>
        <div className="boj-actor-id">
          <b>{t.nazev}</b>
          <span>{side.name} · AC {t.ac} · HP {t.hp}{t.tmp ? `+${t.tmp}` : ""}/{t.max}</span>
          {t.conc && <span className="boj-conc-tag">⛁ {t.conc}</span>}
        </div>
        <div className="boj-eco-row">
          <span title="Action"><i className={e.a ? "off" : ""}>A</i></span>
          <span title="Bonus Action"><i className={e.b ? "off" : ""}>B</i></span>
          <span title="Reaction"><i className={e.r ? "off" : ""}>R</i></span>
          <b title="Zbývající pohyb">{mv} ft</b>
          {(t.extraAtk || 0) > 1 && <span className="boj-atkleft" title="Útoky v rámci Attack akce">⚔ {e.a ? (t.extraAtk || 0) - (e.atkLeft || 0) : 0}/{t.extraAtk}</span>}
        </div>
      </div>
      <div className="boj-sec" style={{ marginTop: -4 }}>
        <span className="boj-move-lab">Pohyb <b>{e.moved}</b> / <b>{e.moved + mv}</b> ft{e.dash ? " (+Dash)" : ""}</span>
        <div className="boj-move-bar" title={`Pohyb tento tah: ${e.moved} / ${e.moved + mv} ft`}>
          <i style={{ width: `${Math.min(100, (e.moved / Math.max(1, e.moved + mv)) * 100)}%` }} />
        </div>
      </div>
      {!!t.cond.length && (
        <div className="boj-actor-conds">{t.cond.map((c, i) => <ConditionIcon key={i} n={c.n} lvl={c.lvl} size={20} />)}</div>
      )}

      {!!actions.length && (
        <div className="boj-sec"><h4><Sword size={12} /> Útoky</h4>{t.multiattack && <p className="combat-muted"><b>Multiattack:</b> {t.multiattack.text}</p>}{actions.map((a, i) => attackRow(a, i))}</div>
      )}
      {!!spells.length && isSorcerer(t) && (
        <div className="boj-sec"><h4>Metamagic</h4>
          <div className="boj-check-grid">
            {METAMAGIC.map((m) => (
              <label key={m.id} className="boj-meta" title={`${m.desc} (${m.cost(1)}+ SP)`}>
                <input type="checkbox" checked={metaSel.includes(m.id)}
                       onChange={(e) => setMetaSel(e.target.checked ? [...metaSel, m.id] : metaSel.filter((x) => x !== m.id))} />
                {m.nazev}
              </label>
            ))}
          </div>
        </div>
      )}
      {!!spells.length && (
        <div className="boj-sec"><h4><Wand2 size={12} /> Kouzla {t.dc ? `(DC ${t.dc})` : ""}</h4>
          {[...new Set(spells.map((a) => a.lvl || 0))].sort().map((lvl) => (
            <div key={lvl} className="boj-splvl">
              <h5>{lvl === 0 ? "Cantripy" : `${lvl}. úroveň`}
                {lvl > 0 && t.slots?.[lvl - 1] && <span className="combat-slot-pips" aria-label={`${t.slots[lvl - 1].max - t.slots[lvl - 1].used}/${t.slots[lvl - 1].max} slotů`}>{Array.from({ length: t.slots[lvl - 1].max }, (_, i) => <i key={i} className={i < t.slots[lvl - 1].used ? "used" : ""} />)}</span>}
                {lvl > 0 && t.slots?.[lvl - 1] && <em title="Volné sloty"> {t.slots[lvl - 1].max - t.slots[lvl - 1].used}/{t.slots[lvl - 1].max}</em>}
                {lvl > 0 && t.pact && lvl === t.pact.lvl && <em title="Pact sloty"> P {t.pact.max - t.pact.used}/{t.pact.max}</em>}
              </h5>
              {spells.filter((a) => (a.lvl || 0) === lvl).map((a, i) => attackRow(a, i))}
            </div>
          ))}
        </div>
      )}
      {!!bonus.length && <div className="boj-sec"><h4><Zap size={12} /> Bonus</h4>{bonus.map((a, i) => attackRow(a, i))}</div>}
      {!!reac.length && <div className="boj-sec"><h4><Shield size={12} /> Reakce</h4>{reac.map((a, i) => attackRow(a, i))}</div>}
      {!!legendary.length && <div className="boj-sec"><h4><Shield size={12} /> Legendární · {Math.max(0, (t.legendary?.max || 0) - (t.legendary?.used || 0))}/{t.legendary?.max || 0}</h4>{legendary.map((a, i) => attackRow(a, i))}</div>}
      {!!t.zdroje.length && t.zdroje.some(z => group === "all" || resourceAction(z.nazev, t).eco === group) && (
        <div className="boj-sec"><h4><Hand size={12} /> Zdroje</h4>
          {t.zdroje.map((z, i) => {
            const act = resourceAction(z.nazev, t); if (group !== "all" && act.eco !== group) return null;
            const reason = actorReason(t, dm) || (!isFree(S) && z.used >= z.max ? "Použití vyčerpána" : undefined) || (act.eco && act.eco !== "free" ? economyReason(S, t, act.eco) : undefined);
            return <button key={i} className="boj-res" disabled={!!reason} title={reason || act.desc} onClick={() => onResource(i)}>
              <span>{z.nazev}<small>{reason || `${act.eco?.toUpperCase() || "—"} · ${act.desc}`}</small></span><b>{z.max - z.used}/{z.max}</b>
            </button>;
          })}
        </div>
      )}
      {canAct && (group === "all" || group === "a") && (
        <div className="boj-sec">
          <h4><Hand size={12} /> Standardní akce</h4>
          <div className="boj-std-grid">
            {STD_ACTIONS.filter((x) => ["dash", "dodge", "disengage", "help", "hide", "ready", "grapple", "shove"].includes(x.id)).map((x) => {
              const reason = !isFree(S) ? actorReason(t, canAct) || economyReason(S, t, "a") : undefined;
              return <button key={x.id} className="boj-std-btn" title={reason || x.desc} disabled={!!reason} onClick={() => onStdAction(x.id)}><b>{x.nazev}</b><small>{reason || `A · ${x.desc}`}</small></button>;
            })}
          </div>
          <details className="combat-more-actions"><summary>Pohyb a další akce</summary><div className="boj-std-grid">{STD_ACTIONS.filter(x => !["attack", "dash", "dodge", "disengage", "help", "hide", "ready", "grapple", "shove"].includes(x.id)).map(x => <button key={x.id} className="boj-std-btn" title={x.desc} onClick={() => onStdAction(x.id)}>{x.nazev}<small>{x.desc}</small></button>)}</div></details>
          {dm && e.moved > 0 && t.startPos && (
            <button className="boj-btn2" style={{ marginTop: 6 }} title="Vrátit žeton na začátek tahu"
                    onClick={() => onUndoMove?.()}>↩ Vrátit pohyb ({e.moved} ft)</button>
          )}
        </div>
      )}
          {!!featureActions(t).length && (
        <div className="boj-sec"><h4>Schopnosti</h4>
          {featureActions(t).map(f => {
            const cost = /^BA/.test(f.desc) ? "b" : /^A:/.test(f.desc) ? "a" : undefined;
            if (group !== "all" && cost !== group) return null;
            const reason = actorReason(t, dm) || (cost ? economyReason(S, t, cost) : undefined);
            return <button key={f.key} className="boj-res" disabled={!!reason} title={reason || f.desc} onClick={() => onFeature?.(f.key)}><span>{f.nazev}<small>{reason || f.desc}</small></span></button>;
          })}
        </div>
      )}
      {!!t.items?.length && (
        <div className="boj-sec"><h4>Předměty</h4>
          {t.items.map((it, i) => (
            <div key={i} className="boj-item-row">
              <span>{it.nazev} <i>×{it.qty}</i></span>
              <span>
                <button className="boj-mini" disabled={!it.qty} title="Použít (akce / podání)" onClick={() => onUseItem?.(i)}>Použít</button>
                <button className="boj-mini" disabled={!it.qty} title="Vypít (Bonus Action)" onClick={() => onUseItem?.(i, true)}>BA</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {onCheck && (
        <div className="boj-sec"><h4>Hody</h4>
          <div className="boj-check-grid">
            {(["STR","DEX","CON","INT","WIS","CHA"] as const).map((ab) => (
              <button key={ab} className="boj-mini" onClick={() => onCheck(ab, (t.mods as any)[ab] || 0, "norm")}>{ab} {((t.mods as any)[ab] || 0) >= 0 ? "+" : ""}{(t.mods as any)[ab] || 0}</button>
            ))}
            {Object.entries(t.skills || {}).filter(([, v]) => (v as number) > (t.mods.DEX || 0)).slice(0, 6).map(([n, v]) => (
              <button key={n} className="boj-mini" onClick={() => onCheck(n, v as number, "norm")}>{n} +{v}</button>
            ))}
            <button className="boj-mini" onClick={() => onCheck("Iniciativa", t.initB || 0, "norm")}>Init +{t.initB || 0}</button>
          </div>
        </div>
      )}
    </div>
  );
}

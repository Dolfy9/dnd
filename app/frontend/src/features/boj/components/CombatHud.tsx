import type { BattleMapData, StavBoje, Token } from "../types";
import { cur, moveLeft } from "../rules/turn";
import { gapFt } from "../rules/grid";
import { coverOf, COVER_TEXT } from "../rules/los";
import { MiniCoin } from "./InitiativeBar";
import ConditionIcon from "./ConditionIcon";
import { hpDescription, pipState, type ActionGroup } from "./combatHudModel";

export function Health({ t, exact }: { t: Token; exact: boolean }) {
  return <div className="combat-health">
    <span>{exact ? <><b>{t.hp}</b> / {t.max} HP{t.tmp > 0 && <em> +{t.tmp} temp</em>}</> : hpDescription(t)}</span>
    {exact && <div className="combat-health-track"><i style={{ width: `${Math.max(0, Math.min(100, t.hp / Math.max(1, t.max) * 100))}%` }} /></div>}
  </div>;
}
export function TurnHud({ S, dm, onGroup, onEnd }: { S: StavBoje; dm: boolean; onGroup: (group: ActionGroup) => void; onEnd: () => void }) {
  const t = cur(S); if (!t) return null;
  return <section className="combat-turn-hud" aria-label="Aktivní tah">
    <MiniCoin t={t} size={46} active exact={dm} />
    <div className="combat-turn-identity"><small>NA TAHU · KOLO {S.round}</small><strong>{t.nazev}</strong><Health t={t} exact={dm} /></div>
    <div className="combat-turn-stats">{dm && <span><b>{t.ac}</b> AC</span>}<span><b>{moveLeft(S, t)}</b> ft</span></div>
    <div className="combat-turn-effects">{t.cond.map((c, i) => <ConditionIcon key={i} n={c.n} lvl={c.lvl} size={19} />)}{t.conc && <span className="combat-concentration" title={String(t.conc)}>◆ Concentration</span>}</div>
    <div className="combat-economy">{(["a", "b", "r", "legendary"] as const).map(group => {
      const p = pipState(S, t, group); if (!p.max) return null;
      const label = { a: "Action", b: "Bonus", r: "Reaction", legendary: "Legendární" }[group];
      return <button key={group} className={p.left ? "available" : "spent"} onClick={() => onGroup(group)} title={`${label}: ${p.left}/${p.max} k dispozici`} aria-label={`${label}: ${p.left}/${p.max}`}>
        <span>{Array.from({ length: p.max }, (_, i) => <i key={i} className={i < p.used ? "used" : ""} />)}</span><small>{label}</small>
      </button>;
    })}</div>
    {dm && <button className="combat-end" onClick={onEnd}>{S.legendaryWindow ? "Pokračovat →" : "Konec tahu →"}</button>}
  </section>;
}
export function TargetHud({ S, t, map, dm }: { S: StavBoje; t?: Token; map: BattleMapData; dm: boolean }) {
  if (!t) return null;
  const a = cur(S), positioned = a && a.id !== t.id && a.x != null && t.x != null;
  return <section className="combat-target-hud" aria-label="Cíl">
    <div className="combat-target-heading"><MiniCoin t={t} size={38} exact={dm} /><div><small>{a?.id === t.id ? "AKTIVNÍ TVOR" : "CÍL / VÝBĚR"}</small><strong>{t.nazev}</strong></div>{dm && <span className="combat-target-ac">{t.ac}<small>AC</small></span>}</div>
    <Health t={t} exact={dm} />
    <div className="combat-target-conditions">{t.cond.map((c, i) => <ConditionIcon key={i} n={c.n} lvl={c.lvl} size={20} />)}{t.conc && <span className="combat-concentration">◆ Concentration</span>}</div>
    {positioned && <footer><span>{gapFt(a, t)} ft</span><span>{COVER_TEXT[coverOf(a, t, map, S.tok, undefined, undefined, S.teren, S.dvere)]}</span></footer>}
  </section>;
}

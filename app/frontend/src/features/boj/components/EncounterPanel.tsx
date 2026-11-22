import { useState } from "react";
import type { StavBoje } from "../types";
import { DMG_TYPES } from "../types";
import { difficulty } from "../rules/encounter";
import { effectiveAc } from "../rules/effects";
import { confirmDialog } from "../../../components/ui";
import * as C from "../state/commands";
import { bulkEncounter, delayEncounter, delayError, reorderEncounter, type BulkAction } from "../state/commands/encounter";
import { encounterEffects, rosterGroups } from "./encounterModel";

export default function EncounterPanel({ S, selected, onSelection, onFocus, cmd, onAdd }: { S: StavBoje; selected: Set<string>; onSelection: (ids: Set<string>) => void; onFocus: (id: string) => void; cmd: (fn: (s: StavBoje) => void) => void; onAdd: () => void }) {
  const [amount, setAmount] = useState(10), [type, setType] = useState("Slashing"), [condition, setCondition] = useState("Prone");
  const [initiative, setInitiative] = useState(10), [grouped, setGrouped] = useState(false), [dragged, setDragged] = useState<string | null>(null);
  const ids = [...selected].filter(id => S.tok.some(t => t.id === id));
  const bulk = async (action: BulkAction) => {
    if ((action.kind === "remove" || action.kind === "kill") && !await confirmDialog({ title: action.kind === "remove" ? "Odebrat tvory" : "Zabít tvory", text: `${ids.length} vybraných tvorů`, danger: true })) return;
    cmd(s => bulkEncounter(s, ids, action));
  };
  const toggle = (id: string) => { const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); onSelection(next); };
  const report = difficulty(S.tok), effects = encounterEffects(S);
  return <section className="encounter-cockpit" aria-label="GM kokpit">
    <header><small>VELENÍ STŘETNUTÍ · POUZE PJ</small><h3>Střetnutí</h3><b>{report.label}</b><span>{report.xp} XP · Nepřátelé: {S.tok.filter(t => t.side === "nepratele" && !t.dead).reduce((n, t) => n + Math.max(0, t.hp), 0)} HP</span><button onClick={onAdd}>+ Přidat tvora</button></header>
    <div className="encounter-selection"><b>Výběr: {ids.length}</b><button onClick={() => onSelection(new Set(S.tok.map(t => t.id)))}>Vše</button><button onClick={() => onSelection(new Set())}>Zrušit výběr</button></div>
    {rosterGroups(S.tok).map(group => <section className="encounter-group" key={`${group.side}:${group.key}`}>
      <h4><input type="checkbox" aria-label={`Vybrat skupinu ${group.name}`} checked={group.tokens.every(t => selected.has(t.id))} onChange={e => { const next = new Set(selected); group.tokens.forEach(t => e.target.checked ? next.add(t.id) : next.delete(t.id)); onSelection(next); }} />{({ druzina: "Družina", nepratele: "Nepřátelé", neutral: "Neutrální" })[group.side]} · {group.name} ×{group.tokens.length}</h4>
      {group.tokens.map(t => <div key={t.id} className={`encounter-row ${selected.has(t.id) ? "selected" : ""}`} data-roster-id={t.id}>
        <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Vybrat ${t.nazev}`} />
        <button className="encounter-identity" onClick={() => onFocus(t.id)}><strong>{t.dead ? "† " : ""}{t.nazev}</strong><span>{t.hp}/{t.max} HP{t.tmp ? ` +${t.tmp}` : ""} · AC {effectiveAc(t)}{t.conc ? ` · ◆ ${t.conc}` : ""}</span><i><em style={{ width: `${Math.max(0, Math.min(100, t.hp / Math.max(1, t.max) * 100))}%` }} /></i><small>{t.cond.map(c => c.n).join(" · ") || "Bez stavů"}{t.ready ? " · Ready" : ""}</small></button>
        <button aria-label={`${t.skryty ? "Odhalit" : "Skrýt"} ${t.nazev}`} onClick={() => cmd(s => bulkEncounter(s, [t.id], { kind: "hidden" }))}>{t.skryty ? "Skrytý" : "Viditelný"}</button>
      </div>)}
    </section>)}
    <fieldset disabled={!ids.length} className="encounter-bulk"><legend>Hromadné akce · {ids.length} tvorů</legend>
      <label>HP <input aria-label="Hodnota HP" type="number" min={1} value={amount} onChange={e => setAmount(Number(e.target.value))} /></label><select aria-label="Typ zranění" value={type} onChange={e => setType(e.target.value)}>{DMG_TYPES.map(d => <option key={d}>{d}</option>)}</select>
      <button disabled={!Number.isFinite(amount) || amount <= 0} onClick={() => bulk({ kind: "damage", amount, type })}>Zranit</button><button disabled={!Number.isFinite(amount) || amount <= 0} onClick={() => bulk({ kind: "heal", amount, type })}>Léčit</button>
      <label>Stav <input aria-label="Stav" value={condition} onChange={e => setCondition(e.target.value)} list="encounter-conditions" /></label><datalist id="encounter-conditions">{["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"].map(c => <option key={c}>{c}</option>)}</datalist>
      <button disabled={!condition.trim()} onClick={() => bulk({ kind: "condition", name: condition.trim(), on: true })}>Přidat stav</button><button disabled={!condition.trim()} onClick={() => bulk({ kind: "condition", name: condition.trim(), on: false })}>Odebrat stav</button><button onClick={() => bulk({ kind: "hidden" })}>Přepnout skrytí</button>
      <label>Iniciativa <input aria-label="Iniciativa" type="number" value={initiative} onChange={e => setInitiative(Number(e.target.value))} /></label><button onClick={() => bulk({ kind: "initiative", value: initiative })}>Nastavit</button><button onClick={() => bulk({ kind: "initiative", grouped })}>Přehodit</button>
      <label className="encounter-wide"><input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} /> Skupinová iniciativa stejných monster</label>
      <button onClick={() => bulk({ kind: "kill" })}>Zabít…</button><button onClick={() => bulk({ kind: "remove" })}>Odebrat…</button>
    </fieldset>
    <section className="encounter-order"><h4>Pořadí iniciativy</h4><small>Přetáhni před jiný řádek; šipky fungují i klávesnicí. Odklad je ruční zásah PJ.</small>
      {S.ord.map((id, i) => { const t = S.tok.find(t => t.id === id); if (!t) return null; return <article key={id} draggable onDragStart={e => { setDragged(id); e.dataTransfer.setData("text/plain", id); }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = dragged || e.dataTransfer.getData("text/plain"); cmd(s => reorderEncounter(s, from, id)); setDragged(null); }}>
        <b>{i === S.turn ? "▶" : i + 1}</b><span>{t.nazev} <small>{t.init ?? "—"}</small></span><button aria-label={`Posunout nahoru ${t.nazev}`} disabled={i === 0} onClick={() => cmd(s => reorderEncounter(s, id, S.ord[i - 1]))}>↑</button><button aria-label={`Posunout dolů ${t.nazev}`} disabled={i === S.ord.length - 1} onClick={() => cmd(s => reorderEncounter(s, id, S.ord[i + 2]))}>↓</button>
        <button disabled={!!delayError(S, id)} title={delayError(S, id) || "Odložit na konec pořadí; aktivní tah se ukončí"} onClick={() => cmd(s => delayEncounter(s, id))}>Odložit</button><button disabled={t.dead} title="Ready používá standardní akci a její ekonomiku" onClick={() => cmd(s => C.cmdStdAction(s, id, "ready"))}>Ready</button>
      </article>; })}
    </section>
    <section className="encounter-effects"><h4>Aktivní efekty · {effects.length}</h4>{!effects.length && <p>Žádné aktivní efekty.</p>}{effects.map(e => <article key={e.id}><b>{e.name}</b><span>{e.source} → {e.target}</span><small>{e.countdown}</small><button aria-label={`Odebrat efekt ${e.name} z ${e.target}`} onClick={() => cmd(s => e.zone ? C.removeZone(s, e.effectId) : C.removeEffect(s, e.targetId, e.effectId))}>Odebrat efekt</button></article>)}</section>
  </section>;
}

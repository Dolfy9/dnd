import { useState } from "react";
import type { StavBoje } from "../types";
import type { Intent, IntentKind } from "../state/useIntents";
import { byId } from "../rules/turn";
import { pendingOf } from "../rules/pending";
import { ownsToken } from "../state/intentModel";

export interface ProposedIntent { tokenId: string; kind: IntentKind; payload: Intent["payload"]; label: string }
export function PlayerIntentConfirm({ proposed, S, submit, onClose }: { proposed: ProposedIntent; S: StavBoje;
  submit: (token: string, kind: IntentKind, payload: Intent["payload"]) => Promise<boolean>; onClose: () => void }) {
  const [attack, setAttack] = useState(""), [damage, setDamage] = useState("");
  const [target, setTarget] = useState(proposed.payload.target_ids?.[0] || "");
  const [busy, setBusy] = useState(false);
  const standard = proposed.payload.action_id?.startsWith("std:");
  const needsTarget = standard && ["std:grapple", "std:shove", "std:help"].includes(proposed.payload.action_id!);
  return <section className="player-intent-confirm" aria-label="Odeslat žádost PJ"><header><b>{proposed.label}</b><button className="boj-x" onClick={onClose}>✕</button></header>
    <p>{byId(S, proposed.tokenId)?.nazev} · PJ žádost zkontroluje před provedením.</p>
    {needsTarget && <label>Cíl <select aria-label="Cíl žádosti" value={target} onChange={e => setTarget(e.target.value)}><option value="">Vyber cíl…</option>{S.tok.filter(t => t.id !== proposed.tokenId).map(t => <option key={t.id} value={t.id}>{t.nazev}</option>)}</select></label>}
    {proposed.kind === "action" && !standard && <div className="boj-manual-row">
      <label>Ruční d20 <input aria-label="Ruční d20" type="number" min={1} max={20} value={attack} onChange={e => setAttack(e.target.value)} placeholder="PJ hodí" /></label>
      <label>Ruční damage <input aria-label="Ruční damage" type="number" min={0} value={damage} onChange={e => setDamage(e.target.value)} placeholder="PJ hodí" /></label>
    </div>}
    <button className="boj-btn2 pri" disabled={busy || !!needsTarget && !target || !!attack && (!Number.isInteger(Number(attack)) || Number(attack) < 1 || Number(attack) > 20) || !!damage && Number(damage) < 0} onClick={async () => {
      setBusy(true);
      const payload = { ...proposed.payload, ...(needsTarget ? { target_ids: [target] } : {}) };
      if (proposed.kind === "action" && !standard) payload.manual_dice = { ...payload.manual_dice, ...(attack ? { attack: Number(attack) } : {}), ...(damage ? { damage: Number(damage) } : {}) };
      if (await submit(proposed.tokenId, proposed.kind, payload)) onClose();
      setBusy(false);
    }}>Odeslat PJ</button>
  </section>;
}

export default function PlayerIntents({ S, userId, intents, cancel, submit, onPreview }: { S: StavBoje; userId: number; intents: Intent[];
  cancel: (id: string) => Promise<void>; submit: (token: string, kind: IntentKind, payload?: Intent["payload"]) => Promise<boolean>; onPreview: (row: Intent) => void }) {
  const [rollType, setRollType] = useState<"check" | "save">("check"), [name, setName] = useState("STR");
  const [tokenId, setTokenId] = useState("");
  const owned = S.tok.filter(t => ownsToken(t, userId));
  const token = owned.find(t => t.id === tokenId) || owned[0];
  const pending = intents.filter(i => i.status === "pending" || i.status === "approved");
  return <section className="player-intents" aria-label="Moje žádosti">
    <h4>Moje žádosti <span>{pending.length}</span></h4>
    {pending.map(row => <article key={row.id}><b>{byId(S, row.token_id)?.nazev} · {row.kind}</b><small>{row.status === "pending" ? "Čeká na PJ" : "Schváleno"}</small><button className="boj-mini" onClick={() => onPreview(row)}>Náhled</button>{row.status === "pending" && <button className="boj-mini" onClick={() => void cancel(row.id)}>Zrušit žádost</button>}</article>)}
    {pendingOf(S).filter(item => ownsToken(byId(S, item.actorId || item.tokenId), userId)).map(item => <article key={item.id}><b>{item.label}</b><small>{byId(S, item.actorId || item.tokenId)?.nazev} · reakce</small>{[true, false].map(accept => <button key={String(accept)} className="boj-mini" disabled={pending.some(i => i.kind === "reaction" && i.payload.pending_id === item.id)} onClick={() => void submit(item.actorId || item.tokenId, "reaction", { pending_id: item.id, accept })}>{accept ? "Přijmout reakci" : "Odmítnout reakci"}</button>)}</article>)}
    {!!owned.length && <details><summary>Volný hod / záchrana</summary><label>Žeton <select aria-label="Žeton hodu" value={token?.id || ""} onChange={e => setTokenId(e.target.value)}>{owned.map(t => <option key={t.id} value={t.id}>{t.nazev}</option>)}</select></label><select aria-label="Druh hodu" value={rollType} onChange={e => setRollType(e.target.value as "check" | "save")}><option value="check">Ověření</option><option value="save">Záchrana</option></select><input aria-label="Název hodu" value={name} onChange={e => setName(e.target.value)} maxLength={200} /><button className="boj-btn2" disabled={!name.trim()} onClick={() => token && void submit(token.id, "roll", { type: rollType, name: name.trim() })}>Požádat o hod</button></details>}
  </section>;
}

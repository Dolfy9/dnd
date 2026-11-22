import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "../../../api";
import { toast } from "../../../components/ui";
import type { BattleMapData, StavBoje } from "../types";
import type { Intent } from "../state/useIntents";
import { intentError, intentResolution } from "../state/intentModel";
import { byId } from "../rules/turn";

export function intentSummary(row: Intent, S: StavBoje) {
  if (row.kind === "move") return `Pohyb · ${Math.max(0, (row.payload.path?.length || 1) - 1)} kroků`;
  if (row.kind === "action") return `${row.payload.action_id?.split(":").slice(1).join(":")} → ${(row.payload.target_ids || []).map(id => byId(S, id)?.nazev || "odebraný cíl").join(", ") || "oblast / vlastní žeton"}`;
  if (row.kind === "reaction") return row.payload.accept ? "Přijmout reakci" : "Odmítnout reakci";
  return { end_turn: "Konec tahu", death_save: "Death save", roll: `Hod · ${row.payload.name}` }[row.kind];
}
export default function IntentRequests({ rows, S, map, onPreview, onApprove, onReject, busy }: { rows: Intent[]; S: StavBoje; map: BattleMapData;
  onPreview: (row: Intent) => void; onApprove: (row: Intent, edit: boolean, override: boolean) => Promise<void>;
  onReject: (row: Intent, note: string) => Promise<void>; busy: boolean }) {
  const players = useQuery({ queryKey: ["battle-players"], queryFn: () => get<{ players: { id: number; name: string; login: string }[] }>("/api/battles/players") });
  const [rejecting, setRejecting] = useState<string | null>(null), [note, setNote] = useState("");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const seen = useRef(new Set<string>());
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (rows.some(r => !seen.current.has(r.id))) setFlash(true);
    rows.forEach(r => seen.current.add(r.id));
    const timer = window.setTimeout(() => setFlash(false), 1800);
    return () => window.clearTimeout(timer);
  }, [rows.map(r => r.id).join(",")]);
  return <section className={`gm-intent-requests ${flash ? "is-new" : ""}`} aria-label="Žádosti hráčů"><header><b>Žádosti hráčů</b><span>{rows.length}</span></header>
    {!rows.length && <small>Žádné čekající žádosti.</small>}
    {rows.map(row => {
      const reason = intentError(S, map, row), player = players.data?.players.find(p => p.id === row.user_id);
      const editable = row.kind === "action" && !!intentResolution(S, row);
      return <article key={row.id} data-intent={row.id}><b>{player?.name || `Hráč #${row.user_id}`} · {byId(S, row.token_id)?.nazev || row.token_id}</b><small>{intentSummary(row, S)}</small>
        {reason && <><p role="alert">{reason}</p><label><input type="checkbox" checked={!!overrides[row.id]} onChange={e => setOverrides(v => ({ ...v, [row.id]: e.target.checked }))} /> PJ: obejít omezení</label></>}
        <div><button className="boj-mini" onClick={() => onPreview(row)}>Náhled</button><button className="boj-mini" disabled={busy || !!reason && !overrides[row.id]} onClick={() => void onApprove(row, false, !!overrides[row.id]).catch(e => toast(String(e), "err"))}>Schválit</button>{editable && <button className="boj-mini" disabled={busy} onClick={() => void onApprove(row, true, !!overrides[row.id]).catch(e => toast(String(e), "err"))}>Upravit</button>}<button className="boj-mini" disabled={busy} onClick={() => { setRejecting(row.id); setNote(""); }}>Zamítnout</button></div>
        {row.kind === "action" && !editable && <small>Schválit provede akci beze změn. Pro jiné parametry žádost zamítněte a zadejte novou.</small>}
        {rejecting === row.id && <div><input aria-label="Důvod zamítnutí" placeholder="Důvod zamítnutí" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /><button className="boj-mini" disabled={!note.trim() || busy} onClick={() => void onReject(row, note.trim()).then(() => setRejecting(null)).catch(e => toast(String(e), "err"))}>Potvrdit zamítnutí</button></div>}
      </article>;
    })}
  </section>;
}

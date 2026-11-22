import { useCallback, useEffect, useRef, useState } from "react";
import { del, get, post } from "../../../api";
import { toast } from "../../../components/ui";

export type IntentKind = "move" | "action" | "end_turn" | "death_save" | "reaction" | "roll";
export interface Intent {
  id: string; user_id: number; token_id: string; kind: IntentKind;
  status: "pending" | "approved" | "rejected" | "cancelled" | "applied";
  note: string; payload: { path?: [number, number][]; action_id?: string; target_ids?: string[];
    aoe?: { anchor: [number, number]; rotation?: number }; manual_dice?: Record<string, number | number[]>;
    pending_id?: string; accept?: boolean; type?: "check" | "save"; name?: string; dc?: number; value?: number };
}
export function useIntents(bid: string, enabled: boolean, gm: boolean) {
  const [intents, setIntents] = useState<Intent[]>([]);
  const seen = useRef(new Map<string, string>());
  const generation = useRef(0);
  const latest = useRef(0);
  const load = useCallback(async () => {
    if (!enabled || !bid) return;
    const epoch = generation.current, request = ++latest.current;
    try {
      const response = await get<{ intents: Intent[] }>(`/api/battles/${bid}/intents`);
      if (epoch !== generation.current || request !== latest.current) return;
      for (const row of response.intents) {
        const previous = seen.current.get(row.id);
        if (!gm && previous && previous !== row.status && ["approved", "rejected", "applied"].includes(row.status))
          toast(`${row.status === "rejected" ? "Zamítnuto" : row.status === "applied" ? "Provedeno" : "Schváleno"}${row.note ? `: ${row.note}` : ""}`, row.status === "rejected" ? "err" : "ok");
        seen.current.set(row.id, row.status);
      }
      setIntents(response.intents);
    } catch (e) { toast(`Žádosti: ${e instanceof Error ? e.message : "načtení selhalo"}`, "err"); }
  }, [bid, enabled, gm]);
  useEffect(() => {
    generation.current++; seen.current.clear(); setIntents([]);
    if (!enabled || !bid) return;
    void load();
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ op: "sub", channel: `battle:${bid}` }));
    ws.onmessage = e => { try { const m = JSON.parse(e.data); if (m.channel === `battle:${bid}` && m.event === "intent") void load(); } catch { /* ignore */ } };
    return () => { generation.current++; ws.close(); };
  }, [bid, enabled, load]);
  const submit = async (token_id: string, kind: IntentKind, payload: Intent["payload"] = {}) => {
    try { await post(`/api/battles/${bid}/intents`, { token_id, kind, payload }); await load(); toast("Čeká na PJ", "ok"); return true; }
    catch (e) { toast(e instanceof Error ? e.message : "Odeslání selhalo", "err"); return false; }
  };
  const cancel = async (id: string) => { try { await del(`/api/battles/${bid}/intents/${id}`); await load(); } catch (e) { toast(String(e), "err"); } };
  const resolve = async (id: string, status: "approved" | "applied" | "rejected", note = "") => {
    await post(`/api/battles/${bid}/intents/${id}/resolve`, { status, note }); await load();
  };
  return { intents, submit, cancel, resolve, load };
}

/* Hlavní hook: načtení/uložení stavu, verzování + 409, WS refetch, undo/redo, FX fronta. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get, put } from "../../../api";
import { toast } from "../../../components/ui";
import type { BattleStateDoc, StavBoje } from "../types";
import { migrate } from "../rules/migrate";

export interface BattleMeta { id: string; nazev?: string; shared?: boolean; mapa?: string }

export function useBattle(bid: string | undefined) {
  const [doc, setDoc] = useState<BattleStateDoc | null>(null);
  const [S, setS] = useState<StavBoje | null>(null);
  const [version, setVersion] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seenFx, setSeenFx] = useState<string[]>([]);
  const SRef = useRef<StavBoje | null>(null);
  const verRef = useRef(0);
  const undoRef = useRef<StavBoje[]>([]);
  const redoRef = useRef<StavBoje[]>([]);
  const saveT = useRef<number | null>(null);
  const loadRef = useRef<() => Promise<void>>();

  const applyRemote = useCallback((d: any) => {
    const sb = migrate(d?.state?.stav_boje ?? d?.stav_boje ?? d ?? {});
    if (!sb.map) sb.map = d?.state?.mapa || d?.mapa || "";
    setDoc(d?.state?.stav_boje ? d : (d?.id ? d : { stav_boje: sb, ...d }));
    setS(sb);
    SRef.current = sb;
    setVersion(d?.version ?? 0);
    verRef.current = d?.version ?? 0;
    setSeenFx((sb.fx || []).map((f: any) => f.id));
  }, []);

  const load = useCallback(async () => {
    if (!bid) return;
    try {
      const d = await get<any>(`/api/battles/${bid}`);
      applyRemote(d);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Načtení boje selhalo");
    }
  }, [bid, applyRemote]);
  loadRef.current = load;

  // WS: version-only událost → refetch (role-filtered)
  useEffect(() => {
    if (!bid) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ op: "sub", channel: `battle:${bid}` }));
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.channel === `battle:${bid}` && m.event === "state" && m.data?.version !== verRef.current) loadRef.current?.();
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, [bid]);

  const saveBusy = useRef(false);
  const saveDirty = useRef(false);
  const save = useCallback(async () => {
    if (!bid || !SRef.current) return;
    if (saveBusy.current) { saveDirty.current = true; return; } // serializace proti 409
    saveBusy.current = true;
    setSaving(true);
    try {
      const stav_boje = SRef.current;
      const r = await put<any>(`/api/battles/${bid}/state`, { state: { stav_boje }, version: verRef.current });
      verRef.current = r.version ?? verRef.current + 1;
      setVersion(verRef.current);
    } catch (e: any) {
      if (e?.status === 409) {
        toast("Souběžná úprava — obnovuji stav", "err");
        await loadRef.current?.();
      } else toast(`Uložení selhalo: ${e?.message || e}`, "err");
    } finally {
      saveBusy.current = false;
      setSaving(false);
      if (saveDirty.current) { saveDirty.current = false; queueSave(); }
    }
  }, [bid]);

  const queueSave = useCallback(() => {
    if (saveT.current) window.clearTimeout(saveT.current);
    saveT.current = window.setTimeout(() => { saveT.current = null; save(); }, 600);
  }, [save]);
  useEffect(() => () => { if (saveT.current) window.clearTimeout(saveT.current); }, []);

  /** dispatch(mutator): mutace kopie stavu + undo snapshot + queue save. */
  const dispatch = useCallback((fn: (S: StavBoje) => void) => {
    setS((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev) as StavBoje;
      undoRef.current.push(prev);
      if (undoRef.current.length > 100) undoRef.current.shift();
      redoRef.current = [];
      fn(next);
      SRef.current = next;
      queueSave();
      return next;
    });
  }, [queueSave]);

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev || !SRef.current) return;
    redoRef.current.push(SRef.current);
    SRef.current = prev;
    setS(prev);
    queueSave();
  }, [queueSave]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next || !SRef.current) return;
    undoRef.current.push(SRef.current);
    SRef.current = next;
    setS(next);
    queueSave();
  }, [queueSave]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === "Z" || (e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  /** Nové FX události k přehrání (dedup přes id). */
  const newFx = useMemo(() => {
    const fx = S?.fx || [];
    const unseen = fx.filter((f) => !seenFx.includes(f.id));
    return unseen;
  }, [S?.fx, seenFx]);
  const markFx = useCallback((ids: string[]) => setSeenFx((p) => [...new Set([...p, ...ids])].slice(-200)), []);

  return { doc, S, version, err, saving, load, dispatch, undo, redo, newFx, markFx, applyRemote };
}

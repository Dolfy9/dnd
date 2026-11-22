/* Hlavní hook: načtení/uložení stavu, verzování + 409, WS refetch, undo/redo, FX fronta. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get, put } from "../../../api";
import { toast } from "../../../components/ui";
import type { BattleStateDoc, StavBoje } from "../types";
import { migrate } from "../rules/migrate";

export interface BattleMeta { id: string; nazev?: string; shared?: boolean; mapa?: string }

export function useBattle(bid: string | undefined, canWrite = true) {
  const writable = useRef(canWrite);
  writable.current = canWrite;
  const waiters = useRef<{ revision: number; done: (ok: boolean) => void }[]>([]);
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
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const remoteVersion = useRef(0);
  const saveBusy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current++;
    revision.current = savedRevision.current = remoteVersion.current = verRef.current = 0;
    saveBusy.current = false;
    SRef.current = null;
    undoRef.current = []; redoRef.current = [];
    if (saveT.current) window.clearTimeout(saveT.current);
    setSaving(false);
    waiters.current.splice(0).forEach(w => w.done(false));
  }, [bid]);
  useEffect(() => {
    if (!canWrite) {
      if (saveT.current) window.clearTimeout(saveT.current);
      waiters.current.splice(0).forEach(w => w.done(false));
    }
  }, [canWrite]);

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

  const load = useCallback(async (force = false) => {
    if (!bid) return;
    const startedAt = revision.current;
    const epoch = generation.current;
    try {
      const d = await get<any>(`/api/battles/${bid}`);
      if (epoch !== generation.current) return;
      if (!force && (startedAt !== revision.current || revision.current !== savedRevision.current || saveBusy.current || d.version < verRef.current)) return;
      savedRevision.current = revision.current;
      applyRemote(d);
      setErr(null);
    } catch (e: any) {
      if (epoch !== generation.current) return;
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
        if (m.channel === `battle:${bid}` && m.event === "state" && m.data?.version > verRef.current) {
          remoteVersion.current = Math.max(remoteVersion.current, m.data.version);
          if (!saveBusy.current && revision.current === savedRevision.current) loadRef.current?.();
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, [bid]);

  const save = useCallback(async () => {
    if (!writable.current || !bid || !SRef.current) return;
    if (saveBusy.current) return;
    saveBusy.current = true;
    const savingRevision = revision.current;
    const epoch = generation.current;
    let acknowledged = false;
    setSaving(true);
    try {
      const stav_boje = SRef.current;
      const r = await put<any>(`/api/battles/${bid}/state`, { state: { stav_boje }, version: verRef.current });
      if (epoch !== generation.current) return;
      verRef.current = r.version ?? verRef.current + 1;
      savedRevision.current = savingRevision;
      acknowledged = true;
      setVersion(verRef.current);
    } catch (e: any) {
      if (epoch !== generation.current) return;
      if (e?.status === 409) {
        toast("Souběžná úprava — obnovuji stav", "err");
        await load(true);
      } else toast(`Uložení selhalo: ${e?.message || e}`, "err");
    } finally {
      if (epoch === generation.current) {
        saveBusy.current = false;
        setSaving(false);
        waiters.current = waiters.current.filter(w => {
          if (!acknowledged || w.revision <= savedRevision.current) { w.done(acknowledged); return false; }
          return true;
        });
        if (revision.current !== savedRevision.current && (acknowledged || revision.current !== savingRevision)) queueSave();
        else if (remoteVersion.current > verRef.current) loadRef.current?.();
      }
    }
  }, [bid, load]);

  const queueSave = useCallback(() => {
    if (!writable.current) return;
    if (saveT.current) window.clearTimeout(saveT.current);
    saveT.current = window.setTimeout(() => { saveT.current = null; save(); }, 600);
  }, [save]);
  useEffect(() => () => { if (saveT.current) window.clearTimeout(saveT.current); }, []);

  /** dispatch(mutator): mutace kopie stavu + undo snapshot + queue save. */
  const dispatch = useCallback((fn: (S: StavBoje) => void) => {
    const prev = SRef.current;
    if (!writable.current || !prev) return;
    const next = structuredClone(prev) as StavBoje;
    undoRef.current.push(prev);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
    fn(next);
    SRef.current = next;
    revision.current++;
    setS(next);
    queueSave();
  }, [queueSave]);

  const undo = useCallback(() => {
    if (!writable.current) return;
    const prev = undoRef.current.pop();
    if (!prev || !SRef.current) return;
    redoRef.current.push(SRef.current);
    SRef.current = prev;
    revision.current++;
    setS(prev);
    queueSave();
  }, [queueSave]);

  const redo = useCallback(() => {
    if (!writable.current) return;
    const next = redoRef.current.pop();
    if (!next || !SRef.current) return;
    undoRef.current.push(SRef.current);
    SRef.current = next;
    revision.current++;
    setS(next);
    queueSave();
  }, [queueSave]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!writable.current) return;
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
  const flush = useCallback((): Promise<boolean> => {
    if (!writable.current) return Promise.resolve(false);
    if (revision.current === savedRevision.current) return Promise.resolve(true);
    return new Promise(done => {
      waiters.current.push({ revision: revision.current, done });
      if (saveT.current) window.clearTimeout(saveT.current);
      void save();
    });
  }, [save]);
  return { doc, S, version, err, saving, load, dispatch, undo, redo, newFx, markFx, applyRemote, flush, getState: () => SRef.current };
}

/* Stav dokumentu editoru: načtení, undo/redo (100), autosave draftu, uložení přes API. */
import { useCallback, useEffect, useRef, useState } from "react";
import { get, put } from "../../../api";
import { toast } from "../../../components/ui";
import { migrateMap, type MapV2 } from "../../boj/model/mapV2";
import { fetchAssetManifest, type AssetEntry } from "../assets/manifest";

const DRAFT = (id: string) => `me-draft:${id}`;

export function useEditorDoc(id: string | undefined) {
  const [map, setMap] = useState<MapV2 | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState<MapV2 | null>(null);
  const undoRef = useRef<MapV2[]>([]);
  const redoRef = useRef<MapV2[]>([]);
  const mapRef = useRef<MapV2 | null>(null);
  const assetsRef = useRef<Record<string, AssetEntry>>({});
  mapRef.current = map;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([get<any>("/api/map/data"), fetchAssetManifest()]).then(([d, assets]) => {
      if (cancelled) return;
      assetsRef.current = assets;
      const m = (d.bojove_mapy || []).find((r: any) => r.id === id)?.data;
      if (!m) { toast("Mapa nenalezena", "err"); return; }
      const mm = migrateMap(m, assets);
      setMap(mm);
      const draft = localStorage.getItem(DRAFT(id));
      if (draft) {
        try {
          const dd = JSON.parse(draft);
          const dm = dd?.map || dd;
          // nabídni jen když se draft liší od uložené verze
          if (dm?.id === id && JSON.stringify(migrateMap(dm, assets)) !== JSON.stringify(mm)) setRestoring({ ...(dd.ts ? { ts: dd.ts } : {}), ...dm } as any);
        } catch { /* */ }
      }
    }).catch((e) => toast(String(e.message || e), "err"));
    return () => { cancelled = true; };
  }, [id]);

  /** Mutace s undo snapshotem + autosave draftu. */
  const push = useCallback((fn: (m: MapV2) => void) => {
    setMap((prev) => {
      if (!prev) return prev;
      const n = JSON.parse(JSON.stringify(prev));
      fn(n);
      undoRef.current.push(prev);
      if (undoRef.current.length > 100) undoRef.current.shift();
      redoRef.current = [];
      setDirty(true);
      try { localStorage.setItem(DRAFT(id!), JSON.stringify({ ts: Date.now(), map: n })); } catch { /* */ }
      return n;
    });
  }, [id]);

  const undo = useCallback(() => {
    const h = undoRef.current.pop(); if (!h || !mapRef.current) return;
    redoRef.current.push(mapRef.current); setMap(h); setDirty(true);
  }, []);
  const redo = useCallback(() => {
    const h = redoRef.current.pop(); if (!h || !mapRef.current) return;
    undoRef.current.push(mapRef.current); setMap(h); setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!mapRef.current || !id) return;
    setSaving(true);
    try {
      await put(`/api/map/bojove/${id}`, mapRef.current);
      localStorage.removeItem(DRAFT(id));
      setDirty(false); toast("Mapa uložena", "ok");
    } catch (e: any) { toast("Uložení selhalo: " + (e.message || e), "err"); }
    setSaving(false);
  }, [id]);

  const restoreDraft = useCallback((yes: boolean) => {
    if (yes && restoring) { setMap(migrateMap(restoring, assetsRef.current)); setDirty(true); }
    else localStorage.removeItem(DRAFT(id!));
    setRestoring(null);
  }, [restoring, id]);

  /** Přímá mutace bez undo (např. live drag); zavolej push při dropu. */
  const live = useCallback((fn: (m: MapV2) => void) => {
    setMap((prev) => {
      if (!prev) return prev;
      const n = { ...prev };
      fn(n);
      setDirty(true);
      return n;
    });
  }, []);

  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);

  return { map, setMap, mapRef, push, live, undo, redo, save, dirty, saving, restoring, restoreDraft,
           canUndo: () => undoRef.current.length > 0, canRedo: () => redoRef.current.length > 0, undoRef, redoRef };
}

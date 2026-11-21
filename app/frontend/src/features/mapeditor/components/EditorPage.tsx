/* /boj/mapa/:id — full-viewport editor bojové mapy (bez AppShell).
   V.k = zoom faktor (1.0 = 24 px/buňka). */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Undo2, Redo2, Save, Maximize, Minimize, Swords, MousePointer2, Brush,
  PaintBucket, Layers3, DoorOpen, Square, Spline, Package, PenLine,
  Mountain, Lightbulb, Flag, StickyNote, Eraser, Pipette, Upload,
} from "lucide-react";
import { post, upload } from "../../../api";
import { toast } from "../../../components/ui";
import { TILES } from "../../boj/types";
import type { MapV2, MapWall, MapDrawing } from "../../boj/model/mapV2";
import { migrateMap, wallUid } from "../../boj/model/mapV2";
import {
  MapTextureLayer, MapElevationLayer, MapWallLayer, MapObjectLayer, MapDrawingLayer,
  MapLightLayer, MapNoteLayer, MapGridLayer, PX, setManifests,
} from "../../boj/components/MapV2Layers";
import { TEXTURES, textureById } from "../assets/textures";
import { stampById } from "../assets/stamps";
import { useAssetManifest, useTextureManifest } from "../assets/manifest";
import { GENERATORS, type GenOut } from "../generators/generators";
import { importUvtt, exportUvtt, exportPng } from "../io/uvtt";
import { useEditorDoc } from "../state/useEditorDoc";
import * as ops from "../tools/ops";
import { TABS, LAYERS, WALL_TYPS, WALL_NAZVY, LayersPanel, LibraryPanel, PropertiesPanel, GeneratorPanel, MapPanel, type TabId } from "./panels";
import "../editor.css";

type Tool = "select" | "teren" | "fill" | "flood" | "textura" | "mistnost" | "stena" | "dvere"
  | "objekt" | "kresba" | "vyska" | "svetlo" | "start" | "poznamka" | "guma" | "kapatko";

const TOOLS: { id: Tool; icon: React.ReactElement; nazev: string; key: string }[] = [
  { id: "select", icon: <MousePointer2 size={18} />, nazev: "Výběr / přesun", key: "V" },
  { id: "teren", icon: <Brush size={18} />, nazev: "Terén", key: "B" },
  { id: "fill", icon: <Square size={18} />, nazev: "Výplň obdélníkem", key: "Shift+B" },
  { id: "flood", icon: <PaintBucket size={18} />, nazev: "Flood fill", key: "G" },
  { id: "textura", icon: <Layers3 size={18} />, nazev: "Textura", key: "X" },
  { id: "mistnost", icon: <DoorOpen size={18} />, nazev: "Místnost", key: "R" },
  { id: "stena", icon: <Spline size={18} />, nazev: "Stěny", key: "W" },
  { id: "dvere", icon: <DoorOpen size={18} />, nazev: "Dveře / okna", key: "D" },
  { id: "objekt", icon: <Package size={18} />, nazev: "Objekt", key: "O" },
  { id: "kresba", icon: <PenLine size={18} />, nazev: "Kreslení", key: "P" },
  { id: "vyska", icon: <Mountain size={18} />, nazev: "Výška", key: "H" },
  { id: "svetlo", icon: <Lightbulb size={18} />, nazev: "Světlo", key: "L" },
  { id: "start", icon: <Flag size={18} />, nazev: "Startovní pozice", key: "S" },
  { id: "poznamka", icon: <StickyNote size={18} />, nazev: "Poznámka DM", key: "N" },
  { id: "guma", icon: <Eraser size={18} />, nazev: "Guma", key: "E" },
  { id: "kapatko", icon: <Pipette size={18} />, nazev: "Kapátko", key: "I" },
];

const START_TYPY = [["druzina", "Družina"], ["nepratele", "Nepřátelé"], ["neutral", "Neutrál"]] as const;
const k2 = (x: number, y: number) => `${x},${y}`;
type Sel = { kind: "objekt" | "kresba" | "stena" | "svetlo" | "poznamka"; id: string };

export default function EditorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const doc = useEditorDoc(id);
  const { map, push, live } = doc;
  const assetsQ = useAssetManifest();
  const texQ = useTextureManifest();
  const ASSETS = assetsQ.data || {};
  useEffect(() => { setManifests(assetsQ.data || {}, texQ.data || {}); }, [assetsQ.data, texQ.data]);

  const [tool, setTool] = useState<Tool>("select");
  const [brushTile, setBrushTile] = useState("#");
  const [brushTex, setBrushTex] = useState(TEXTURES[0].id);
  const [brushSize, setBrushSize] = useState(1);
  const [brushShape, setBrushShape] = useState<"sq" | "circ">("sq");
  const [wallTyp, setWallTyp] = useState<MapWall["typ"]>("wall");
  const [wallLocked, setWallLocked] = useState(false);
  const [stampId, setStampId] = useState("stul-ctverec");
  const [stampQ, setStampQ] = useState("");
  const [stampKat, setStampKat] = useState("");
  const [drawKind, setDrawKind] = useState<MapDrawing["kind"]>("free");
  const [drawColor, setDrawColor] = useState("#c9b489");
  const [drawFill, setDrawFill] = useState("");
  const [drawW, setDrawW] = useState(0.15);
  const [drawDm, setDrawDm] = useState(false);
  const [elevStep, setElevStep] = useState(5);
  const [lightB, setLightB] = useState(20);
  const [lightD, setLightD] = useState(20);
  const [lightColor, setLightColor] = useState("#fbbf24");
  const [startTyp, setStartTyp] = useState<"druzina" | "nepratele" | "neutral">("druzina");
  const [snap, setSnap] = useState<1 | 0.5 | 0>(1);
  const [sel, setSel] = useState<Sel[]>([]);
  const [tab, setTab] = useState<TabId>("vrstvy");
  const [layerVis, setLayerVis] = useState<Record<string, boolean>>(Object.fromEntries(LAYERS.map(([l]) => [l, true])));
  const [genId, setGenId] = useState("dungeon");
  const [genSeed, setGenSeed] = useState(12345);
  const [genPrev, setGenPrev] = useState<GenOut | null>(null);
  const [fs, setFs] = useState(false);
  const [V, setV] = useState({ x: 20, y: 20, k: 1 });
  const [cur, setCur] = useState<{ x: number; y: number } | null>(null);
  const [wallDraft, setWallDraft] = useState<[number, number][]>([]);
  const [dragPt, setDragPt] = useState<{ a: [number, number]; b: [number, number] } | null>(null);
  const [marquee, setMarquee] = useState<{ a: [number, number]; b: [number, number] } | null>(null);
  const [handleDrag, setHandleDrag] = useState<"rot" | "scale" | null>(null);
  const [freePts, setFreePts] = useState<[number, number][]>([]);
  const [noteDraft, setNoteDraft] = useState<{ x: number; y: number; text: string } | null>(null);
  const [calib, setCalib] = useState<{ step: 0 | 1 | 2; pts: [number, number][]; cells: number } | null>(null);
  const [fitted, setFitted] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x0: number; y0: number; vx: number; vy: number } | null>(null);
  const moveRef = useRef<{ anchor: [number, number] } | null>(null);
  const paintRef = useRef(false);
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);

  const W = map?.mrizka?.[0]?.length || 1, H = map?.mrizka?.length || 1;

  /* ---------- view ---------- */
  const fit = useCallback(() => {
    const m = doc.mapRef.current; const wr = wrapRef.current;
    if (!m || !wr) return;
    const w = m.mrizka[0]?.length || 1, h = m.mrizka.length;
    const cw = wr.clientWidth, ch = wr.clientHeight;
    const k = Math.min(cw / (w * PX + 60), ch / (h * PX + 60));
    setV({ k, x: (cw - w * PX * k) / 2, y: (ch - h * PX * k) / 2 });
  }, [doc.mapRef]);
  useLayoutEffect(() => { if (map && !fitted) { fit(); setFitted(true); } }, [map, fitted, fit]);
  const userZoomRef = useRef(false);
  useEffect(() => {
    const onR = () => { if (!userZoomRef.current) fit(); };
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [fit]);

  const zoomAt = useCallback((f: number, cx?: number, cy?: number) => {
    userZoomRef.current = true;
    setV((v) => {
      const nk = Math.min(6, Math.max(.1, v.k * f));
      const r = svgRef.current!.getBoundingClientRect();
      const px = cx ?? r.width / 2, py = cy ?? r.height / 2;
      return { k: nk, x: px - ((px - v.x) / v.k) * nk, y: py - ((py - v.y) / v.k) * nk };
    });
  }, []);
  const toWorld = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left - V.x) / V.k / PX, (e.clientY - r.top - V.y) / V.k / PX];
  };
  const cellOf = (e: { clientX: number; clientY: number }): [number, number] => {
    const [wx, wy] = toWorld(e);
    return [Math.floor(wx), Math.floor(wy)];
  };
  const snapPt = (e: { clientX: number; clientY: number }): [number, number] => {
    const [wx, wy] = toWorld(e);
    const s = snap || 1;
    return snap === 0 ? [wx, wy] : [Math.round(wx / s) * s, Math.round(wy / s) * s];
  };

  /* ---------- IO ---------- */
  const uploadImg = async (f: File) => {
    try {
      const r = await upload<any>(`/api/map/bojove/${id}/obrazek`, f, f.name);
      push((m) => { m.obrazek = r.obrazek; });
      toast("Obrázek nahrán — kalibruj mřížku v záložce Mapa", "ok");
    } catch (e: any) { toast(String(e.message || e), "err"); }
  };
  const uploadAsset = async (f: File) => {
    try {
      const r = await upload<any>("/api/map/bojove/assets", f, f.name);
      push((m) => { m.objekty = [...(m.objekty || []), { id: "o" + Date.now() % 1e6, asset: r.id, x: W / 2, y: H / 2, w: 1, h: 1 }]; });
      assetsQ.refetch();
      toast("Asset nahrán a umístěn", "ok");
    } catch (e: any) { toast(String(e.message || e), "err"); }
  };
  const resize = (dW: number, dH: number, dX: number, dY: number) => push((m) => {
    const nW = Math.max(1, W + dW), nH = Math.max(1, H + dH);
    const nm: string[] = [];
    for (let y = -dY; y < nH - dY; y++) {
      let row = "";
      for (let x = -dX; x < nW - dX; x++) row += m.mrizka[y]?.[x] ?? ".";
      nm.push(row);
    }
    const shiftR = (o: Record<string, any> | undefined) => {
      if (!o) return o; const n: Record<string, any> = {};
      for (const kk in o) { const [x, y] = kk.split(",").map(Number); n[k2(x + dX, y + dY)] = o[kk]; }
      return n;
    };
    m.mrizka = nm; m.textury = shiftR(m.textury) as any; m.vyska = shiftR(m.vyska) as any;
    m.steny = (m.steny || []).map((w) => ({ ...w, a: [w.a[0] + dX, w.a[1] + dY] as [number, number], b: [w.b[0] + dX, w.b[1] + dY] as [number, number] }));
    m.objekty = (m.objekty || []).map((o) => ({ ...o, x: o.x + dX, y: o.y + dY }));
    m.svetla = (m.svetla || []).map((l) => ({ ...l, x: l.x + dX, y: l.y + dY }));
    m.poznamky = (m.poznamky || []).map((n) => ({ ...n, x: n.x + dX, y: n.y + dY }));
    if (m.start) for (const kk in m.start) (m.start as any)[kk] = ((m.start as any)[kk] || []).map(([x, y]: number[]) => [x + dX, y + dY]);
  });
  const download = (content: string, name: string, type = "application/json") => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
  };

  /* ---------- klávesy ---------- */
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") { setSpace(true); e.preventDefault(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doc.redo() : doc.undo(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); doc.redo(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); doc.save(); return; }
      if (e.key === "Escape") { setWallDraft([]); setDragPt(null); setMarquee(null); setSel([]); setCalib(null); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && sel.length) {
        push((m) => { for (const s of sel) { const n = s.kind === "objekt" ? "objekty" : s.kind === "kresba" ? "kresby" : s.kind === "stena" ? "steny" : s.kind === "svetlo" ? "svetla" : "poznamky"; (m as any)[n] = ((m as any)[n] || []).filter((o: any) => o.id !== s.id); } });
        setSel([]); return;
      }
      if (sel.length && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = e.key === "ArrowLeft" ? [-1, 0] : e.key === "ArrowRight" ? [1, 0] : e.key === "ArrowUp" ? [0, -1] : [0, 1];
        push((m) => ops.moveSel(m, sel, d[0], d[1]));
        return;
      }
      const t = TOOLS.find((tt) => tt.key === e.key.toUpperCase() || tt.key === (e.shiftKey ? "Shift+" : "") + e.key.toUpperCase());
      if (t) setTool(t.id);
      if (e.key === "+" || e.key === "=") zoomAt(1.25);
      if (e.key === "-") zoomAt(0.8);
      if (e.key === "0") fit();
    };
    const up2 = (e: KeyboardEvent) => { if (e.key === " ") setSpace(false); };
    window.addEventListener("keydown", dn); window.addEventListener("keyup", up2);
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up2); document.removeEventListener("fullscreenchange", onFs); };
  }, [doc.undo, doc.redo, doc.save, sel, push, fit, zoomAt]);

  /* ---------- pointer ---------- */
  const onDown = (e: React.PointerEvent) => {
    if (e.button === 1 || space || e.button === 2) { panRef.current = { x0: e.clientX, y0: e.clientY, vx: V.x, vy: V.y }; setPanning(true); userZoomRef.current = true; return; }
    const [cx, cy] = cellOf(e);
    paintRef.current = true;
    if (calib && map?.obrazek) {
      const p = snapPt(e);
      const pts = [...calib.pts, p];
      if (pts.length === 2) {
        const dPx = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) * PX;
        const cells = calib.cells || 4;
        push((m) => { m.kalibrace = { cellPx: Math.round(dPx / cells), offX: Math.round(pts[0][0] * PX), offY: Math.round(pts[0][1] * PX) }; });
        toast(`Kalibrace: ${Math.round(dPx / cells)} px/buňku`, "ok");
        setCalib(null);
      } else setCalib({ ...calib, pts });
      return;
    }
    switch (tool) {
      case "teren": push((m) => ops.brushCells(cx, cy, brushSize, brushShape).forEach(([x, y]) => ops.setTile(m, x, y, brushTile))); break;
      case "textura": push((m) => { m.textury = { ...(m.textury || {}) }; ops.brushCells(cx, cy, brushSize, brushShape).forEach(([x, y]) => { m.textury![k2(x, y)] = brushTex; }); }); break;
      case "flood": push((m) => ops.floodFill(m, cx, cy, brushTile)); break;
      case "fill": case "mistnost": setDragPt({ a: [cx, cy], b: [cx, cy] }); break;
      case "stena": {
        const c = snapPt(e);
        setWallDraft((d) => {
          if (d.length > 2 && Math.hypot(d[0][0] - c[0], d[0][1] - c[1]) < .26) { push((m) => ops.wallChain(m, d, wallTyp, wallLocked, true)); return []; }
          if (d.length) { push((m) => ops.wallChain(m, [d[d.length - 1], c], wallTyp, wallLocked)); return [...d, c]; }
          return [c];
        });
        break;
      }
      case "dvere": {
        push((m) => {
          const i = (m.steny || []).findIndex((w) => ops.pointToSeg(cx + .5, cy + .5, w.a, w.b) < .4);
          if (i >= 0) {
            const order: MapWall["typ"][] = ["wall", "door", "window", "half", "curtain", "secret"];
            m.steny![i].typ = order[(order.indexOf(m.steny![i].typ) + 1) % order.length];
          } else {
            const c = snapPt(e);
            m.steny = [...(m.steny || []), { id: wallUid(), a: c, b: [c[0] + 1, c[1]] as [number, number], typ: "door" }];
          }
        });
        break;
      }
      case "objekt": {
        const def = stampById(stampId) || ASSETS[stampId];
        const [fx, fy] = snap === 0 ? snapPt(e) : [cx + .5, cy + .5];
        push((m) => {
          m.objekty = [...(m.objekty || []), {
            id: "o" + Date.now() % 1e6 + Math.floor(Math.random() * 99), asset: stampId,
            x: fx, y: fy, w: def?.w || 1, h: def?.h || 1, blocks: def?.blocks, cover: def?.cover,
            difficult: def?.difficult, light: def?.light,
          }];
        });
        break;
      }
      case "kresba": { const p = snapPt(e); setDragPt({ a: p, b: p }); setFreePts([p]); break; }
      case "vyska": push((m) => { m.vyska = { ...(m.vyska || {}) }; const kk = k2(cx, cy); m.vyska[kk] = (m.vyska[kk] || 0) + (e.altKey ? -elevStep : elevStep); if (!m.vyska[kk]) delete m.vyska[kk]; }); break;
      case "svetlo": push((m) => { m.svetla = [...(m.svetla || []), { id: "l" + Date.now() % 1e6, x: cx + .5, y: cy + .5, bright: lightB, dim: lightD, color: lightColor }]; }); break;
      case "start": push((m) => {
        m.start = { ...(m.start || {}) } as any;
        const arr = ((m.start as any)[startTyp] || []) as [number, number][];
        const i = arr.findIndex(([x, y]) => x === cx && y === cy);
        if (i >= 0) arr.splice(i, 1); else arr.push([cx, cy]);
        (m.start as any)[startTyp] = arr;
      }); break;
      case "poznamka": setNoteDraft({ x: cx + .5, y: cy + .5, text: "" }); break;
      case "guma": push((m) => ops.eraseAt(m, cx, cy)); break;
      case "kapatko": {
        const t = map?.mrizka[cy]?.[cx]; if (t) setBrushTile(t);
        const tx = map?.textury?.[k2(cx, cy)]; if (tx) setBrushTex(tx);
        break;
      }
      case "select": {
        if (!map) break;
        const hit = ops.pickAt(map, cx, cy);
        if (hit) {
          const ns = e.shiftKey ? (sel.some((s) => s.id === hit.id) ? sel.filter((s) => s.id !== hit.id) : [...sel, hit]) : [hit];
          setSel(ns);
          moveRef.current = { anchor: [cx, cy] };
        } else {
          setSel([]);
          setMarquee({ a: [cx, cy], b: [cx, cy] });
        }
        break;
      }
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (panRef.current) {
      setV((v) => ({ ...v, x: panRef.current!.vx + e.clientX - panRef.current!.x0, y: panRef.current!.vy + e.clientY - panRef.current!.y0 }));
      return;
    }
    const [cx, cy] = cellOf(e); setCur({ x: cx, y: cy });
    if (handleDrag && sel.length === 1 && sel[0].kind === "objekt") {
      const [wx, wy] = toWorld(e);
      live((m) => {
        const o = m.objekty!.find((o) => o.id === sel[0].id)!;
        if (handleDrag === "rot") o.rot = Math.round(Math.atan2(wy - o.y, wx - o.x) * 180 / Math.PI + 90);
        else { o.w = Math.max(.25, Math.abs(wx - o.x) * 2); o.h = Math.max(.25, Math.abs(wy - o.y) * 2); }
      });
      return;
    }
    if (moveRef.current && sel.length && map) {
      const [ax, ay] = moveRef.current.anchor;
      const dx = cx - ax, dy = cy - ay;
      if (dx || dy) { live((m) => ops.moveSel(m, sel, dx, dy)); moveRef.current = { anchor: [cx, cy] }; }
      return;
    }
    if (marquee) { setMarquee({ a: marquee.a, b: [cx, cy] }); return; }
    if (dragPt) setDragPt({ a: dragPt.a, b: tool === "kresba" ? snapPt(e) : [cx, cy] });
    if (!paintRef.current) return;
    if (tool === "teren") push((m) => ops.brushCells(cx, cy, brushSize, brushShape).forEach(([x, y]) => ops.setTile(m, x, y, brushTile)));
    else if (tool === "textura") push((m) => { m.textury = { ...(m.textury || {}) }; ops.brushCells(cx, cy, brushSize, brushShape).forEach(([x, y]) => { m.textury![k2(x, y)] = brushTex; }); });
    else if (tool === "kresba" && drawKind === "free") { const p = snapPt(e); setFreePts((p2) => [...p2, p]); }
    else if (tool === "guma") push((m) => ops.eraseAt(m, cx, cy));
  };
  const onUp = (e: React.PointerEvent) => {
    panRef.current = null; setPanning(false); paintRef.current = false;
    if (moveRef.current) { moveRef.current = null; return; }
    if (handleDrag) { setHandleDrag(null); push(() => {}); return; }
    if (marquee) {
      const s = ops.pickInRect(map!, marquee.a, marquee.b);
      setSel(s); setMarquee(null); return;
    }
    if (dragPt) {
      const { a, b } = dragPt; setDragPt(null);
      if (tool === "fill") push((m) => ops.fillRect(m, a, b, brushTile));
      else if (tool === "mistnost") push((m) => ops.roomRect(m, a, b, brushTex));
      else if (tool === "kresba") {
        const pts = drawKind === "free" ? freePts : [a, b];
        if (pts.length >= 2) push((m) => { m.kresby = [...(m.kresby || []), { id: "k" + Date.now() % 1e6, kind: drawKind, pts, stroke: drawColor, fill: drawFill || undefined, width: drawW, dmOnly: drawDm }]; });
        setFreePts([]);
      }
    }
  };
  const onDbl = () => { if (tool === "stena" && wallDraft.length > 1) { push((m) => ops.wallChain(m, wallDraft, wallTyp, wallLocked, false)); setWallDraft([]); } };
  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  };

  /* ---------- render ---------- */
  if (!map) return <div className="me-ed me-loading">Načítám mapu…</div>;
  const selObject = sel.length === 1 && sel[0].kind === "objekt" ? (map.objekty || []).find((o) => o.id === sel[0].id) : null;
  const toolInfo = TOOLS.find((t) => t.id === tool)!;

  return (
    <div className="me-ed">
      <header className="me-ed-head">
        <Link to="/boj/mapy" className="me-btn ghost"><ArrowLeft size={15} /> Zpět</Link>
        <input className="me-name" value={map.nazev} onChange={(e) => push((m) => { m.nazev = e.target.value; })} />
        <span className={`me-savestate ${doc.dirty ? "dirty" : ""}`}>{doc.saving ? "Ukládám…" : doc.dirty ? "Neuloženo" : "Uloženo"}</span>
        <button className="me-btn sm" onClick={doc.undo} title="Zpět (Ctrl+Z)" disabled={!doc.canUndo()}><Undo2 size={15} /></button>
        <button className="me-btn sm" onClick={doc.redo} title="Znovu (Ctrl+Y)" disabled={!doc.canRedo()}><Redo2 size={15} /></button>
        <button className="me-btn sm" title="Fullscreen" onClick={() => fs ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>
          {fs ? <Minimize size={15} /> : <Maximize size={15} />}</button>
        <span className="me-sp" />
        <button className="me-btn primary" onClick={doc.save} title="Ctrl+S"><Save size={15} /> Uložit</button>
        <button className="me-btn" onClick={async () => { await doc.save(); nav("/boj"); }} title="Uložit a otevřít boj"><Swords size={15} /> Otevřít v boji</button>
      </header>

      <div className="me-ed-body">
        <nav className="me-rail">
          {TOOLS.map((t) => (
            <button key={t.id} className={`me-tool ${tool === t.id ? "on" : ""}`}
                    title={`${t.nazev} (${t.key})`} onClick={() => setTool(t.id)}>{t.icon}</button>
          ))}
        </nav>

        <div className="me-center">
          <div className="me-ctx">
            <span className="me-ctx-tool">{toolInfo.nazev}</span>
            {tool === "teren" || tool === "fill" || tool === "flood" ? (
              <>
                <span className="me-ctx-lab">Dlaždice:</span>
                <select value={brushTile} onChange={(e) => setBrushTile(e.target.value)}>
                  {Object.entries(TILES).map(([c, d]) => <option key={c} value={c}>{d.nazev}</option>)}
                </select>
              </>
            ) : null}
            {(tool === "teren" || tool === "textura") && (
              <>
                <span className="me-ctx-lab">Velikost:</span>
                {[1, 2, 3, 5].map((s) => <button key={s} className={`me-btn sm ${brushSize === s ? "on" : ""}`} onClick={() => setBrushSize(s)}>{s}</button>)}
                <button className={`me-btn sm ${brushShape === "sq" ? "on" : ""}`} onClick={() => setBrushShape("sq")} title="Čtverec">▢</button>
                <button className={`me-btn sm ${brushShape === "circ" ? "on" : ""}`} onClick={() => setBrushShape("circ")} title="Kruh">◯</button>
              </>
            )}
            {tool === "textura" && (
              <select value={brushTex} onChange={(e) => setBrushTex(e.target.value)}>
                {TEXTURES.map((t) => <option key={t.id} value={t.id}>{t.nazev}</option>)}
              </select>
            )}
            {tool === "mistnost" && (
              <>
                <span className="me-ctx-lab">Textura:</span>
                <select value={brushTex} onChange={(e) => setBrushTex(e.target.value)}>
                  {TEXTURES.map((t) => <option key={t.id} value={t.id}>{t.nazev}</option>)}
                </select>
                <span className="me-ctx-hint">táhni → podlaha + zdi</span>
              </>
            )}
            {tool === "stena" && (
              <>
                {WALL_TYPS.map((t) => <button key={t} className={`me-btn sm ${wallTyp === t ? "on" : ""}`} onClick={() => setWallTyp(t)}>{WALL_NAZVY[t]}</button>)}
                <label className="me-ctx-chk"><input type="checkbox" checked={wallLocked} onChange={(e) => setWallLocked(e.target.checked)} /> zamčené</label>
                {wallDraft.length > 0 && <button className="me-btn sm" onClick={() => { push((m) => ops.wallChain(m, wallDraft, wallTyp, wallLocked, true)); setWallDraft([]); }}>Uzavřít ({wallDraft.length})</button>}
              </>
            )}
            {tool === "objekt" && <span className="me-ctx-hint">klik = umístit · výběr v Knihovně · V + táhni za úchyty = rotace/škála</span>}
            {tool === "kresba" && (
              <>
                {(["free", "line", "rect", "ellipse", "poly", "text"] as const).map((kd) => (
                  <button key={kd} className={`me-btn sm ${drawKind === kd ? "on" : ""}`} onClick={() => setDrawKind(kd)}>{kd}</button>))}
                <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} title="Barva" />
                <input type="color" value={drawFill || "#000000"} onChange={(e) => setDrawFill(e.target.value)} title="Výplň" />
                <input type="range" min={0.05} max={0.5} step={0.05} value={drawW} onChange={(e) => setDrawW(+e.target.value)} />
                <label className="me-ctx-chk"><input type="checkbox" checked={drawDm} onChange={(e) => setDrawDm(e.target.checked)} /> DM only</label>
              </>
            )}
            {tool === "vyska" && <><span className="me-ctx-lab">Krok:</span>{[5, 10, 20].map((s) => <button key={s} className={`me-btn sm ${elevStep === s ? "on" : ""}`} onClick={() => setElevStep(s)}>{s} ft</button>)}<span className="me-ctx-hint">klik +, Alt+klik −</span></>}
            {tool === "svetlo" && (
              <>
                <span className="me-ctx-lab">Bright</span><input type="number" value={lightB} onChange={(e) => setLightB(+e.target.value)} style={{ width: 48 }} />
                <span className="me-ctx-lab">Dim</span><input type="number" value={lightD} onChange={(e) => setLightD(+e.target.value)} style={{ width: 48 }} />
                <input type="color" value={lightColor} onChange={(e) => setLightColor(e.target.value)} />
              </>
            )}
            {tool === "start" && START_TYPY.map(([v, n]) => <button key={v} className={`me-btn sm ${startTyp === v ? "on" : ""}`} onClick={() => setStartTyp(v as any)}>{n}</button>)}
            <span className="me-sp" />
            <span className="me-ctx-lab me-snaplab">Snap:</span>
            {([1, 0.5, 0] as const).map((s) => <button key={s} className={`me-btn sm ${snap === s ? "on" : ""}`} onClick={() => setSnap(s)}>{s === 0 ? "vyp" : s}</button>)}
            <button className="me-btn sm" onClick={fit} title="Přizpůsobit (0)"><Maximize size={14} /></button>
          </div>

          <div ref={wrapRef} className="me-canvas-wrap">
            <svg ref={svgRef} className={`me-canvas tool-${tool}`} onWheel={onWheel}
                 onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDbl}
                 onPointerLeave={() => setCur(null)} onContextMenu={(e) => e.preventDefault()}
                 style={{ touchAction: "none", width: "100%", height: "100%", display: "block" }}>
              <g transform={`translate(${V.x},${V.y}) scale(${V.k})`}>
                <rect width={W * PX} height={H * PX} fill="#4a453e" />
                {layerVis.obrazek && map.obrazek && <image href={`/repo/11_Mapy/${map.obrazek}`} width={W * PX} height={H * PX} preserveAspectRatio="none" opacity={0.9} />}
                {layerVis.textury && <MapTextureLayer map={map} />}
                {layerVis.teren && map.mrizka.map((row, y) => row.split("").map((c, x) => {
                  const d = TILES[c];
                  if (!d || d.cost) return null;
                  return <rect key={x + "," + y} x={x * PX} y={y * PX} width={PX} height={PX} fill="#000" opacity={0.42} />;
                }))}
                {layerVis.mrizka && <MapGridLayer map={map} W={W} H={H} />}
                {layerVis.vyska && <MapElevationLayer map={map} />}
                {layerVis.kresby && <MapDrawingLayer map={map} dm />}
                {layerVis.steny && <MapWallLayer map={map} dm />}
                {layerVis.objekty && <MapObjectLayer map={map} dm />}
                {layerVis.svetla && <MapLightLayer map={map} />}
                {layerVis.poznamky && <MapNoteLayer map={map} />}
                {layerVis.starty && START_TYPY.map(([typ]) =>
                  ((map.start as any)?.[typ] || []).map(([x, y]: [number, number], i: number) => (
                    <g key={typ + i} transform={`translate(${x * PX + PX / 2},${y * PX + PX / 2})`}>
                      <circle r={8} fill={typ === "druzina" ? "#22c55e" : typ === "nepratele" ? "#ef4444" : "#a8a29e"} opacity={.75} />
                      <text textAnchor="middle" y={3} fontSize={9} fill="#fff" fontWeight={800}>{typ[0].toUpperCase()}</text>
                    </g>)))}
                {/* ghost náhled generátoru */}
                {genPrev && (
                  <g opacity={.55}>
                    {genPrev.mrizka.map((row, y) => row.split("").map((c, x) =>
                      c === "#" ? null : <rect key={`gp${x},${y}`} x={x * PX} y={y * PX} width={PX} height={PX} fill="#f59e0b" opacity={.35} />))}
                    {genPrev.steny.map((w) => <line key={w.id} x1={w.a[0] * PX} y1={w.a[1] * PX} x2={w.b[0] * PX} y2={w.b[1] * PX} stroke="#f59e0b" strokeWidth={3} />)}
                  </g>
                )}
                {wallDraft.length > 0 && <polyline points={wallDraft.map(([x, y]) => `${x * PX},${y * PX}`).join(" ")} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />}
                {dragPt && (tool === "fill" || tool === "mistnost") && (
                  <rect x={Math.min(dragPt.a[0], dragPt.b[0]) * PX} y={Math.min(dragPt.a[1], dragPt.b[1]) * PX}
                        width={(Math.abs(dragPt.b[0] - dragPt.a[0]) + 1) * PX} height={(Math.abs(dragPt.b[1] - dragPt.a[1]) + 1) * PX}
                        fill="#f59e0b" opacity={0.2} stroke="#f59e0b" strokeWidth={1.5} />)}
                {dragPt && tool === "kresba" && drawKind !== "free" && (
                  <rect x={Math.min(dragPt.a[0], dragPt.b[0]) * PX} y={Math.min(dragPt.a[1], dragPt.b[1]) * PX}
                        width={Math.abs(dragPt.b[0] - dragPt.a[0]) * PX} height={Math.abs(dragPt.b[1] - dragPt.a[1]) * PX}
                        fill={drawFill || "none"} stroke={drawColor} strokeWidth={drawW * PX} opacity={.8} />)}
                {tool === "kresba" && drawKind === "free" && freePts.length > 1 && (
                  <polyline points={freePts.map(([x, y]) => `${x * PX},${y * PX}`).join(" ")} fill="none" stroke={drawColor} strokeWidth={drawW * PX} />)}
                {marquee && <rect x={Math.min(marquee.a[0], marquee.b[0]) * PX} y={Math.min(marquee.a[1], marquee.b[1]) * PX}
                                  width={Math.abs(marquee.b[0] - marquee.a[0]) * PX} height={Math.abs(marquee.b[1] - marquee.a[1]) * PX}
                                  fill="#3b82f6" opacity={.12} stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" />}
                {/* výběr + úchyty */}
                {sel.map((s) => {
                  const o = s.kind === "objekt" ? (map.objekty || []).find((o) => o.id === s.id) : null;
                  if (!o) return null;
                  const w = o.w * PX, h = o.h * PX;
                  return (
                    <g key={s.id} transform={`translate(${o.x * PX},${o.y * PX}) rotate(${o.rot || 0})`}>
                      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke="#3b82f6" strokeWidth={1.4} strokeDasharray="4 2" />
                      <rect x={w / 2 - 4} y={h / 2 - 4} width={8} height={8} fill="#3b82f6" stroke="#fff" strokeWidth={1}
                            style={{ cursor: "nwse-resize" }} onPointerDown={(e) => { e.stopPropagation(); setHandleDrag("scale"); }} />
                      <circle cx={0} cy={-h / 2 - 10} r={5} fill="#3b82f6" stroke="#fff" strokeWidth={1}
                              style={{ cursor: "grab" }} onPointerDown={(e) => { e.stopPropagation(); setHandleDrag("rot"); }} />
                      <line x1={0} y1={-h / 2} x2={0} y2={-h / 2 - 10} stroke="#3b82f6" strokeWidth={1} />
                    </g>
                  );
                })}
                {cur && (tool === "teren" || tool === "textura" || tool === "guma") &&
                  ops.brushCells(cur.x, cur.y, brushSize, brushShape).map(([x, y]) => <rect key={"b" + x + "," + y} x={x * PX} y={y * PX} width={PX} height={PX} fill="none" stroke="#fbbf24" strokeWidth={1} opacity={.7} />)}
                {calib && calib.pts.map((p, i) => <circle key={i} cx={p[0] * PX} cy={p[1] * PX} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />)}
              </g>
            </svg>
            <svg className="me-minimap" viewBox={`0 0 ${W * PX} ${H * PX}`}
                 onClick={(e) => {
                   const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                   const mx = (e.clientX - r.left) / r.width * W * PX, my = (e.clientY - r.top) / r.height * H * PX;
                   const cw = wrapRef.current!.clientWidth, ch = wrapRef.current!.clientHeight;
                   setV((v) => ({ ...v, x: cw / 2 - mx * v.k, y: ch / 2 - my * v.k }));
                 }}>
              <MapTextureLayer map={map} />
              {(map.steny || []).map((w) => <line key={w.id} x1={w.a[0] * PX} y1={w.a[1] * PX} x2={w.b[0] * PX} y2={w.b[1] * PX} stroke="#292524" strokeWidth={2} />)}
            </svg>
          </div>

          <footer className="me-status">
            {cur && <span>cell {cur.x},{cur.y}</span>}
            {cur && <span>tile {TILES[map.mrizka[cur.y]?.[cur.x]]?.nazev || map.mrizka[cur.y]?.[cur.x] || "—"}</span>}
            {cur && map.textury?.[k2(cur.x, cur.y)] && <span>tex {textureById(map.textury[k2(cur.x, cur.y)])?.nazev}</span>}
            {cur && map.vyska?.[k2(cur.x, cur.y)] != null && <span>elev {map.vyska[k2(cur.x, cur.y)]} ft</span>}
            <span className="me-sp" />
            <span>{Math.round(V.k * 100)} %</span>
            <span>snap {snap === 0 ? "vyp" : snap}</span>
            <span>{W}×{H}</span>
          </footer>
        </div>

        <aside className="me-right">
          <div className="me-tabs">
            {TABS.map(([t, ic, n]) => (
              <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)} title={n}>{ic}<span className="me-tab-n">{n}</span></button>
            ))}
          </div>
          <div className="me-right-body">
            {tab === "vrstvy" && <LayersPanel map={map} layerVis={layerVis} setLayerVis={setLayerVis} />}
            {tab === "knihovna" && <LibraryPanel q={stampQ} setQ={setStampQ} kat={stampKat} setKat={setStampKat}
              stampId={stampId} ASSETS={ASSETS} onUpload={uploadAsset}
              onPick={(sid) => { setStampId(sid); setTool("objekt"); }} />}
            {tab === "vlastnosti" && <PropertiesPanel map={map} selObj={sel.length === 1 ? sel[0] : null} push={push}
              onDelete={() => { if (sel.length) { push((m) => { for (const s of sel) { const n = s.kind === "objekt" ? "objekty" : s.kind === "kresba" ? "kresby" : s.kind === "stena" ? "steny" : s.kind === "svetlo" ? "svetla" : "poznamky"; (m as any)[n] = ((m as any)[n] || []).filter((o: any) => o.id !== s.id); } }); setSel([]); } }} />}
            {tab === "generator" && <GeneratorPanel genId={genId} setGenId={setGenId} seed={genSeed} setSeed={setGenSeed}
              genPrev={genPrev} onPreview={() => { const g = GENERATORS.find((x) => x.id === genId)!; setGenPrev(g.fn(W, H, genSeed)); }}
              onApply={() => { push((m) => ops.applyGen(m, genPrev!)); setGenPrev(null); }}
              onDiscard={() => setGenPrev(null)} />}
            {tab === "mapa" && <MapPanel map={map} push={push} onResize={resize}
              onUploadImg={uploadImg} onImportUvtt={async (f) => {
                try { const d = JSON.parse(await f.text()); const r = importUvtt(d);
                  push((m) => { if (r.mrizka) m.mrizka = r.mrizka; if (r.steny) m.steny = [...(m.steny || []), ...r.steny]; if (r.svetla) m.svetla = r.svetla; if (r.kalibrace) m.kalibrace = r.kalibrace; });
                  toast("UVTT importováno", "ok");
                } catch (e: any) { toast("UVTT import selhal: " + e.message, "err"); } }}
              onExportUvtt={() => download(exportUvtt(map), `${map.id}.uvtt`)}
              onExportJson={() => download(JSON.stringify(map, null, 2), `${map.id}.json`)}
              onImportJson={async (f) => { try { const d = JSON.parse(await f.text()); push((m) => Object.assign(m, migrateMap(d))); } catch { toast("Neplatný JSON", "err"); } }}
              onExportPng={() => svgRef.current && exportPng(svgRef.current, 70, `${map.id}.png`)}
              calib={calib} setCalib={setCalib} />}
          </div>
        </aside>
      </div>

      {noteDraft && (
        <div className="me-modal-back" onClick={() => setNoteDraft(null)}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Poznámka DM</h3>
            <textarea autoFocus value={noteDraft.text} onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })} />
            <div className="me-modal-acts">
              <button className="me-btn ghost" onClick={() => setNoteDraft(null)}>Zrušit</button>
              <button className="me-btn primary" onClick={() => {
                push((m) => { m.poznamky = [...(m.poznamky || []), { id: "n" + Date.now() % 1e6, x: noteDraft.x, y: noteDraft.y, text: noteDraft.text }]; });
                setNoteDraft(null);
              }}>Přidat</button>
            </div>
          </div>
        </div>
      )}
      {doc.restoring && (
        <div className="me-modal-back">
          <div className="me-modal">
            <h3>Neuložená verze</h3>
            <p>Máte neuloženou rozpracovanou verzi této mapy{(doc.restoring as any)?.ts ? ` z ${new Date((doc.restoring as any).ts).toLocaleString("cs-CZ")}` : ""}. Obnovit ji?</p>
            <div className="me-modal-acts">
              <button className="me-btn ghost" onClick={() => doc.restoreDraft(false)}>Zahodit</button>
              <button className="me-btn primary" onClick={() => doc.restoreDraft(true)}>Obnovit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

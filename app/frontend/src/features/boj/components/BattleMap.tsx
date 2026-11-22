/* Bitevní mapa: SVG vrstvy, pan/zoom (klidný zoom ke kurzoru, pinch, auto-follow),
   drag&drop s live path preview + OA, zóny, terén painting, osvětlení, fog,
   multi-select, kontextové menu, move&attack preview, metr, FX.
   Všechny mapové popisky jsou counter-scaled → konstantní on-screen velikost. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { BattleMapData, StavBoje, Token, AttackDef, FxEvent, EffectPreset } from "../types";
import TokenCoin, { CoinDefs } from "./TokenCoin";
import FxLayer from "./FxLayer";
import { byId, cur } from "../rules/turn";
import { reachableCells, evalUi } from "../state/commands";
import { planMovement, cumFt, type MovementPlan } from "../rules/movement";
import { settingsOf } from "../rules/settings";
import { mapSize, tileAt, tileDef } from "../rules/grid";
import type { MapV2, MapWall } from "../model/mapV2";
import { MapElevationLayer, MapWallLayer, MapDrawingLayer, MapLightLayer, MapNoteLayer, MapGridLayer } from "./MapV2Layers";
import { BASE_COLORS } from "../types";
import { areaCells } from "../rules/areas";
import { dmgStyle } from "./visual";
import { ZoneShape, ZonePatterns, LightingLayer, FogLayer } from "./MapLayers";
import { MapAtmosphereLayer } from "./MapAtmoLayers";
import { BattleTerrain } from "./BattleTerrain";
import { AnimationButton, WeatherPicker, MapWeatherOverlay } from "./MapMotion";
import { MapAnimatedScene } from "./MapAnimatedScene";
import type { MapWeather } from "../model/mapV2";
import { ZoomIn, ZoomOut, Maximize2, Crosshair, X } from "lucide-react";
import {sourceAt,sourceMap,sourceOn} from "../model/sourceState";
import {doorAt} from "../model/doorHit";

export type Tool = "select" | "measure" | "zone" | "paint" | "fog" | "light" | "kresba";

export interface Targeting {
  atk: AttackDef;
  srcId: string;
  area?: boolean;
  anchor?: [number, number];
  slot?: number;
  pact?: boolean;
  meta?: string[];
}

export interface ZonePlace { preset: EffectPreset; anchor?: [number, number] }
export interface MoveAtkPreview { path: [number, number][]; cell: [number, number]; ft: number; oas: string[] }

interface Props {
  bid: string;
  S: StavBoje;
  map: BattleMapData;
  sel: string | null;
  selSet?: Set<string>;
  dm: boolean;
  tool: Tool;
  paintTile?: string;
  fogMode?: "reveal" | "hide";
  targeting: Targeting | null;
  zonePlace?: ZonePlace | null;
  zoneEdit?: boolean;
  onPresetDrop?: (tokId: string, presetId: string) => void;
  onZoneEdit?: (id: string, p: { anchor?: [number, number]; size?: number }) => void;
  moveAtk?: MoveAtkPreview | null;
  hoverAtk?: AttackDef | null;         // hover v panelu → ukázat dosah
  names?: "hover" | "always";
  followTurn?: boolean;
  fx: FxEvent[];
  onFxDone: (ids: string[]) => void;
  onSelect: (id: string | null, additive?: boolean) => void;
  onInspect: (id: string) => void;
  onDrop: (tok: Token, to: [number, number], plan: MovementPlan, wps: [number, number][],
           pt: { x: number; y: number }, mods: { alt: boolean; shift: boolean }, group?: Set<string>) => void;
  onTarget: (tgtId: string) => void;
  onArea: (anchor: [number, number], dir?: number) => void;
  onZone: (x: number, y: number, dir?: number) => void;
  onPaint?: (cells: [number, number][]) => void;
  onFogPaint?: (cells: [number, number][], reveal: boolean) => void;
  onLightPlace?: (x: number, y: number) => void;
  onCtxMenu?: (t: Token, pt: { x: number; y: number }) => void;
  onSelSet?: (ids: Set<string>) => void;
  onCancelMode?: () => void;
  onDoor?: (w: MapWall) => void;             // DM klik na dveře v mapě
  onSource?: (id:string)=>void;
  onWeather?: (weather: MapWeather) => void;
  onDraw?: (pts: [number, number][], stroke: string) => void;
  drawColor?: string;
}

const viewKey = (bid: string) => `boj-view:${bid}`;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function BattleMap(p: Props) {
  const { S } = p;
  const map=useMemo(()=>sourceMap(p.map,S.zdroje),[p.map,S.zdroje]);
  const [hoverSource,setHoverSource]=useState<string|null>(null);
  const [sourceMenu,setSourceMenu]=useState<{id:string;x:number;y:number}|null>(null);
  const weatherMap = useMemo(() => ({ ...map, pocasi: S.pocasi ?? (map as MapV2).pocasi } as MapV2), [map,S.pocasi]);
  const { W, H } = mapSize(map);
  const PX = 48;
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<{ x: number; y: number; k: number } | null>(null);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);
  const [hoverTok, setHoverTok] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string; to: [number, number] | null;
    pan?: { sx: number; sy: number; ox: number; oy: number };
    box?: { a: [number, number]; b: [number, number] };
    wps?: [number, number][];
    moved: boolean;
  } | null>(null);
  const [drawLive, setDrawLive] = useState<{ pts: [number, number][]; stroke?: string } | null>(null);
  const [measure, setMeasure] = useState<{ a: [number, number]; b: [number, number] } | null>(null);
  const paintRef = useRef<Set<string>>(new Set());
  const lpRef = useRef<number>(0);
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ d0: number; k0: number; wx: number; wy: number } | null>(null);
  const animReq = useRef<number>(0);
  const viewRef = useRef(view); viewRef.current = view;
  const [pctFlash, setPctFlash] = useState(false);   // mobil: % v pill jen po tapu na zoom
  const flashT = useRef(0);
  const flash = () => { setPctFlash(true); clearTimeout(flashT.current); flashT.current = window.setTimeout(() => setPctFlash(false), 1400); };

  const rect = () => svgRef.current?.getBoundingClientRect();
  const kFit = () => { const r = rect(); return r ? Math.min(r.width / (W * PX), r.height / (H * PX)) : 1; };
  const kCover = () => { const r = rect(); return r ? Math.max(r.width / (W * PX), r.height / (H * PX)) : 1; };
  const kMin = () => kFit() * 0.96;
  const kMax = () => Math.max(2.5, kCover() * 1.4); // max ≈ buňka 120 px

  /* plynulý přechod pohledu (zoom tlačítka, na aktivního) */
  const animateTo = (tgt: { x: number; y: number; k: number }) => {
    cancelAnimationFrame(animReq.current);
    const from = viewRef.current || tgt;
    const t0 = performance.now(), D = 240;
    const step = (now: number) => {
      const f = clamp((now - t0) / D, 0, 1), e = 1 - Math.pow(1 - f, 3);
      setView({ x: from.x + (tgt.x - from.x) * e, y: from.y + (tgt.y - from.y) * e, k: from.k + (tgt.k - from.k) * e });
      if (f < 1) animReq.current = requestAnimationFrame(step);
    };
    animReq.current = requestAnimationFrame(step);
  };

  /* ---- výchozí pohled: localStorage → fit bbox žetonů (+2 buňky) → cover ---- */
  const fittedRef = useRef(false);
  useEffect(() => { fittedRef.current = false; }, [p.bid, map.id]);
  const placedN = S.tok.reduce((n, t) => n + (t.x != null ? 1 : 0), 0);
  useEffect(() => {
    let tries = 0, req = 0;
    const attempt = () => {
      if (fittedRef.current) return;
      const saved = (() => { try { return JSON.parse(localStorage.getItem(viewKey(p.bid)) || "null"); } catch { return null; } })();
      if (saved && typeof saved.k === "number") { setView(saved); fittedRef.current = true; return; }
      const r = rect(); if (!r) return;
      if ((!r.width || !r.height) && tries++ < 30) { req = requestAnimationFrame(attempt); return; }
      const placed = S.tok.filter((t) => t.x != null);
      if (!placed.length) {
        const k = Math.max(kFit() * 0.92, 0.5);
        setView({ x: (r.width - W * PX * k) / 2, y: (r.height - H * PX * k) / 2, k });
        fittedRef.current = true;
        return;
      }
      const pad = 2;
      const x0 = Math.min(...placed.map((t) => t.x!)) - pad;
      const y0 = Math.min(...placed.map((t) => t.y!)) - pad;
      const x1 = Math.max(...placed.map((t) => t.x! + t.s)) + pad;
      const y1 = Math.max(...placed.map((t) => t.y! + t.s)) + pad;
      // mobil: buňka min. 40 px on-screen (tapatelné mince), jinak fit na bbox
      const minK = r.width < 700 ? 40 / PX : 0;
      const k = Math.min(Math.max(Math.min(r.width / ((x1 - x0) * PX), r.height / ((y1 - y0) * PX)), minK), kMax());
      const cx = (x0 + x1) / 2 * PX, cy = (y0 + y1) / 2 * PX;
      setView({ x: r.width / 2 - cx * k, y: r.height / 2 - cy * k, k });
      fittedRef.current = true;
    };
    attempt();
    return () => cancelAnimationFrame(req);
  }, [p.bid, map.id, W, H, placedN]);
  useEffect(() => {
    if (!view) return;
    const t = setTimeout(() => { try { localStorage.setItem(viewKey(p.bid), JSON.stringify(view)); } catch { /* */ } }, 400);
    return () => clearTimeout(t);
  }, [view, p.bid]);

  const centerOn = (gx: number, gy: number, k?: number, anim = true) => {
    const r = rect(); if (!r) return;
    const kk = clamp(k ?? (viewRef.current?.k ?? 1), kMin(), kMax());
    const v = { x: r.width / 2 - gx * kk, y: r.height / 2 - gy * kk, k: kk };
    anim ? animateTo(v) : setView(v);
  };
  const fitAll = () => {
    const r = rect(); if (!r) return;
    const k = kMin();
    animateTo({ x: (r.width - W * PX * k) / 2, y: (r.height - H * PX * k) / 2, k });
  };
  const fitCover = () => {
    const r = rect(); if (!r) return;
    const k = kCover();
    animateTo({ x: (r.width - W * PX * k) / 2, y: (r.height - H * PX * k) / 2, k });
  };
  const zoomBy = (f: number, mx?: number, my?: number) => {
    const r = rect(); if (!r) return;
    const V = viewRef.current || { x: 0, y: 0, k: 1 };
    const px = mx ?? r.width / 2, py = my ?? r.height / 2;
    const k2 = clamp(V.k * f, kMin(), kMax());
    const wx = (px - V.x) / V.k, wy = (py - V.y) / V.k;
    animateTo({ x: px - wx * k2, y: py - wy * k2, k: k2 });
    flash();
  };
  const centerActive = () => {
    const c = cur(S);
    if (c?.x != null) centerOn((c.x + c.s / 2) * PX, (c.y! + c.s / 2) * PX);
  };

  /* klávesové zkratky přes event z BattlePage + fit přes F */
  useEffect(() => {
    const fit = () => fitCover();
    const zm = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === "in") zoomBy(1.3); else if (d === "out") zoomBy(1 / 1.3);
      else if (d === "reset") fitCover(); else if (d === "active") centerActive();
    };
    window.addEventListener("boj-fit", fit);
    window.addEventListener("boj-zoom", zm);
    return () => { window.removeEventListener("boj-fit", fit); window.removeEventListener("boj-zoom", zm); };
  });

  /* auto-follow: nový tah → centruj, pokud je aktivní mimo obraz */
  const lastTurn = useRef(-1);
  useEffect(() => {
    if (p.followTurn === false || S.turn === lastTurn.current) return;
    lastTurn.current = S.turn;
    const c = cur(S), r = rect(), V = viewRef.current;
    if (!c || c.x == null || !r || !V) return;
    const sx = (c.x + c.s / 2) * PX * V.k + V.x, sy = (c.y! + c.s / 2) * PX * V.k + V.y;
    const m = 60;
    if (sx < m || sx > r.width - m || sy < m || sy > r.height - m)
      centerOn((c.x + c.s / 2) * PX, (c.y! + c.s / 2) * PX);
  }, [S.turn, S.ord, p.followTurn]);

  const V = view || { x: 0, y: 0, k: 1 };
  const cs = clamp(1 / V.k, 0.55, 2.4);          // counter-scale pro popisky
  const zoomPct = Math.round(V.k / Math.max(0.01, kCover()) * 100);
  const rNow = svgRef.current?.getBoundingClientRect();
  const plateClamp: [number, number] | undefined = rNow
    ? [-V.x / V.k + 8, (rNow.width - V.x) / V.k - 8]
    : undefined;

  const selTok = p.sel ? byId(S, p.sel) : undefined;
  const reach = useMemo(
    () => (selTok && selTok.x != null && !selTok.dead && !p.targeting ? reachableCells(S, map, selTok) : {}),
    [S, map, selTok?.id, selTok?.x, selTok?.y, selTok?.hp, p.targeting],
  );
  const settings = useMemo(() => settingsOf(S), [S]);
  const plan = drag?.to && drag.id ? planMovement(S, map, byId(S, drag.id)!, drag.wps || [], drag.to, "pravidla", settings) : null;
  const cum = plan && plan.path.length > 1 ? cumFt(byId(S, drag!.id)!, plan.path, map, S, settings) : null;
  useEffect(() => {
    if (!drag?.id) return;
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "w" && hoverCell) setDrag((d) => d ? { ...d, wps: [...(d.wps || []), hoverCell] } : d);
      if (e.key === "Backspace" && drag.wps?.length) setDrag((d) => d ? { ...d, wps: d.wps!.slice(0, -1) } : d);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [!!drag?.id, hoverCell, drag?.wps?.length]);
  const srcTok = p.targeting ? byId(S, p.targeting.srcId) : p.hoverAtk && selTok ? selTok : undefined;
  const ringAtk = p.targeting ? p.targeting.atk : p.hoverAtk || null;
  const hoverEval = p.targeting && !p.targeting.area && hoverTok && srcTok && byId(S, hoverTok)
    ? evalUi(S, map, srcTok, byId(S, hoverTok)!, p.targeting.atk) : null;
  const areaPrev = p.targeting?.area && (p.targeting.anchor || hoverCell)
    ? areaCells({
        shape: p.targeting.atk.area!.shape, size: p.targeting.atk.area!.size,
        anchor: p.targeting.anchor || hoverCell!,
        dir: p.targeting.anchor && hoverCell
          ? Math.atan2(hoverCell[1] + 0.5 - (p.targeting.anchor[1] + 0.5), hoverCell[0] + 0.5 - (p.targeting.anchor[0] + 0.5)) * 180 / Math.PI
          : 0,
      }) : [];
  const zonePrevCells = useMemo(() => {
    if (p.tool !== "zone" || !p.zonePlace?.preset.zone) return [];
    const zp = p.zonePlace.preset.zone;
    const anchor = p.zonePlace.anchor || hoverCell;
    if (!anchor) return [];
    const dir = p.zonePlace.anchor && hoverCell
      ? Math.atan2(hoverCell[1] - p.zonePlace.anchor[1], hoverCell[0] - p.zonePlace.anchor[0]) * 180 / Math.PI
      : 0;
    return areaCells({ shape: zp.shape.kind, size: zp.shape.size, w: zp.shape.w, h: zp.shape.h, anchor, dir } as any);
  }, [p.tool, p.zonePlace, hoverCell]);

  const toGrid = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    const gx = ((e.clientX - r.left) - V.x) / V.k / PX;
    const gy = ((e.clientY - r.top) - V.y) / V.k / PX;
    return { gx, gy, cx: Math.floor(gx), cy: Math.floor(gy) };
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const f = e.ctrlKey ? (e.deltaY < 0 ? 1.22 : 1 / 1.22) : (e.deltaY < 0 ? 1.15 : 1 / 1.15);
    const k2 = clamp(V.k * f, kMin(), kMax());
    const wx = (mx - V.x) / V.k, wy = (my - V.y) / V.k;
    setView({ x: mx - wx * k2, y: my - wy * k2, k: k2 });
    flash();
  };

  const tokAt = (cx: number, cy: number): Token | undefined =>
    [...S.tok].reverse().find((t) => t.x != null && cx >= t.x && cx < t.x + t.s && cy >= t.y! && cy < t.y! + t.s);

  /* ---- pointer handling: drag žetonu, pan, pinch, box select ---- */
  const down = (e: React.PointerEvent) => {
    if(e.button!==0)return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) { // začni pinch — zruš probíhající drag/pan
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: V.k, wx: ((a.x + b.x) / 2 - (rect()?.left || 0) - V.x) / V.k, wy: ((a.y + b.y) / 2 - (rect()?.top || 0) - V.y) / V.k };
      setDrag(null); return;
    }
    const { cx, cy, gx, gy } = toGrid(e);
    const t = tokAt(cx, cy);
    if (p.tool === "measure") { setMeasure({ a: [cx, cy], b: [cx, cy] }); return; }
    if (p.tool === "zone") {
      const zp = p.zonePlace?.preset.zone;
      if (!zp) return;
      if (!p.zonePlace?.anchor) p.onZone(cx, cy);
      else {
        const needsDir = zp.shape.kind === "line" || zp.shape.kind === "cone";
        const dir = needsDir ? Math.atan2(cy - p.zonePlace.anchor[1], cx - p.zonePlace.anchor[0]) * 180 / Math.PI : 0;
        p.onZone(p.zonePlace.anchor[0], p.zonePlace.anchor[1], dir);
      }
      return;
    }
    if (p.tool === "paint" || p.tool === "fog") { paintRef.current = new Set([`${cx},${cy}`]); setDrag({ id: "", to: null, moved: true }); return; }
    if (p.tool === "light") { p.onLightPlace?.(cx, cy); return; }
    if (p.tool === "kresba") { setDrawLive({ pts: [[gx, gy]], stroke: p.drawColor || "#f59e0b" }); setDrag({ id: "", to: null, moved: true }); return; }
    if (p.targeting) {
      if (p.targeting.area) {
        if (!p.targeting.anchor) { p.onArea([cx, cy]); return; }
      } else if (t) { p.onTarget(t.id); return; }
      return;
    }
    if (t) {
      if (e.shiftKey && p.onSelSet) { p.onSelect(t.id, true); return; }
      setDrag({ id: t.id, to: null, moved: false });
      if (e.pointerType === "touch" && p.onCtxMenu) {
        const sx = e.clientX, sy = e.clientY;
        lpRef.current = window.setTimeout(() => { setDrag(null); p.onCtxMenu?.(t, { x: sx, y: sy }); }, 550);
      }
    } else if (e.shiftKey && p.onSelSet) {
      setDrag({ id: "", to: null, box: { a: [cx, cy], b: [cx, cy] }, moved: false });
    } else setDrag({ id: "", to: null, pan: { sx: e.clientX, sy: e.clientY, ox: V.x, oy: V.y }, moved: false });
  };
  const move = (e: React.PointerEvent) => {
    if(p.dm && p.tool==="select" && !p.targeting){const {gx,gy}=toGrid(e);setHoverSource(sourceAt(map,gx,gy)?.id ?? null);}
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const r = rect()!;
      const k2 = clamp(pinch.current.k0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d0), kMin(), kMax());
      setView({ x: (a.x + b.x) / 2 - r.left - pinch.current.wx * k2, y: (a.y + b.y) / 2 - r.top - pinch.current.wy * k2, k: k2 });
      flash();
      return;
    }
    const { cx, cy, gx, gy } = toGrid(e);
    setHoverCell([cx, cy]);
    if (lpRef.current && drag?.moved) { clearTimeout(lpRef.current); lpRef.current = 0; }
    if (p.tool === "measure" && measure) { setMeasure({ a: measure.a, b: [cx, cy] }); return; }
    if (p.tool === "kresba" && drawLive) { setDrawLive({ ...drawLive, pts: [...drawLive.pts, [gx, gy]] }); return; }
    if ((p.tool === "paint" || p.tool === "fog") && drag) { paintRef.current.add(`${cx},${cy}`); return; }
    if (!drag) { setHoverTok(tokAt(cx, cy)?.id || null); return; }
    if (drag.box) { setDrag({ ...drag, box: { a: drag.box.a, b: [cx, cy] }, moved: true }); return; }
    if (drag.pan) {
      if (Math.hypot(e.clientX - drag.pan.sx, e.clientY - drag.pan.sy) > 4) {
        drag.moved = true;
        setView({ ...V, x: drag.pan.ox + (e.clientX - drag.pan.sx), y: drag.pan.oy + (e.clientY - drag.pan.sy) });
      }
      return;
    }
    if (drag.id) { drag.moved = true; setDrag({ ...drag, to: [cx, cy] }); }
  };
  const up = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (lpRef.current) { clearTimeout(lpRef.current); lpRef.current = 0; }
    if (p.tool === "measure") return;
    if (p.tool === "kresba" && drawLive) {
      if (drawLive.pts.length > 1) p.onDraw?.(drawLive.pts, drawLive.stroke || "#f59e0b");
      setDrawLive(null); setDrag(null); return;
    }
    if ((p.tool === "paint" || p.tool === "fog") && drag) {
      const cells = [...paintRef.current].map((k) => k.split(",").map(Number) as [number, number]);
      if (cells.length) {
        if (p.tool === "paint") p.onPaint?.(cells);
        else p.onFogPaint?.(cells, p.fogMode !== "hide");
      }
      paintRef.current.clear(); setDrag(null); return;
    }
    if (drag?.box) {
      const [ax, ay] = drag.box.a, [bx, by] = drag.box.b;
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
      const ids = new Set(S.tok.filter((t) => t.x != null && t.x < x1 && t.x + t.s > x0 && t.y! < y1 && t.y! + t.s > y0).map((t) => t.id));
      p.onSelSet?.(ids); setDrag(null); return;
    }
    if (drag?.pan) {
      const wasPan = drag.moved; setDrag(null);
      if (!wasPan) {
        // DM klik na dveře (svg má pointer capture → onClick na <g> nespustí)
        if(p.dm && p.onSource && p.tool==="select"){
          const {gx,gy}=toGrid(e),source=sourceAt(map,gx,gy);
          if(source){p.onSource(source.id);return;}
        }
        if (p.dm && p.onDoor) {
          const { gx, gy } = toGrid(e);
          const door = doorAt(map.steny || [], gx, gy, S.dvere);
          if (door) { p.onDoor(door); return; }
        }
        p.onSelect(null);
      }
      return;
    }
    if (drag?.id) {
      const t = byId(S, drag.id);
      if (drag.to && drag.moved && t) {
        const pl = planMovement(S, map, t, drag.wps || [], drag.to, "pravidla", settings);
        const group = p.selSet?.has(t.id) && p.selSet.size > 1 ? p.selSet : undefined;
        p.onDrop(t, drag.to, pl, drag.wps || [], { x: e.clientX, y: e.clientY }, { alt: e.altKey, shift: e.shiftKey }, group);
      } else if (t) p.onSelect(t.id === p.sel ? null : t.id);
      setDrag(null);
    }
  };
  const dbl = (e: React.MouseEvent) => {
    const { cx, cy, gx, gy } = toGrid(e);
    const t = tokAt(cx, cy);
    if (t) p.onInspect(t.id);
    else { // dvojklik do prázdna = přiblížit ke kurzoru
      const r = svgRef.current!.getBoundingClientRect();
      zoomBy(1.5, e.clientX - r.left, e.clientY - r.top);
    }
  };
  const ctx = (e: React.MouseEvent) => {
    const { cx, cy } = toGrid(e);
    if (drag?.id) { e.preventDefault(); setDrag({ ...drag, wps: [...(drag.wps || []), [cx, cy]] }); return; }
    const t = tokAt(cx, cy);
    if(!t && p.dm && p.onSource){const {gx,gy}=toGrid(e),source=sourceAt(map,gx,gy);if(source){e.preventDefault();setSourceMenu({id:source.id,x:e.clientX,y:e.clientY});return;}}
    if (t && p.onCtxMenu) { e.preventDefault(); p.onCtxMenu(t, { x: e.clientX, y: e.clientY }); }
  };
  const leave = () => { setHoverCell(null); setHoverTok(null);setHoverSource(null); };

  const img = map.obrazek ? `/repo/11_Mapy/${map.obrazek}` : null;
  const base = BASE_COLORS[map.podklad] || "#57524d";

  const ringCells = (t: Token, r: number) => {
    const cells: [number, number][] = [];
    const cx = (t.x ?? 0) + t.s / 2, cy = (t.y ?? 0) + t.s / 2;
    const R = r / 5 + t.s / 2;
    for (let x = 0; x < W; x++) for (let y = 0; y < H; y++)
      if (Math.max(Math.abs(x + 0.5 - cx), Math.abs(y + 0.5 - cy)) <= R) cells.push([x, y]);
    return cells;
  };

  /* popisek s tmavou pilulkou, konstantní on-screen velikost */
  const Pill = ({ x, y, w, children, h = 17 }: { x: number; y: number; w: number; h?: number; children: React.ReactNode }) => (
    <g transform={`translate(${x},${y}) scale(${cs})`} pointerEvents="none">
      <rect x={-w / 2} y={-h} width={w} height={h} rx={h / 2.2} fill="#0f172ae6" />
      {children}
    </g>
  );

  /* mode banner + kurzor */
  const a = p.targeting?.atk;
  const modeText = p.targeting
    ? p.targeting.area
      ? `Klikni = střed oblasti — ${a!.nazev} (${a!.area!.shape} ${a!.area!.size} ft)`
      : `Vyber cíl pro ${a!.nazev} — ${a!.melee ? `dosah ${a!.reach || 5}` : `dostřel ${a!.range || "—"}`} ft · Esc zruší`
    : p.zonePlace ? `Umísti zónu ${p.zonePlace.preset.nazev}${p.zonePlace.anchor ? " — klikni = směr" : " — klikni = střed"}`
    : p.moveAtk ? `Přesunout a zaútočit: ${p.moveAtk.ft} ft${p.moveAtk.oas.length ? ` · ⚠ ${p.moveAtk.oas.length}× OA` : ""}`
    : p.tool === "measure" ? "Metr: táhni mezi dvěma body (klik = zrušit)"
    : p.tool === "paint" ? "Malování terénu: táhni přes buňky"
    : p.tool === "fog" ? `Mlha: táhni = ${p.fogMode === "hide" ? "zakrýt" : "odhalit"}`
    : p.tool === "light" ? "Klikni = umístit zdroj světla"
    : null;
  const cursorCls = p.targeting ? "cur-pointer" : p.tool === "measure" || p.tool === "zone" ? "cur-cell" : p.tool !== "select" ? "cur-copy" : "";

  return (
    <div className="boj-maparea">
      <MapAnimatedScene map={map as MapV2} view={V} px={PX} dm={p.dm} illustration={!!img} overrides={S.teren} doors={S.dvere} details={<>
        <MapElevationLayer map={map as MapV2} />
        <MapGridLayer map={map as MapV2} W={W} H={H} />
        <MapDrawingLayer map={map as MapV2} dm={p.dm} />
        <MapWallLayer map={map as MapV2} doors={S.dvere} dm={p.dm} />
      </>}>
        <rect width={W*24} height={H*24} fill={base} />
        {img && <image href={img} width={W*24} height={H*24} preserveAspectRatio="none" opacity={.92} />}
        <BattleTerrain S={S} map={map as MapV2} illustration={!!img} />
      </MapAnimatedScene>
      <svg ref={svgRef} className={`boj-map ${cursorCls}`} onWheel={onWheel} onPointerDown={down} onPointerMove={move}
           onPointerUp={up} onDoubleClick={dbl} onPointerLeave={leave} onContextMenu={ctx} style={{ touchAction: "none" }}>
        <CoinDefs />
        <ZonePatterns />
        <g transform={`translate(${V.x},${V.y}) scale(${V.k})`}>
          {/* v2 vrstvy jsou v jednotkách 24 px/buňka → škálovaná skupina na bitevní PX */}
          <g transform={`scale(${PX / 24})`}>
          {p.dm && <MapNoteLayer map={map as MapV2} />}
          </g>
          {(S.kresby as any)?.length ? <MapDrawingLayer map={{ kresby: S.kresby } as MapV2} dm /> : null}
          {drawLive?.pts?.length ? <polyline points={drawLive.pts.map(([x, y]) => `${x * PX},${y * PX}`).join(" ")}
            fill="none" stroke={drawLive.stroke || "#f59e0b"} strokeWidth={3} strokeLinecap="round" opacity={.85} /> : null}
          {S.zones.map((z) => <ZoneShape key={z.id} z={z} px={PX} tokens={S.tok} lab={cs}
            edit={p.zoneEdit && !z.tokenId}
            onMove={(ax, ay) => p.onZoneEdit?.(z.id, { anchor: [ax, ay] })}
            onResize={(size) => p.onZoneEdit?.(z.id, { size })} />)}
          {zonePrevCells.map(([x, y]) => (
            <rect key={`zp${x},${y}`} x={x * PX + 1} y={y * PX + 1} width={PX - 2} height={PX - 2} rx={4}
                  fill="#a78bfa" opacity={0.3} stroke="#a78bfa" strokeWidth={1.5} />
          ))}
          {!p.targeting && Object.keys(reach).map((k) => {
            const [x, y] = k.split(",").map(Number);
            const far = reach[k] > 0;
            return <rect key={k} x={x * PX + 1} y={y * PX + 1} width={PX - 2} height={PX - 2} fill="#3b82f6" opacity={far ? 0.13 : 0} rx={4} />;
          })}
          {plan && drag?.to && (
            <g>
              {plan.path.map(([x, y], i) => {
                const over = cum ? cum[i] > plan.limitFt : false;
                return (
                  <rect key={i} x={x * PX + 6} y={y * PX + 6} width={PX - 12} height={PX - 12} rx={6}
                        fill={plan.blocked ? "#ef4444" : over ? "#f59e0b" : "#22c55e"} opacity={0.3} />
                );
              })}
              {(drag.wps || []).map(([x, y], i) => (
                <g key={`wp${i}`} transform={`translate(${x * PX + PX / 2},${y * PX + PX / 2}) scale(${cs})`}>
                  <circle r={8.5} fill="#0ea5e9" opacity={0.95} stroke="#0c4a6e" strokeWidth={1.2} />
                  <text textAnchor="middle" y={4} fontSize={11} fill="#fff" fontWeight={800}>{i + 1}</text>
                </g>
              ))}
              {plan.blocked && (
                <g>
                  <line x1={plan.path.length ? plan.path[plan.path.length - 1][0] * PX + PX / 2 : (byId(S, drag.id)!.x ?? 0) * PX + PX / 2}
                        y1={plan.path.length ? plan.path[plan.path.length - 1][1] * PX + PX / 2 : (byId(S, drag.id)!.y ?? 0) * PX + PX / 2}
                        x2={drag.to[0] * PX + PX / 2} y2={drag.to[1] * PX + PX / 2}
                        stroke="#f87171" strokeWidth={2.5} strokeDasharray="5 4" opacity={0.85} />
                  <g transform={`translate(${drag.to[0] * PX + PX / 2},${drag.to[1] * PX + PX / 2}) scale(${cs})`}>
                    <circle r={11} fill="#ef4444" stroke="#fff3" strokeWidth={1} />
                    <text textAnchor="middle" y={4.5} fontSize={13} fill="#fff" fontWeight={900}>✕</text>
                  </g>
                  <Pill x={drag.to[0] * PX + PX / 2} y={drag.to[1] * PX - 6} w={64}>
                    <text textAnchor="middle" y={-4} fontSize={11} fill="#fca5a5" fontWeight={700}>teleport?</text>
                  </Pill>
                </g>
              )}
              {!plan.blocked && plan.path.length > 1 && (
                <Pill x={drag.to[0] * PX + PX / 2} y={drag.to[1] * PX - 6} w={92} h={plan.oas.length ? 32 : 17}>
                  <text textAnchor="middle" y={-5} fontSize={12} fill="#f1f5f9" fontWeight={800}>
                    {plan.ft} ft{plan.overFt ? ` · +${plan.overFt}` : ""}
                  </text>
                  {plan.oas.length > 0 && <text textAnchor="middle" y={8} fontSize={11} fill="#fbbf24" fontWeight={700}>⚠ OA: {plan.oas.join(", ")}</text>}
                </Pill>
              )}
            </g>
          )}
          {p.moveAtk && (
            <g pointerEvents="none">
              {p.moveAtk.path.map(([x, y], i) => (
                <rect key={i} x={x * PX + 6} y={y * PX + 6} width={PX - 12} height={PX - 12} rx={6} fill="#f59e0b" opacity={0.35} />
              ))}
              <Pill x={p.moveAtk.cell[0] * PX + PX / 2} y={p.moveAtk.cell[1] * PX - 8} w={104} h={p.moveAtk.oas.length ? 32 : 17}>
                <text textAnchor="middle" y={-4} fontSize={12} fill="#fbbf24" fontWeight={800}>{p.moveAtk.ft} ft</text>
                {p.moveAtk.oas.length > 0 && <text textAnchor="middle" y={9} fontSize={11} fill="#f87171" fontWeight={700}>⚠ OA: {p.moveAtk.oas.join(", ")}</text>}
              </Pill>
            </g>
          )}
          {ringAtk && srcTok && srcTok.x != null && !(p.targeting?.area) && (() => {
            const rN = ringAtk.melee ? (ringAtk.reach || 5) : (ringAtk.range || 0);
            const rL = ringAtk.melee ? rN : (ringAtk.long || rN);
            const op = p.targeting ? 0.14 : 0.09;
            return (
              <g pointerEvents="none">
                {ringCells(srcTok, rL).map(([x, y]) => (
                  <rect key={`${x},${y}`} x={x * PX + 2} y={y * PX + 2} width={PX - 4} height={PX - 4} rx={4}
                        fill={rL > rN && Math.max(Math.abs(x + 0.5 - ((srcTok.x ?? 0) + srcTok.s / 2)), Math.abs(y + 0.5 - ((srcTok.y ?? 0) + srcTok.s / 2))) * 5 > rN ? "#f59e0b" : "#22c55e"} opacity={op} />
                ))}
              </g>
            );
          })()}
          {areaPrev.map(([x, y]) => (
            <rect key={`a${x},${y}`} x={x * PX + 1} y={y * PX + 1} width={PX - 2} height={PX - 2} rx={4}
                  fill={dmgStyle(p.targeting?.atk.typ).c} opacity={0.28} stroke={dmgStyle(p.targeting?.atk.typ).c} strokeWidth={1.5} />
          ))}
          {drag?.box && (() => {
            const [ax, ay] = drag.box.a, [bx, by] = drag.box.b;
            const x = Math.min(ax, bx) * PX, y = Math.min(ay, by) * PX;
            const w = Math.abs(bx - ax) * PX, h = Math.abs(by - ay) * PX;
            return <rect x={x} y={y} width={w} height={h} fill="#3b82f6" opacity={0.15} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="6 4" />;
          })()}
          {[...S.tok].sort((a2, b2) => Number(a2.dead) - Number(b2.dead)).map((t) => {
            if (t.x == null) return null;
            const isTarget = p.targeting && !p.targeting.area && t.id !== p.targeting.srcId && !t.dead;
            const ev = isTarget && t.id === hoverTok ? hoverEval : (isTarget && !hoverTok ? evalUi(S, map, srcTok!, t, p.targeting!.atk) : null);
            return (
              <g key={t.id} className={isTarget ? (ev?.canTarget ? "boj-targetable" : "boj-untargetable") : ""}
                onDragOver={(e) => { if (e.dataTransfer.types.includes("text/preset")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
                onDrop={(e) => { const pid = e.dataTransfer.getData("text/preset"); if (pid) { e.preventDefault(); e.stopPropagation(); p.onPresetDrop?.(t.id, pid); } }}>
                <TokenCoin t={t} px={PX * 0.94} step={PX} active={S.ord?.[S.turn] === t.id}
                           selected={p.sel === t.id || !!p.selSet?.has(t.id)}
                           hovered={hoverTok === t.id} dm={p.dm} lab={cs} names={p.names || "hover"} plateClamp={plateClamp} />
                {isTarget && ev && (
                  <Pill x={(t.x + t.s / 2) * PX} y={(t.y ?? 0) * PX - 8} w={104}>
                    <text textAnchor="middle" y={-4} fontSize={11.5} fill={ev.canTarget ? "#4ade80" : "#f87171"} fontWeight={800}>
                      {ev.canTarget ? `${Math.round(ev.hitChance * 100)}% vs AC ${ev.targetAC}` : ev.beyondRange ? "mimo dostřel" : ev.cover === 9 ? "plný kryt" : "nelze"}
                    </text>
                  </Pill>
                )}
              </g>
            );
          })}
          <g transform={`scale(${PX / 24})`}><MapAtmosphereLayer map={map as MapV2} doors={S.dvere} /></g>
          <LightingLayer S={S} map={map} px={PX} W={W} H={H} dm={p.dm} />
          <FogLayer S={S} px={PX} W={W} H={H} dm={p.dm} />
          {measure && (
            <g pointerEvents="none">
              <line x1={(measure.a[0] + 0.5) * PX} y1={(measure.a[1] + 0.5) * PX} x2={(measure.b[0] + 0.5) * PX} y2={(measure.b[1] + 0.5) * PX}
                    stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="6 4" />
              <Pill x={(measure.b[0] + 0.5) * PX} y={(measure.b[1] + 0.5) * PX - 10} w={64}>
                <text textAnchor="middle" y={-4} fontSize={12} fill="#fbbf24" fontWeight={800}>
                  {Math.max(Math.abs(measure.b[0] - measure.a[0]), Math.abs(measure.b[1] - measure.a[1])) * 5} ft
                </text>
              </Pill>
            </g>
          )}
          <FxLayer events={p.fx} px={PX} k={V.k} onDone={p.onFxDone} shakingIds={new Set()} />
          {p.dm && hoverSource && (()=>{const source=map.objekty?.find(o=>o.id===hoverSource) || map.svetla?.find(l=>l.id===hoverSource);return source?<g className="source-marker" data-source-hover={source.id} pointerEvents="none" transform={`translate(${source.x*PX},${source.y*PX}) scale(${1/V.k})`}><circle r={12}/><text y={3}>{sourceOn(source)?"◉":"○"}</text></g>:null;})()}
        </g>
      </svg>
      <MapWeatherOverlay map={weatherMap} view={V} px={PX} />
      {p.dm && sourceMenu && <><div style={{position:"fixed",inset:0,zIndex:100}} onPointerDown={()=>setSourceMenu(null)}/><div role="menu" aria-label="Stav zdroje" className="boj-ctx" style={{position:"fixed",left:Math.min(sourceMenu.x,window.innerWidth-240),top:Math.min(sourceMenu.y,window.innerHeight-80),zIndex:101}} onKeyDown={e=>{if(e.key==="Escape")setSourceMenu(null);}}><button role="menuitem" autoFocus onClick={()=>{p.onSource?.(sourceMenu.id);setSourceMenu(null);}}>Zapnout / vypnout zdroj</button></div></>}
      <div className="map-live-controls"><AnimationButton />{p.dm && p.onWeather && <WeatherPicker compact map={map as MapV2} value={weatherMap.pocasi} onChange={p.onWeather} />}</div>

      {/* zoom ovládání */}
      <div className={`boj-zoombar ${pctFlash ? "flash" : ""}`}>
        <button onClick={() => zoomBy(1.3)} title="Přiblížit (+)"><ZoomIn size={18} /></button>
        <button onClick={() => zoomBy(1 / 1.3)} title="Oddálit (−)"><ZoomOut size={18} /></button>
        <button onClick={fitCover} title="Přizpůsobit mapu (F / 0)"><Maximize2 size={18} /></button>
        <button onClick={centerActive} title="Na aktivního účastníka"><Crosshair size={18} /></button>
        <button className="boj-zoompct" onClick={fitCover} title="Zoom — klik = reset 100 %">{zoomPct}%</button>
      </div>

      {/* mode banner */}
      {modeText && (
        <div className="boj-modebar">
          <span>{modeText}</span>
          {p.onCancelMode && <button onClick={p.onCancelMode}><X size={13} /> Zrušit</button>}
        </div>
      )}
      {drag?.id && drag.moved && (
        <div className="boj-draghint">Alt = teleport · Shift = nucený přesun · W / pravé tlačítko = bod trasy · Esc = zrušit</div>
      )}
    </div>
  );
}

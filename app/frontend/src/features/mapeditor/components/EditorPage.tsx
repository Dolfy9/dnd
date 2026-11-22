/* /boj/mapa/:id — full-viewport editor bojové mapy (bez AppShell).
   V.k = zoom faktor (1.0 = 24 px/buňka). */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Undo2, Redo2, Save, Maximize, Minimize, Swords, MousePointer2, Brush,
  PaintBucket, Layers3, DoorOpen, Square, Spline, Package, PenLine,
  Mountain, Lightbulb, Flag, StickyNote, Eraser, Pipette, Upload, Library,
  PaintRoller, House, Pentagon, BrickWall, Umbrella, Grid2X2, Eye, PanelRightClose, PanelRightOpen, Pin, PinOff, Keyboard, MoreHorizontal, Minus, Plus, X, Info, Search, Command, Copy, Trash2, ArrowUp, ArrowDown,
} from "lucide-react";
import { post, upload } from "../../../api";
import { toast } from "../../../components/ui";
import { TILES } from "../../boj/types";
import type { MapV2, MapWall, MapDrawing, MapPaintStroke, MapObject, MapLightV2, MapRoute } from "../../boj/model/mapV2";
import {routeDistance, normalizeRoutes} from "../../boj/model/mapRoutes";
import {MapRouteLayer} from "../../boj/components/MapRouteLayer";
import {RouteInspector} from "./RouteInspector";
import { placementVariant, variantEdits } from "../../boj/model/assetVariants";
import { migrateMap, wallUid, WEATHER } from "../../boj/model/mapV2";
import {
  MapTextureLayer, MapElevationLayer, MapWallLayer, MapDrawingLayer,
  MapLightLayer, MapNoteLayer, MapGridLayer, MapObjectLayer, PX, setManifests,
} from "../../boj/components/MapV2Layers";
import { TerenLayer } from "../../boj/components/MapLayers";
import { MapPaintLayer, MapAtmosphereLayer } from "../../boj/components/MapAtmoLayers";
import { AnimationButton, MapWeatherOverlay } from "../../boj/components/MapMotion";
import { MapAnimatedScene } from "../../boj/components/MapAnimatedScene";
import { TEXTURES, textureById } from "../assets/textures";
import { stampById } from "../assets/stamps";
import { useAssetManifest, useTextureManifest } from "../assets/manifest";
import { GENERATORS, type GenOut } from "../generators/generators";
import { importUvtt, exportUvtt, exportPng } from "../io/uvtt";
import { useEditorDoc } from "../state/useEditorDoc";
import * as ops from "../tools/ops";
import { TexturePicker, TilePicker, WallPicker, TABS, LAYERS, LayersPanel, LibraryPanel, PropertiesPanel, GeneratorPanel, MapPanel, type TabId } from "./panels";
import { LightInspector, LightShapePicker } from "./LightInspector";
import {toggleSources,toggleable} from "../../boj/model/sourceState";
import { LightHandles } from "./LightHandles";
import { LIGHT_PRESETS, editedLight, updateLight, aimPlacedLight, dragLightHandle, lightRotationDelta, lightHandlesEnabled, lightPlacementTab, type LightHandle } from "../tools/lightEditing";
import { CommandPalette, ShortcutHelp, ToolRail, EditorMinimap, type EditorCommand } from "./EditorChrome";
import type { LibraryMode } from "./AssetLibrary";
import { actOnObjects, canTogglePanel, liveSelection, panUpdate, playerPreviewMap, TOOL_HINTS, readPreference, writePreference, rememberAsset, type ObjectAction } from "../state/editorUx";
import { assetUrl } from "../assets/manifest";
import "../editor.css";
import "../editorPro.css";

type Tool = "select" | "teren" | "fill" | "flood" | "textura" | "malba" | "mistnost" | "polygon" | "stena" | "dvere"
  | "interier" | "objekt" | "kresba" | "vyska" | "svetlo" | "start" | "poznamka" | "guma" | "kapatko" | "trasa";

const TOOLS: { id: Tool; icon: React.ReactElement; nazev: string; key: string }[] = [
  {id:"trasa",icon:<Spline size={18}/>,nazev:"Trasa",key:"T"},
  { id: "select", icon: <MousePointer2 size={18} />, nazev: "Výběr / přesun", key: "V" },
  { id: "teren", icon: <Brush size={18} />, nazev: "Terén", key: "B" },
  { id: "fill", icon: <Square size={18} />, nazev: "Výplň obdélníkem", key: "Shift+B" },
  { id: "flood", icon: <PaintBucket size={18} />, nazev: "Flood fill", key: "G" },
  { id: "textura", icon: <Layers3 size={18} />, nazev: "Textura", key: "X" },
  { id: "malba", icon: <PaintRoller size={18} />, nazev: "Malovat texturou", key: "K" },
  { id: "mistnost", icon: <House size={18} />, nazev: "Místnost", key: "R" },
  { id: "polygon", icon: <Pentagon size={18} />, nazev: "Polygonální místnost", key: "J" },
  { id: "interier", icon: <Umbrella size={18} />, nazev: "Interiér bez počasí", key: "U" },
  { id: "stena", icon: <BrickWall size={18} />, nazev: "Stěny", key: "W" },
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
type Sel = { kind: "objekt" | "kresba" | "stena" | "svetlo" | "poznamka" | "trasa"; id: string };

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
  const [routeSettings,setRouteSettings]=useState<MapRoute>({id:"draft",druh:"cesta",pts:[],sirka:1.5,t:"t-zahradni-cesta",hladke:true,seed:17});
  const [routePoints,setRoutePoints]=useState<[number,number][]>([]);
  const [routePoint,setRoutePoint]=useState<number|null>(null);
  const routeDrag=useRef<{id:string;point:number}|null>(null);
  const routeClipboard=useRef<MapRoute[]>([]);
  const [brushTile, setBrushTile] = useState("#");
  const [brushTex, setBrushTex] = useState(TEXTURES[0].id);
  const [paintSize, setPaintSize] = useState(2);
  const [paintOpacity, setPaintOpacity] = useState(.85);
  const [paintHardness, setPaintHardness] = useState(.4);
  const [paintErase, setPaintErase] = useState(false);
  const [paintAngle, setPaintAngle] = useState(0);
  const [paintRandom, setPaintRandom] = useState(false);
  const [randomRotation, setRandomRotation] = useState(false);
  const [randomVariants, setRandomVariants] = useState(() => {
    try { return localStorage.getItem("me-random-variant") !== "off"; } catch { return true; }
  });
  const [chosenVariant, setChosenVariant] = useState(0);
  const [scatterCount, setScatterCount] = useState(10);
  const variantRoll = useRef(Math.random());
  const rotationRoll = useRef(Math.random());
  const [, refreshVariant] = useState(0);
  useEffect(() => { try { localStorage.setItem("me-random-variant", randomVariants ? "on" : "off"); } catch { /* */ } }, [randomVariants]);
  const [shapeAngle, setShapeAngle] = useState(0);
  const [floorFill, setFloorFill] = useState(true);
  const [roomPoints, setRoomPoints] = useState<[number, number][]>([]);
  const transformStart = useRef<MapV2 | null>(null);
  const [paintPreview, setPaintPreview] = useState<MapPaintStroke | null>(null);
  const strokeRef = useRef<{ stroke: MapPaintStroke; erase: boolean } | null>(null);
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
  const [lightSettings, setLightSettings] = useState<MapLightV2>(()=>({...LIGHT_PRESETS[0].light}));
  const [lightPreview, setLightPreview] = useState<MapLightV2|null>(null);
  const lightGesture=useRef<{light:MapLightV2;anchor:[number,number];screen:[number,number];handle?:LightHandle}|null>(null);
  const [startTyp, setStartTyp] = useState<"druzina" | "nepratele" | "neutral">("druzina");
  const [snap, setSnap] = useState<1 | 0.5 | 0>(1);
  const [sel, setSel] = useState<Sel[]>([]);
  const [tab, setTab] = useState<TabId>("knihovna");
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1100);
  const [panelPinned, setPanelPinned] = useState(false);
  const [panelWidth, setPanelWidth] = useState(340);
  const [sheetHeight, setSheetHeight] = useState(50);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("objects");
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [playerPreview, setPlayerPreview] = useState(false);
  const [firstHint, setFirstHint] = useState(() => !readPreference("me-welcome-dismissed", false));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [layerVis, setLayerVis] = useState<Record<string, boolean>>(Object.fromEntries(LAYERS.map(([l]) => [l, true])));
  const [genId, setGenId] = useState("dungeon");
  const [genSeed, setGenSeed] = useState(12345);
  const [genPrev, setGenPrev] = useState<GenOut | null>(null);
  const [fs, setFs] = useState(false);
  const [V, setV] = useState({ x: 20, y: 20, k: 1 });
  const [cur, setCur] = useState<{ x: number; y: number; wx?: number; wy?: number } | null>(null);
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
  const placementRef = useRef<Set<string> | null>(null);
  const clipboardRef = useRef<MapObject[]>([]);
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  useEffect(() => { if (map) setSel(current => liveSelection(map,current)); }, [map]);
  useEffect(() => {
    if (panelPinned) return;
    if (tool === "objekt") { setTab("knihovna"); setLibraryMode("objects"); }
    else if (tool === "svetlo"||tool === "trasa") { setTab("vlastnosti"); setPanelOpen(true); }
    else if (["teren","fill","flood","textura","malba"].includes(tool)) { setTab("knihovna"); setLibraryMode(["textura","malba"].includes(tool) ? "textures" : "terrain"); }
  }, [tool, panelPinned]);
  useEffect(() => { if (sel.length && !panelPinned) { setTab("vlastnosti"); if (window.innerWidth >= 1100) setPanelOpen(true); } }, [sel, panelPinned]);
  useEffect(() => {
    const node = wrapRef.current; if (!node) return;
    const observer = new ResizeObserver(() => {
      setCanvasSize({ width: node.clientWidth, height: node.clientHeight });
      if (!userZoomRef.current) fit();
    });
    observer.observe(node); return () => observer.disconnect();
  }, [!!map]);

  const runObjectAction = (action: ObjectAction) => {
    if(action==="toggle-source"){
      const current=doc.mapRef.current,ids=new Set(sel.map(s=>s.id));
      if(current && (current.objekty?.some(o=>ids.has(o.id)&&toggleable(o,ASSETS[o.asset])) || current.svetla?.some(l=>ids.has(l.id))))push(m=>toggleSources(m,ids,ASSETS));
      setContextMenu(null);return;
    }
    if(sel.some(s=>s.kind==="trasa")){
      if(action==="delete"){deleteSelection();return;}
      if(action==="duplicate"){const current=doc.mapRef.current!,copies=ops.duplicateRoutes(current.trasy?.filter(r=>sel.some(s=>s.id===r.id))||[]),objects=ops.duplicateObjects(current.objekty?.filter(o=>sel.some(s=>s.id===o.id))||[],current.mrizka[0]?.length,current.mrizka.length);push(m=>{m.trasy=[...(m.trasy||[]),...copies];m.objekty=[...(m.objekty||[]),...objects];});setSel([...copies.map(r=>({kind:"trasa" as const,id:r.id})),...objects.map(o=>({kind:"objekt" as const,id:o.id}))]);setRoutePoint(null);setContextMenu(null);return;}
      setContextMenu(null);return;
    }
    const m = doc.mapRef.current; if (!m) return;
    const ids = sel.filter(s => s.kind === "objekt").map(s => s.id);
    const next = actOnObjects(m.objekty || [],ids,action,m.mrizka[0]?.length || 1,m.mrizka.length);
    if (JSON.stringify(next) !== JSON.stringify(m.objekty || [])) {
      push(d => { d.objekty = next; });
      if (action === "delete") setSel([]);
      if (action === "duplicate") setSel(next.filter(o => !m.objekty?.some(old => old.id === o.id)).map(o => ({kind:"objekt",id:o.id})));
    }
    setContextMenu(null);
  };

  const W = map?.mrizka?.[0]?.length || 1, H = map?.mrizka?.length || 1;
  const rerollPlacement = () => {
    variantRoll.current = Math.random(); rotationRoll.current = Math.random();
    refreshVariant(v => v + 1);
  };
  const nextPlacementVariant = placementVariant(ASSETS[stampId], randomVariants, chosenVariant, () => variantRoll.current);
  const makeObject = (x: number, y: number, assetId = stampId): MapObject => {
    const def = stampById(assetId) || ASSETS[assetId];
    const object: MapObject = {
      id: wallUid(), asset: assetId, x, y, w: def?.w || 1, h: def?.h || 1,
      blocks: def?.blocks, cover: def?.cover, difficult: def?.difficult, light: def?.light,
      z: ASSETS[assetId]?.z, rot: randomRotation ? rotationRoll.current * 360 : 0,
      v: placementVariant(ASSETS[assetId], randomVariants, assetId === stampId ? chosenVariant : 0, () => variantRoll.current),
    };
    rerollPlacement();
    return object;
  };
  const changeVariants = useCallback((action: number | "next" | "random", asset?: string) => {
    const selected = new Set(sel.filter(s => s.kind === "objekt").map(s => s.id));
    const objects = (doc.mapRef.current?.objekty || []).filter(o => selected.has(o.id) && (!asset || o.asset === asset));
    const edits = variantEdits(objects, ASSETS, action);
    if (!Object.keys(edits).length) return;
    push(m => { for (const o of m.objekty || []) if (edits[o.id] !== undefined) o.v = edits[o.id]; });
  }, [sel, assetsQ.data, push, doc.mapRef]);
  const scatterObjects = () => {
    const cells = (doc.mapRef.current?.mrizka || []).flatMap((row, y) => [...row].flatMap((c, x) => TILES[c]?.cost > 0 ? [[x, y]] : []));
    if (!cells.length) return;
    const objects = Array.from({ length: scatterCount }, () => {
      const [x,y] = cells[Math.floor(Math.random() * cells.length)];
      return makeObject(x + .5, y + .5);
    });
    push(m => { m.objekty = [...(m.objekty || []), ...objects]; });
  };

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
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const preventZoom = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    svg.addEventListener("wheel", preventZoom, { passive: false });
    return () => svg.removeEventListener("wheel", preventZoom);
  }, [map !== null]);

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
  const snapPt = (e: { clientX: number; clientY: number; altKey?: boolean }): [number, number] => {
    const [wx, wy] = toWorld(e);
    const s = snap || 1;
    return snap === 0 || e.altKey ? [wx, wy] : [Math.round(wx / s) * s, Math.round(wy / s) * s];
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
    m.malba = m.malba?.map(s => ({ ...s, p: s.p.map(([x, y]) => [x + dX, y + dY]) }));
    m.interiery = m.interiery?.map(r => ({ ...r, poly: r.poly.map(([x,y]) => [x+dX,y+dY]) }));
    m.trasy=m.trasy?.map(r=>({...r,pts:r.pts.map(([x,y])=>[x+dX,y+dY])}));
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setHelpOpen(false); setPaletteOpen(v => !v); return; }
      if ((e.target as HTMLElement)?.closest('[role="dialog"], [role="menu"]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doc.save(); return; }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((tag === "BUTTON" || tag === "SUMMARY") && (e.key === " " || e.key === "Enter")) return;
      if (e.key === "?") { e.preventDefault(); setHelpOpen(true); return; }
      if (e.key === "Tab") { if (canTogglePanel(e.target)) { e.preventDefault(); setPanelOpen(v => !v); } return; }
      if (e.key === "/") { e.preventDefault(); setTab("knihovna"); setPanelOpen(true); requestAnimationFrame(() => document.querySelector<HTMLInputElement>("[data-library-search]")?.focus()); return; }
      if (e.key === "Escape" && contextMenu) { setContextMenu(null); return; }
      if(e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase()==="l"){e.preventDefault();runObjectAction("toggle-source");return;}
      if (e.key === " ") { setSpace(true); e.preventDefault(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doc.redo() : doc.undo(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); doc.redo(); return; }
      if (e.key === "Escape") { setRoutePoints([]);setRoutePoint(null);lightGesture.current=null;setLightPreview(null);setWallDraft([]); setRoomPoints([]); setDragPt(null); setMarquee(null); setSel([]); setCalib(null); return; }
      if(tool==="trasa"&&e.key==="Enter"){e.preventDefault();finishRoute();return;}
      if(tool==="trasa"&&e.key==="Backspace"){e.preventDefault();setRoutePoints(p=>p.slice(0,-1));return;}
      if((e.key==="Delete"||e.key==="Backspace")&&routePoint!==null&&sel[0]?.kind==="trasa"){e.preventDefault();deleteRoutePoint();return;}
      const lightTurn=lightRotationDelta(e);
      if(lightTurn && sel.length===1 && sel[0].kind==="svetlo"){
        const light=doc.mapRef.current?.svetla?.find(l=>l.id===sel[0].id);
        if(light){e.preventDefault();push(m=>{updateLight(m,light.id,{smer:(light.smer || 0)+lightTurn});});}
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault(); changeVariants(e.shiftKey ? "random" : "next"); return;
      }
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "d"].includes(e.key.toLowerCase())) {
        const selectedRoutes=doc.mapRef.current?.trasy?.filter(r=>sel.some(s=>s.kind==="trasa"&&s.id===r.id))||[];
        const selected = (doc.mapRef.current?.objekty || []).filter(o => sel.some(s => s.kind === "objekt" && s.id === o.id));
        const key = e.key.toLowerCase();
        if (key === "c") {
          if (selected.length||selectedRoutes.length) { e.preventDefault(); clipboardRef.current = structuredClone(selected);routeClipboard.current=structuredClone(selectedRoutes); }
          return;
        }
        const source = key === "v" ? clipboardRef.current : selected;
        const routeSource=key==="v"?routeClipboard.current:selectedRoutes;
        if (!source.length&&!routeSource.length) return;
        e.preventDefault();
        const current = doc.mapRef.current!;
        const copies = ops.duplicateObjects(source, current.mrizka[0]?.length || 1, current.mrizka.length);
        const routeCopies=ops.duplicateRoutes(routeSource);
        push(m => { m.objekty = [...(m.objekty || []), ...copies];m.trasy=[...(m.trasy||[]),...routeCopies]; });
        setSel([...copies.map(o => ({kind:"objekt" as const,id:o.id})),...routeCopies.map(r=>({kind:"trasa" as const,id:r.id}))]);setRoutePoint(null);
        return;
      }
      if (!e.ctrlKey && sel.length === 1 && sel[0].kind === "objekt" && ["q", "e"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        if (!doc.mapRef.current?.objekty?.some(o => o.id === sel[0].id)) { setSel([]); return; }
        push(m => ops.rotateSel(m, sel, (e.key.toLowerCase() === "q" ? -1 : 1) * (e.altKey ? 1 : 15)));
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && sel.length) {
        e.preventDefault();deleteSelection();
        setSel([]); return;
      }
      if (sel.length && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = e.key === "ArrowLeft" ? [-1, 0] : e.key === "ArrowRight" ? [1, 0] : e.key === "ArrowUp" ? [0, -1] : [0, 1];
        push((m) => ops.moveSel(m, sel, d[0], d[1]));
        return;
      }
      const t = !e.ctrlKey && !e.metaKey && (TOOLS.find(tt => tt.key === (e.shiftKey ? "Shift+" : "") + e.key.toUpperCase()) || TOOLS.find(tt => tt.key === e.key.toUpperCase()));
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
  }, [doc.undo, doc.redo, doc.save, sel, push, fit, zoomAt, changeVariants, contextMenu,tool,routePoints,routeSettings,routePoint]);

  const deleteSelection=()=>{push(m=>{for(const s of sel){const field={trasa:"trasy",objekt:"objekty",kresba:"kresby",stena:"steny",svetlo:"svetla",poznamka:"poznamky"}[s.kind];(m as any)[field]=((m as any)[field]||[]).filter((o:{id:string})=>o.id!==s.id);}});setSel([]);setRoutePoint(null);setContextMenu(null);};
  const finishRoute=()=>{
    const routes=normalizeRoutes([{...routeSettings,id:wallUid(),pts:routePoints}]);
    if(routes.length){push(m=>{m.trasy=[...(m.trasy||[]),routes[0]];});setSel([{kind:"trasa",id:routes[0].id}]);setTool("select");setRoutePoint(null);}
    setRoutePoints([]);
  };
  const deleteRoutePoint=()=>{const route=doc.mapRef.current?.trasy?.find(r=>r.id===sel[0]?.id);if(route&&routePoint!==null&&route.pts.length>2){push(m=>{m.trasy=m.trasy?.map(r=>r.id===route.id?{...r,pts:r.pts.filter((_,i)=>i!==routePoint)}:r);});setRoutePoint(null);}};

  /* ---------- pointer ---------- */
  const lightGestureValue=(e:React.PointerEvent):MapLightV2=>{
    const gesture=lightGesture.current!;
    if(Math.hypot(e.clientX-gesture.screen[0],e.clientY-gesture.screen[1])<3)return gesture.light;
    const point=toWorld(e);
    if(!gesture.handle)return aimPlacedLight(gesture.light,[gesture.light.x+point[0]-gesture.anchor[0],gesture.light.y+point[1]-gesture.anchor[1]],e.shiftKey);
    return dragLightHandle(gesture.light,gesture.handle,gesture.handle==="origin"?[gesture.light.x+point[0]-gesture.anchor[0],gesture.light.y+point[1]-gesture.anchor[1]]:point,e.shiftKey,W,H);
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.button === 1 || space || e.button === 2) { panRef.current = { x0: e.clientX, y0: e.clientY, vx: V.x, vy: V.y }; e.currentTarget.setPointerCapture(e.pointerId); setPanning(true); userZoomRef.current = true; return; }
    setContextMenu(null);
    const [cx, cy] = cellOf(e);
    if(tool==="trasa"){e.preventDefault();if(e.detail<=1)setRoutePoints(p=>{const n=snapPt(e),last=p[p.length-1];return last&&Math.hypot(n[0]-last[0],n[1]-last[1])<.01?p:[...p,n];});return;}
    if (tool === "malba") {
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      const stroke: MapPaintStroke = { id: wallUid(), t: brushTex, b: paintSize, o: paintOpacity, h: paintHardness, r: paintRandom ? Math.random() * 360 : paintAngle, p: [toWorld(e)] };
      strokeRef.current = { stroke, erase: paintErase || e.altKey };
      setPaintPreview(strokeRef.current.erase ? null : stroke);
      return;
    }
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
      case "fill": setDragPt({ a: [cx, cy], b: [cx, cy] }); break;
      case "mistnost": { const p = snapPt(e); setDragPt({ a: p, b: p }); break; }
      case "polygon":
      case "interier": {
        if (tool === "interier" && e.altKey) {
          const [x,y] = toWorld(e); push(m => ops.removeInteriorAt(m,x,y)); setRoomPoints([]); break;
        }
        if (e.detail > 1) break;
        const p = snapPt(e);
        if (roomPoints.length >= 3 && Math.hypot(p[0] - roomPoints[0][0], p[1] - roomPoints[0][1]) < .25) {
          push(m => tool === "interier" ? ops.interiorPolygon(m,roomPoints) : ops.roomPolygon(m, roomPoints, floorFill ? brushTex : undefined, shapeAngle)); setRoomPoints([]);
        } else setRoomPoints(points => [...points, p]);
        break;
      }
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
          const [wx, wy] = toWorld(e);
          const i = (m.steny || []).findIndex((w) => ops.pointToSeg(wx, wy, w.a, w.b) < .4);
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
        const [fx, fy] = snap === 0 ? snapPt(e) : [cx + .5, cy + .5];
        transformStart.current = structuredClone(doc.mapRef.current!);
        placementRef.current = new Set([k2(cx, cy)]);
        e.currentTarget.setPointerCapture(e.pointerId);
        const object = makeObject(fx, fy);
        live(m => { m.objekty = [...(m.objekty || []), object]; });
        break;
      }
      case "kresba": { const p = snapPt(e); setDragPt({ a: p, b: p }); setFreePts([p]); break; }
      case "vyska": push((m) => { m.vyska = { ...(m.vyska || {}) }; const kk = k2(cx, cy); m.vyska[kk] = (m.vyska[kk] || 0) + (e.altKey ? -elevStep : elevStep); if (!m.vyska[kk]) delete m.vyska[kk]; }); break;
      case "svetlo": {
        const point=toWorld(e),light={...lightSettings,id:wallUid(),x:snap===0?point[0]:cx+.5,y:snap===0?point[1]:cy+.5};
        lightGesture.current={light,anchor:point,screen:[e.clientX,e.clientY]};
        setLightPreview(light);paintRef.current=false;
        svgRef.current?.setPointerCapture(e.pointerId);
        break;
      }
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
        setRoutePoint(null);
        const [wx, wy] = toWorld(e);
        const hit = ops.pickAt({...playerMap!,trasy:layerVis.trasy?playerMap!.trasy:[]}, wx, wy, true);
        if(hit?.kind==="trasa"&&e.altKey){const route=map.trasy!.find(r=>r.id===hit.id)!;let at=1,d=Infinity;route.pts.slice(1).forEach((b,i)=>{const next=routeDistance([wx,wy],route.pts[i],b);if(next<d){d=next;at=i+1;}});push(m=>{m.trasy=m.trasy?.map(r=>r.id===hit.id?{...r,pts:[...r.pts.slice(0,at),[wx,wy],...r.pts.slice(at)]}:r);});setSel([hit]);setRoutePoint(at);return;}
        if (hit) {
          const ns = e.shiftKey ? (sel.some((s) => s.id === hit.id) ? sel.filter((s) => s.id !== hit.id) : [...sel, hit]) : [hit];
          setSel(ns);
          transformStart.current = structuredClone(map);
          e.currentTarget.setPointerCapture(e.pointerId);
          moveRef.current = { anchor: snapPt(e) };
        } else {
          setSel([]);
          setMarquee({ a: [cx, cy], b: [cx, cy] });
        }
        break;
      }
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if(routeDrag.current){const drag=routeDrag.current,p=snapPt(e);live(m=>ops.moveRoutePoint(m,drag.id,drag.point,p));return;}
    if(lightGesture.current){setLightPreview(lightGestureValue(e));return;}
    if (strokeRef.current) {
      const s = strokeRef.current;
      ops.appendPaintPoint(s.stroke.p, toWorld(e), Math.max(.025, s.stroke.b / 20));
      if (!s.erase) setPaintPreview({ ...s.stroke, p: [...s.stroke.p] });
      return;
    }
    if (panRef.current) {
      if (Math.hypot(e.clientX - panRef.current.x0,e.clientY - panRef.current.y0) > 4) setContextMenu(null);
      setV(panUpdate(panRef.current,e));
      return;
    }
    const [cx, cy] = cellOf(e), [wx, wy] = snapPt(e); setCur({ x: cx, y: cy, wx, wy });
    if (placementRef.current) {
      const key = k2(cx, cy);
      if (cx >= 0 && cy >= 0 && cx < W && cy < H && !placementRef.current.has(key)) {
        placementRef.current.add(key);
        const object = makeObject(snap === 0 ? wx : cx + .5, snap === 0 ? wy : cy + .5);
        live(m => { m.objekty = [...(m.objekty || []), object]; });
      }
      return;
    }
    if (handleDrag && sel.length === 1 && sel[0].kind === "objekt") {
      const [wx, wy] = toWorld(e);
      live((m) => {
        m.objekty = m.objekty?.map(o => ({ ...o }));
        const o = m.objekty!.find((o) => o.id === sel[0].id)!;
        if (handleDrag === "rot") {
          const angle = Math.atan2(wy - o.y, wx - o.x) * 180 / Math.PI + 90;
          o.rot = e.shiftKey ? Math.round(angle / 15) * 15 : angle;
        } else {
          const r = (o.rot || 0) * Math.PI / 180, dx = wx - o.x, dy = wy - o.y;
          const w = Math.max(.25, Math.abs(dx * Math.cos(r) + dy * Math.sin(r)) * 2);
          const h = Math.max(.25, Math.abs(-dx * Math.sin(r) + dy * Math.cos(r)) * 2);
          const original = transformStart.current!.objekty!.find(v => v.id === o.id)!;
          const scale = Math.max(w / original.w, h / original.h);
          o.w = e.shiftKey ? original.w * scale : w; o.h = e.shiftKey ? original.h * scale : h;
        }
      });
      return;
    }
    if (moveRef.current && sel.length && map) {
      const [ax, ay] = moveRef.current.anchor;
      const p = snapPt(e), dx = p[0] - ax, dy = p[1] - ay;
      if (dx || dy) { live((m) => { Object.assign(m, structuredClone(m)); ops.moveSel(m, sel, dx, dy); }); moveRef.current = { anchor: p }; }
      return;
    }
    if (marquee) { setMarquee({ a: marquee.a, b: [cx, cy] }); return; }
    if (dragPt) setDragPt({ a: dragPt.a, b: tool === "kresba" || tool === "mistnost" ? snapPt(e) : [cx, cy] });
    if (!paintRef.current) return;
    if (tool === "teren") push((m) => ops.brushCells(cx, cy, brushSize, brushShape).forEach(([x, y]) => ops.setTile(m, x, y, brushTile)));
    else if (tool === "textura") push((m) => { m.textury = { ...(m.textury || {}) }; ops.brushCells(cx, cy, brushSize, brushShape).forEach(([x, y]) => { m.textury![k2(x, y)] = brushTex; }); });
    else if (tool === "kresba" && drawKind === "free") { const p = snapPt(e); setFreePts((p2) => [...p2, p]); }
    else if (tool === "guma") push((m) => ops.eraseAt(m, cx, cy));
  };
  const onUp = (e: React.PointerEvent) => {
    if(routeDrag.current){routeDrag.current=null;const start=transformStart.current;transformStart.current=null;if(start){const final=structuredClone(doc.mapRef.current!);doc.setMap(start);if(JSON.stringify(start)!==JSON.stringify(final))push(m=>Object.assign(m,final));}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);return;}
    if(lightGesture.current){
      const gesture=lightGesture.current, final=lightGestureValue(e);
      lightGesture.current=null;setLightPreview(null);paintRef.current=false;
      if(!gesture.handle){push(m=>{m.svetla=[...(m.svetla || []),final];});setSel([{kind:"svetlo",id:final.id}]);setTool("select");setTab(current=>lightPlacementTab(panelPinned,current));if(!panelPinned)setPanelOpen(true);}
      else if(final!==gesture.light)push(m=>{updateLight(m,final.id,final);});
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    if (strokeRef.current) {
      const s = strokeRef.current; strokeRef.current = null;
      ops.appendPaintPoint(s.stroke.p, toWorld(e), .001);
      push(m => ops.paintStroke(m, s.stroke, s.erase));
      setPaintPreview(null);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    if (panRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    panRef.current = null; setPanning(false); paintRef.current = false;
    if (moveRef.current || handleDrag || placementRef.current) {
      moveRef.current = null; placementRef.current = null; setHandleDrag(null);
      const start = transformStart.current; transformStart.current = null;
      if (start) {
        const final = structuredClone(doc.mapRef.current!);
        doc.setMap(start);
        if (JSON.stringify(start) !== JSON.stringify(final)) push(m => Object.assign(m, final));
      }
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    if (marquee) {
      const s = ops.pickInRect({...playerMap!,trasy:layerVis.trasy?playerMap!.trasy:[]}, marquee.a, marquee.b);
      setSel(s); setMarquee(null); return;
    }
    if (dragPt) {
      const { a, b } = dragPt; setDragPt(null);
      if (tool === "fill") push((m) => ops.fillRect(m, a, b, brushTile));
      else if (tool === "mistnost") push((m) => ops.roomPolygon(m, ops.rectanglePoints(a, b, shapeAngle), floorFill ? brushTex : undefined, shapeAngle));
      else if (tool === "kresba") {
        const pts = drawKind === "free" ? freePts : drawKind === "rect" ? ops.rectanglePoints(a, b, shapeAngle) : [a, b];
        if (pts.length >= 2) push((m) => { m.kresby = [...(m.kresby || []), { id: "k" + Date.now() % 1e6, kind: drawKind === "rect" ? "poly" : drawKind, pts, stroke: drawColor, fill: drawFill || undefined, width: drawW, dmOnly: drawDm }]; });
        setFreePts([]);
      }
    }
  };
  const onDbl = () => {
    if(tool==="trasa"){finishRoute();return;}
    if ((tool === "polygon" || tool === "interier") && roomPoints.length >= 3) { push(m => tool === "interier" ? ops.interiorPolygon(m,roomPoints) : ops.roomPolygon(m, roomPoints, floorFill ? brushTex : undefined, shapeAngle)); setRoomPoints([]); }
    if (tool === "stena") setWallDraft([]);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey && sel.length === 1 && sel[0].kind === "objekt") {
      if (!doc.mapRef.current?.objekty?.some(o => o.id === sel[0].id)) { setSel([]); return; }
      push(m => ops.rotateSel(m, sel, e.deltaY < 0 ? 15 : -15));
      return;
    }
    const r = svgRef.current!.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  };

  const playerMap = React.useMemo(() => {
    if(!map)return null;
    const rendered=lightPreview?{...map,svetla:[...(map.svetla || []).filter(l=>l.id!==lightPreview.id),lightPreview]}:map;
    return playerPreviewMap(rendered,playerPreview);
  },[map,playerPreview,lightPreview]);
  /* ---------- render ---------- */
  if (!map) return <div className="me-ed me-loading">Načítám mapu…</div>;
  const selObject = sel.length === 1 && sel[0].kind === "objekt" ? (map.objekty || []).find((o) => o.id === sel[0].id) : null;
  const toolInfo = TOOLS.find((t) => t.id === tool)!;
  const previewMap = playerMap!;
  const selectedLight=(previewMap.svetla || []).find(l=>l.id===(lightPreview?.id || (sel.length===1 && sel[0].kind==="svetlo"?sel[0].id:null)));
  const selectedRoute=sel.length===1&&sel[0].kind==="trasa"?map.trasy?.find(r=>r.id===sel[0].id):undefined;
  const commands: EditorCommand[] = [
    ...TOOLS.map(t => ({id:"tool-"+t.id,label:t.nazev,group:"Nástroje · "+t.key,icon:t.icon,run:() => setTool(t.id)})),
    ...TABS.map(([id,icon,label]) => ({id:"panel-"+id,label,group:"Panely",icon,run:() => {setTab(id);setPanelOpen(true);}})),
    ...Object.values(ASSETS).map(a => ({id:"asset-"+a.id,label:a.nazev,group:"Objekty · "+(a.kategorie || "Vlastní"),image:assetUrl(a.src),run:() => {setStampId(a.id);setChosenVariant(0);rerollPlacement();setTool("objekt");rememberAsset(a.id);}})),
    ...Object.values(texQ.data || {}).map(t => ({id:"texture-"+t.id,label:t.nazev,group:"Textury",image:assetUrl(t.src),run:() => {setBrushTex(t.id);setTool("malba");}})),
    ...WEATHER.map(([typ,label]) => ({id:"weather-"+typ,label,group:"Počasí",run:() => {push(m => {m.pocasi={...m.pocasi,typ};});setTab("mapa");setPanelOpen(true);}})),
  ];

  return (
    <div className="me-ed" style={{"--panel-width":`${panelWidth}px`,"--sheet-height":`${sheetHeight}dvh`} as React.CSSProperties}>
      <header className="me-ed-head">
        <Link to="/boj/mapy" className="me-btn ghost me-back" onClick={e => {if(doc.dirty && !confirm("Neuložené změny. Opravdu opustit editor?")) e.preventDefault();}}><ArrowLeft size={15} /><span>Zpět</span></Link>
        <input className="me-name" aria-label="Název mapy" value={map.nazev} onChange={(e) => push((m) => { m.nazev = e.target.value; })} />
        <span className={`me-savestate ${doc.dirty ? "dirty" : ""}`}>{doc.saving ? "Ukládám…" : doc.dirty ? "Neuloženo" : "Uloženo"}</span>
        <div className="me-history"><button className="me-btn sm" onClick={doc.undo} title="Zpět (Ctrl+Z)" disabled={!doc.canUndo()}><Undo2 size={15} /></button>
        <button className="me-btn sm" onClick={doc.redo} title="Znovu (Ctrl+Y)" disabled={!doc.canRedo()}><Redo2 size={15} /></button></div>
        <div className="me-view-controls me-segments"><button aria-pressed={layerVis.mrizka} onClick={() => setLayerVis(s => ({...s,mrizka:!s.mrizka}))}><Grid2X2 size={15} /> Mřížka</button><AnimationButton /><button aria-pressed={playerPreview} onClick={() => setPlayerPreview(!playerPreview)}><Eye size={15} /> Náhled hráče</button></div>
        <div className="me-head-actions"><button className="me-btn me-keys" onClick={() => setHelpOpen(true)}><Keyboard size={15} /> Klávesy <kbd>?</kbd></button>
        <button className="me-btn primary" onClick={doc.save} title="Ctrl+S"><Save size={15} /> Uložit <kbd>Ctrl S</kbd></button>
        <button className="me-btn me-battle-link" onClick={async () => { await doc.save(); nav("/boj"); }} title="Uložit a otevřít boj"><Swords size={15} /><span>Otevřít v boji</span></button>
        <button className="me-btn sm me-panel-toggle" onClick={() => setPanelOpen(!panelOpen)} aria-label="Panely" title="Panely (Tab)">{panelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}<span>Panely</span></button></div>
        <details className="me-overflow-menu"><summary className="me-btn" aria-label="Další akce"><MoreHorizontal size={18} /></summary><div>
          <button className="me-btn" onClick={() => setHelpOpen(true)}><Keyboard size={16} /> Klávesy (?)</button><button className="me-btn" onClick={() => setPaletteOpen(true)}><Command size={16} /> Rychlé příkazy</button>
          <button className="me-btn" onClick={doc.undo} disabled={!doc.canUndo()}><Undo2 size={16} /> Zpět</button><button className="me-btn" onClick={doc.redo} disabled={!doc.canRedo()}><Redo2 size={16} /> Znovu</button>
          <button className="me-btn" onClick={() => setLayerVis(s => ({...s,mrizka:!s.mrizka}))}><Grid2X2 size={16} /> Mřížka</button><AnimationButton /><button className="me-btn" onClick={() => setPlayerPreview(!playerPreview)}><Eye size={16} /> Náhled hráče</button>
          <button className="me-btn" onClick={() => fs ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>{fs ? <Minimize size={16} /> : <Maximize size={16} />} Celá obrazovka</button>
          <button className="me-btn" onClick={async () => {await doc.save();nav("/boj");}}><Swords size={16} /> Otevřít v boji</button></div></details>
      </header>

      <div className="me-ed-body">
        <ToolRail tools={TOOLS} active={tool} onPick={id => setTool(id as Tool)} />

        <div className="me-center">
          <div className="me-ctx">
            <span className="me-ctx-tool">{toolInfo.icon}{toolInfo.nazev}</span><details className="me-info"><summary aria-label="Nápověda nástroje"><Info size={16} /></summary><div><strong>{toolInfo.nazev} <kbd>{toolInfo.key}</kbd></strong><p>{TOOL_HINTS[tool]}</p><p>Mezerník + tažení: posun · kolečko: zoom<br />Q / E: otočení · A / Shift+A: varianty</p></div></details>
            {tool === "teren" || tool === "fill" || tool === "flood" ? (
              <>
                <span className="me-ctx-lab">Dlaždice:</span>
                <TilePicker value={brushTile} onChange={setBrushTile} ground={map.podklad} />
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
              <TexturePicker value={brushTex} onChange={setBrushTex} />
            )}
            {tool === "malba" && <>
              <TexturePicker value={brushTex} onChange={setBrushTex} />
              <label>Průměr {paintSize}<input aria-label="Průměr štětce" type="range" min=".25" max="8" step=".25" value={paintSize} onChange={e => setPaintSize(+e.target.value)} /></label>
              <label>Krytí {Math.round(paintOpacity * 100)} %<input aria-label="Krytí malby" type="range" min="0" max="1" step=".05" value={paintOpacity} onChange={e => setPaintOpacity(+e.target.value)} /></label>
              <label>Tvrdost {Math.round(paintHardness * 100)} %<input aria-label="Tvrdost štětce" type="range" min="0" max="1" step=".05" value={paintHardness} onChange={e => setPaintHardness(+e.target.value)} /></label>
              <label>Natočení {paintAngle}°<input aria-label="Natočení textury" type="range" min="-180" max="180" step="1" value={paintAngle} onChange={e => setPaintAngle(+e.target.value)} /></label>
              <label><input type="checkbox" checked={paintRandom} onChange={e => setPaintRandom(e.target.checked)} /> Náhodně</label>
              <button className={`me-btn sm ${paintErase ? "on" : ""}`} onClick={() => setPaintErase(!paintErase)}>Guma tahů</button>
              <span className="me-ctx-hint">Alt: mazat celé tahy</span>
            </>}
            {tool === "interier" && <>
              <span className="me-ctx-hint">Vrchol po vrcholu · dvojklik uzavře střechu · Alt+klik odstraní interiér</span>
              {roomPoints.length >= 3 && <button className="me-btn sm" onClick={() => { push(m => ops.interiorPolygon(m,roomPoints)); setRoomPoints([]); }}>Označit interiér</button>}
            </>}
            {(tool === "mistnost" || tool === "polygon") && (
              <>
                <span className="me-ctx-lab">Textura:</span>
                <TexturePicker value={brushTex} onChange={setBrushTex} />
                <label>Úhel (°)<input aria-label="Úhel místnosti" type="number" value={shapeAngle} onChange={e => setShapeAngle(+e.target.value)} style={{ width: 60 }} /></label>
                <label><input type="checkbox" checked={floorFill} onChange={e => setFloorFill(e.target.checked)} /> Podlaha</label>
                <span className="me-ctx-hint">{tool === "polygon" ? "Klikáním vrcholy, dvojklik uzavře · Alt bez přichytávání" : "Táhni → natočená podlaha a zdi"}</span>
                {tool === "polygon" && roomPoints.length >= 3 && <button onClick={() => { push(m => ops.roomPolygon(m, roomPoints, floorFill ? brushTex : undefined, shapeAngle)); setRoomPoints([]); }}>Uzavřít místnost</button>}
              </>
            )}
            {tool === "stena" && (
              <>
                <WallPicker value={wallTyp} onChange={setWallTyp} />
                <label className="me-ctx-chk"><input type="checkbox" checked={wallLocked} onChange={(e) => setWallLocked(e.target.checked)} /> zamčené</label>
                {wallDraft.length > 0 && <button className="me-btn sm" onClick={() => { push((m) => ops.wallChain(m, wallDraft, wallTyp, wallLocked, true)); setWallDraft([]); }}>Uzavřít ({wallDraft.length})</button>}
              </>
            )}
            {tool === "objekt" && <><label><input type="checkbox" checked={randomRotation} onChange={e => setRandomRotation(e.target.checked)} /> Náhodné natočení</label>
              <label><input type="checkbox" checked={randomVariants} onChange={e => { setRandomVariants(e.target.checked); rerollPlacement(); }} /> Náhodná varianta</label>
              <label>Počet<input aria-label="Počet rozházených objektů" type="number" min="1" max="100" value={scatterCount} onChange={e => setScatterCount(Math.max(1,Math.min(100,+e.target.value || 1)))} /></label>
              <button className="me-btn sm" onClick={scatterObjects}>Rozházet</button>
              <span className="me-ctx-hint">V: přesun · A: další varianta · Shift+A: náhodná · Ctrl+D: duplikovat · Q/E: otočit</span></>}
            {tool === "kresba" && (
              <>
                {(["free", "line", "rect", "ellipse", "poly", "text"] as const).map((kd) => (
                  <button key={kd} className={`me-btn sm ${drawKind === kd ? "on" : ""}`} onClick={() => setDrawKind(kd)}>{{free:"Volně",line:"Čára",rect:"Obdélník",ellipse:"Elipsa",poly:"Polygon",text:"Text"}[kd]}</button>))}
                {drawKind === "rect" && <label>Úhel (°)<input aria-label="Úhel kresby" type="number" value={shapeAngle} onChange={e => setShapeAngle(+e.target.value)} style={{ width: 60 }} /></label>}
                <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} title="Barva" />
                <input type="color" value={drawFill || "#000000"} onChange={(e) => setDrawFill(e.target.value)} title="Výplň" />
                <label>Tloušťka {drawW}<input aria-label="Tloušťka kresby" type="range" min={0.05} max={0.5} step={0.05} value={drawW} onChange={(e) => setDrawW(+e.target.value)} /></label>
                <label className="me-ctx-chk"><input type="checkbox" checked={drawDm} onChange={(e) => setDrawDm(e.target.checked)} /> Jen DM</label>
              </>
            )}
            {tool === "vyska" && <><span className="me-ctx-lab">Krok:</span>{[5, 10, 20].map((s) => <button key={s} className={`me-btn sm ${elevStep === s ? "on" : ""}`} onClick={() => setElevStep(s)}>{s} ft</button>)}<span className="me-ctx-hint">klik +, Alt+klik −</span></>}
            {tool === "svetlo" && (
              <>
                <LightShapePicker value={lightSettings} onChange={patch=>setLightSettings(l=>editedLight(l,patch))}/>
                <span className="me-light-preset-label">{lightSettings.nazev}</span>
                <button className="me-btn sm" onClick={()=>{setTab("vlastnosti");setPanelOpen(true);}}>Nastavení světla</button>
                <span className="me-ctx-hint">Klik: umístit · tažení: namířit a nastavit dosah</span>
              </>
            )}
            {tool === "start" && START_TYPY.map(([v, n]) => <button key={v} className={`me-btn sm ${startTyp === v ? "on" : ""}`} onClick={() => setStartTyp(v as any)}>{n}</button>)}
          </div>

          <div ref={wrapRef} className="me-canvas-wrap" onDragOver={e => {if(e.dataTransfer.types.includes("application/x-montelien-asset")){e.preventDefault();e.dataTransfer.dropEffect="copy";}}}
            onDrop={e => { const aid = e.dataTransfer.getData("application/x-montelien-asset"); if(!ASSETS[aid] && !stampById(aid)) return; e.preventDefault(); const [wx,wy] = toWorld(e); if(wx < 0 || wy < 0 || wx >= W || wy >= H) return; const object = makeObject(snap ? Math.round(wx/snap)*snap : wx,snap ? Math.round(wy/snap)*snap : wy,aid); push(m => {m.objekty=[...(m.objekty || []),object];}); rememberAsset(aid); setSel([{kind:"objekt",id:object.id}]); }}>
            <MapAnimatedScene map={previewMap} view={V} dm={!playerPreview} terrain={layerVis.teren} objects={layerVis.objekty} lights={layerVis.svetla} routes={layerVis.trasy} illustration={!!(layerVis.obrazek && map.obrazek)} details={<>
              {layerVis.mrizka && <MapGridLayer map={map} W={W} H={H} />}
              {layerVis.vyska && <MapElevationLayer map={map} />}
              {layerVis.kresby && <MapDrawingLayer map={previewMap} dm={!playerPreview} />}
              {layerVis.steny && <MapWallLayer map={map} dm={!playerPreview} />}
            </>}>
              <rect width={W * PX} height={H * PX} fill="#4a453e" />
              {layerVis.obrazek && map.obrazek && <image href={`/repo/11_Mapy/${map.obrazek}`} width={W * PX} height={H * PX} preserveAspectRatio="none" opacity={0.9} />}
              {layerVis.teren && <TerenLayer staticOnly map={map} px={PX} illustration={!!(layerVis.obrazek && map.obrazek)} />}
              {layerVis.textury && <MapTextureLayer map={map} />}
              {layerVis.malba && <MapPaintLayer map={map} preview={paintPreview || undefined} />}
            </MapAnimatedScene>
            <svg ref={svgRef} className={`me-canvas tool-${tool}`} onWheel={onWheel}
                 onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDbl}
                 onPointerCancel={() => { lightGesture.current=null;setLightPreview(null);strokeRef.current = null; placementRef.current = null; setPaintPreview(null); paintRef.current = false; if (transformStart.current) doc.setMap(transformStart.current); transformStart.current = null; moveRef.current = null; setHandleDrag(null); }}
                 onPointerLeave={() => setCur(null)} onContextMenu={(e) => { e.preventDefault(); const [x,y] = toWorld(e); const hit = ops.pickAt({...previewMap,trasy:layerVis.trasy?previewMap.trasy:[]},x,y,true); if(hit?.kind === "objekt"||hit?.kind === "trasa"||hit?.kind==="svetlo"){if(!sel.some(s => s.id === hit.id)) setSel([hit]);setRoutePoint(null);setContextMenu({x:Math.max(8,Math.min(window.innerWidth-240,e.clientX)),y:Math.max(8,Math.min(window.innerHeight-380,e.clientY))});} }}
                 style={{ touchAction: "none", width: "100%", height: "100%", display: "block" }}>
              <g transform={`translate(${V.x},${V.y}) scale(${V.k})`}>
                {layerVis.svetla && <MapAtmosphereLayer map={previewMap} />}
                {layerVis.poznamky && !playerPreview && <MapNoteLayer map={map} />}
                {layerVis.starty && !playerPreview && START_TYPY.map(([typ]) =>
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
                {tool === "interier" && map.interiery?.map(r => <polygon key={r.id} points={r.poly.map(([x,y]) => `${x*PX},${y*PX}`).join(" ")} fill="#38bdf833" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="6 3" pointerEvents="none" />)}
                {roomPoints.length > 0 && <polyline points={roomPoints.map(([x, y]) => `${x * PX},${y * PX}`).join(" ")} fill="#f59e0b22" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />}
                {dragPt && tool === "mistnost" && <polygon points={ops.rectanglePoints(dragPt.a, dragPt.b, shapeAngle).map(([x,y]) => `${x*PX},${y*PX}`).join(" ")} fill="#f59e0b22" stroke="#f59e0b" strokeWidth={2} />}
                {dragPt && tool === "fill" && (
                  <rect x={Math.min(dragPt.a[0], dragPt.b[0]) * PX} y={Math.min(dragPt.a[1], dragPt.b[1]) * PX}
                        width={(Math.abs(dragPt.b[0] - dragPt.a[0]) + 1) * PX} height={(Math.abs(dragPt.b[1] - dragPt.a[1]) + 1) * PX}
                        fill="#f59e0b" opacity={0.2} stroke="#f59e0b" strokeWidth={1.5} />)}
                {dragPt && tool === "kresba" && drawKind === "rect" && <polygon points={ops.rectanglePoints(dragPt.a,dragPt.b,shapeAngle).map(([x,y]) => `${x*PX},${y*PX}`).join(" ")} fill={drawFill || "none"} stroke={drawColor} strokeWidth={drawW*PX} opacity={.8} />}
                {dragPt && tool === "kresba" && drawKind !== "free" && drawKind !== "rect" && (
                  <rect x={Math.min(dragPt.a[0], dragPt.b[0]) * PX} y={Math.min(dragPt.a[1], dragPt.b[1]) * PX}
                        width={Math.abs(dragPt.b[0] - dragPt.a[0]) * PX} height={Math.abs(dragPt.b[1] - dragPt.a[1]) * PX}
                        fill={drawFill || "none"} stroke={drawColor} strokeWidth={drawW * PX} opacity={.8} />)}
                {tool === "kresba" && drawKind === "free" && freePts.length > 1 && (
                  <polyline points={freePts.map(([x, y]) => `${x * PX},${y * PX}`).join(" ")} fill="none" stroke={drawColor} strokeWidth={drawW * PX} />)}
                {marquee && <rect x={Math.min(marquee.a[0], marquee.b[0]) * PX} y={Math.min(marquee.a[1], marquee.b[1]) * PX}
                                  width={Math.abs(marquee.b[0] - marquee.a[0]) * PX} height={Math.abs(marquee.b[1] - marquee.a[1]) * PX}
                                  fill="#d4a24c" opacity={.12} stroke="#d4a24c" strokeWidth={1} strokeDasharray="3 3" />}
                {/* výběr + úchyty */}
                {sel.map((s) => {
                  const o = s.kind === "objekt" ? (previewMap.objekty || []).find((o) => o.id === s.id) : null;
                  if (!o) return null;
                  const w = o.w * PX, h = o.h * PX;
                  return (
                    <g key={s.id} transform={`translate(${o.x * PX},${o.y * PX}) rotate(${o.rot || 0})`}>
                      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke="#d4a24c" strokeWidth={1.4} strokeDasharray="4 2" />
                      {[-1, 1].flatMap(sx => [-1, 1].map(sy => <rect key={sx+","+sy} aria-label="Změnit velikost" x={sx*w / 2 - 4} y={sy*h / 2 - 4} width={8} height={8} fill="#d4a24c" stroke="#fff" strokeWidth={1}
                            style={{ cursor: "nwse-resize" }} onPointerDown={(e) => { e.stopPropagation(); transformStart.current = structuredClone(map); svgRef.current!.setPointerCapture(e.pointerId); setHandleDrag("scale"); }} />))}
                      <circle cx={0} cy={-h / 2 - 10} r={5} fill="#d4a24c" stroke="#fff" strokeWidth={1}
                              aria-label="Otočit objekt" style={{ cursor: "grab" }} onPointerDown={(e) => { e.stopPropagation(); transformStart.current = structuredClone(map); svgRef.current!.setPointerCapture(e.pointerId); setHandleDrag("rot"); }} />
                      <line pointerEvents="none" x1={0} y1={-h / 2} x2={0} y2={-h / 2 - 10} stroke="#d4a24c" strokeWidth={1} />
                    </g>
                  );
                })}
                {tool==="trasa"&&routePoints.length>0&&<g opacity=".8"><MapRouteLayer map={{trasy:[{...routeSettings,pts:[...routePoints,...(cur?[[cur.wx??cur.x,cur.wy??cur.y] as [number,number]]:[])]}]}}/><polyline points={routePoints.map(p=>p.map(n=>n*PX).join(",")).join(" ")} fill="none" stroke="#ecc578" strokeWidth={1/V.k} strokeDasharray="4 4"/>{routePoints.map(([x,y],i)=><circle key={i} cx={x*PX} cy={y*PX} r={3/V.k} fill="#ecc578"/>)}</g>}
                {selectedRoute&&layerVis.trasy&&tool==="select"&&<g data-route-handles={selectedRoute.id}><polyline points={selectedRoute.pts.map(p=>p.map(n=>n*PX).join(",")).join(" ")} fill="none" stroke="#e6be6a" strokeWidth={1/V.k} strokeDasharray="4 3" pointerEvents="none"/>{selectedRoute.pts.map(([x,y],i)=><circle key={i} data-route-point={i} aria-label={`Uzel trasy ${i+1}`} cx={x*PX} cy={y*PX} r={5/V.k} fill={routePoint===i?"#fff0ba":"#cc9b43"} stroke="#211e17" strokeWidth={1.5/V.k} style={{cursor:"grab"}} onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();setRoutePoint(i);routeDrag.current={id:selectedRoute.id,point:i};transformStart.current=structuredClone(map);svgRef.current?.setPointerCapture(e.pointerId);}}/>)}</g>}
                {selectedLight && layerVis.svetla && lightHandlesEnabled(tool) && <LightHandles light={selectedLight} zoom={V.k} onBegin={(e,handle)=>{
                  if(e.button!==0)return;
                  e.preventDefault();e.stopPropagation();
                  const light=doc.mapRef.current?.svetla?.find(l=>l.id===selectedLight.id);
                  if(!light)return;
                  lightGesture.current={light,anchor:toWorld(e),screen:[e.clientX,e.clientY],handle};
                  setLightPreview(light);svgRef.current?.setPointerCapture(e.pointerId);
                }}/>}
                {cur && tool === "objekt" && <g opacity={.6} data-object-ghost>
                  <MapObjectLayer dm map={{...map,objekty:[{
                    id:"ghost",asset:stampId,v:nextPlacementVariant,
                    x:snap === 0 ? cur.wx ?? cur.x : cur.x + .5, y:snap === 0 ? cur.wy ?? cur.y : cur.y + .5,
                    w:(stampById(stampId) || ASSETS[stampId])?.w || 1, h:(stampById(stampId) || ASSETS[stampId])?.h || 1,
                    rot:randomRotation ? rotationRoll.current * 360 : 0,
                  }]}} />
                </g>}
                {cur && (tool === "teren" || tool === "textura" || tool === "guma") &&
                  ops.brushCells(cur.x, cur.y, brushSize, brushShape).map(([x, y]) => <rect key={"b" + x + "," + y} x={x * PX} y={y * PX} width={PX} height={PX} fill="none" stroke="#fbbf24" strokeWidth={1} opacity={.7} />)}
                {calib && calib.pts.map((p, i) => <circle key={i} cx={p[0] * PX} cy={p[1] * PX} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />)}
              </g>
            </svg>
            <MapWeatherOverlay map={map} view={V} />
            <EditorMinimap map={previewMap} view={V} width={canvasSize.width} height={canvasSize.height} onCenter={(x,y) => setV(v => ({...v,x:canvasSize.width/2-x*v.k,y:canvasSize.height/2-y*v.k}))} />
            {firstHint && <aside className="me-welcome"><button className="me-btn sm" aria-label="Skrýt úvodní tip" onClick={() => {setFirstHint(false);writePreference("me-welcome-dismissed",true);}}><X size={15} /></button><small>VÁŠ SVĚT, VAŠE PRAVIDLA</small><h3>Od prvního tahu k dobrodružství</h3><ol><li>Vyber nástroj vlevo a uprav terén.</li><li>Z knihovny přetáhni objekty do mapy.</li><li>Vyber objekt a dolaď jej ve Vlastnostech.</li></ol><button className="me-btn ghost" onClick={() => setHelpOpen(true)}><Keyboard size={14} /> Prohlédnout zkratky</button></aside>}
          </div>

          <footer className="me-status">
            <span className="me-cursor-status">{cur ? `Pole ${cur.x}, ${cur.y}` : "Připraveno"}</span>
            {cur && <span className="me-tile-status">{TILES[map.mrizka[cur.y]?.[cur.x]]?.nazev || map.mrizka[cur.y]?.[cur.x] || "—"}</span>}
            {cur && map.textury?.[k2(cur.x, cur.y)] && <span>tex {textureById(map.textury[k2(cur.x, cur.y)])?.nazev}</span>}
            {cur && map.vyska?.[k2(cur.x, cur.y)] != null && <span>elev {map.vyska[k2(cur.x, cur.y)]} ft</span>}
            <span className="me-sp" />
            <span>{sel.length} vybráno</span><span className="me-status-snap">Přichytit</span><div className="me-segments" aria-label="Přichytávání">{([1,.5,0] as const).map(s => <button key={s} aria-pressed={snap === s} onClick={() => setSnap(s)}>{s || "vyp"}</button>)}</div>
            <button className={`me-btn sm ${layerVis.mrizka ? "on" : ""}`} aria-label="Mřížka" aria-pressed={layerVis.mrizka} onClick={() => setLayerVis(s => ({...s,mrizka:!s.mrizka}))}><Grid2X2 size={14} /></button>
            <div className="me-zoom"><button className="me-btn sm" aria-label="Oddálit" onClick={() => zoomAt(.8)}><Minus size={14} /></button><select aria-label="Přiblížení" value={String(Math.round(V.k*100))} onChange={e => zoomAt(+e.target.value / (V.k*100))}>{[...new Set([25,50,75,100,125,150,200,300,400,Math.round(V.k*100)])].sort((a,b) => a-b).map(z => <option key={z} value={z}>{z} %</option>)}</select><button className="me-btn sm" aria-label="Přiblížit" onClick={() => zoomAt(1.25)}><Plus size={14} /></button></div><button className="me-btn sm me-fit" onClick={fit} title="Přizpůsobit (0)"><Maximize size={14} /><span>Přizpůsobit</span></button>
          </footer>
        </div>

        {panelOpen && <button className="me-panel-backdrop" aria-label="Zavřít panely" onClick={() => setPanelOpen(false)} />}
        <aside className={`me-right ${panelOpen ? "open" : ""}`} aria-label="Panely editoru">
          <div className="me-panel-resize" role="separator" tabIndex={0} aria-label="Šířka panelu" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={480} aria-valuenow={panelWidth}
            onKeyDown={e => {if(e.key === "ArrowLeft" || e.key === "ArrowRight"){e.preventDefault();e.stopPropagation();setPanelWidth(w => Math.max(280,Math.min(480,w+(e.key === "ArrowLeft" ? 16 : -16))));}}}
            onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={e => {if(e.currentTarget.hasPointerCapture(e.pointerId)) setPanelWidth(Math.max(280,Math.min(480,window.innerWidth-e.clientX)));}} />
          <div className="me-panel-heading"><div className="me-sheet-handle" role="slider" tabIndex={0} aria-label="Výška panelů" aria-valuemin={30} aria-valuemax={85} aria-valuenow={sheetHeight}
            onKeyDown={e => {if(e.key === "ArrowUp" || e.key === "ArrowDown"){e.preventDefault();e.stopPropagation();setSheetHeight(h => Math.max(30,Math.min(85,h+(e.key === "ArrowUp" ? 5 : -5))));}}}
            onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={e => {if(e.currentTarget.hasPointerCapture(e.pointerId)) setSheetHeight(Math.max(30,Math.min(85,(window.innerHeight-e.clientY)/window.innerHeight*100)));}}><span /></div><strong>Pracovní prostor</strong><button className={`me-btn sm ${panelPinned ? "on" : ""}`} aria-label={panelPinned ? "Odepnout panel" : "Připnout panel"} aria-pressed={panelPinned} onClick={() => setPanelPinned(!panelPinned)} title="Připnutí vypne automatické přepínání">{panelPinned ? <PinOff size={15} /> : <Pin size={15} />}</button><button className="me-btn sm" aria-label="Zavřít panel" title="Skrýt (Tab)" onClick={() => setPanelOpen(false)}><X size={16} /></button></div>
          <div className="me-tabs">
            {TABS.map(([t, ic, n]) => (
              <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)} title={n}>{ic}<span className="me-tab-n">{n}</span></button>
            ))}
          </div>
          <div className="me-right-body">
            {tab === "vrstvy" && <LayersPanel map={map} layerVis={layerVis} setLayerVis={setLayerVis} />}
            {tab === "knihovna" && <LibraryPanel q={stampQ} setQ={setStampQ} kat={stampKat} setKat={setStampKat}
              mode={libraryMode} onMode={setLibraryMode} ground={map.podklad} tile={brushTile} texture={brushTex}
              onTile={id => {setBrushTile(id); if(!["teren","fill","flood"].includes(tool)) setTool("teren");}} onTexture={id => {setBrushTex(id);if(!["textura","malba","mistnost","polygon"].includes(tool)) setTool("malba");}}
              stampId={stampId} ASSETS={ASSETS} onUpload={uploadAsset} variant={chosenVariant}
              onVariant={v => { setChosenVariant(v); setRandomVariants(false); }}
              onPick={(sid) => { setStampId(sid); setChosenVariant(0); rerollPlacement(); setTool("objekt"); }} />}
            {tab === "vlastnosti" && (tool==="trasa"?<><RouteInspector value={routeSettings} onChange={p=>setRouteSettings(r=>({...r,...p}))}/><button className="me-btn" disabled={routePoints.length<2} onClick={finishRoute}>Dokončit trasu</button></>:selectedRoute?<RouteInspector value={selectedRoute} point={routePoint} onDeletePoint={deleteRoutePoint} onDelete={deleteSelection} onChange={p=>push(m=>{m.trasy=m.trasy?.map(r=>r.id===selectedRoute.id?{...r,...p}:r);})}/>:tool==="svetlo"?<LightInspector placement value={lightSettings} onChange={patch=>setLightSettings(l=>editedLight(l,patch))}/>:<PropertiesPanel map={map} selObj={sel.length === 1 ? sel[0] : null} push={push}
              objects={(map.objekty || []).filter(o => sel.some(s => s.kind === "objekt" && s.id === o.id))}
              assets={ASSETS} onVariant={changeVariants} onAction={runObjectAction}
              onDelete={deleteSelection} />)}
            {tab === "generator" && <GeneratorPanel genId={genId} setGenId={setGenId} seed={genSeed} setSeed={setGenSeed}
              genPrev={genPrev} onPreview={() => { const g = GENERATORS.find((x) => x.id === genId)!; setGenPrev(g.fn(W, H, genSeed)); }}
              onApply={() => { push((m) => ops.applyGen(m, {...genPrev!,objekty:genPrev?.objekty?.map(o => ({
                ...o,v:placementVariant(ASSETS[o.asset],randomVariants,o.asset === stampId ? chosenVariant : 0),
              }))})); rerollPlacement(); setGenPrev(null); }}
              onDiscard={() => setGenPrev(null)} />}
            {tab === "mapa" && <MapPanel map={map} push={push} onResize={resize}
              onUploadImg={uploadImg} onImportUvtt={async (f) => {
                try { const d = JSON.parse(await f.text()); const r = importUvtt(d);
                  push((m) => { if (r.mrizka) m.mrizka = r.mrizka; if (r.steny) m.steny = [...(m.steny || []), ...r.steny]; if (r.svetla) m.svetla = r.svetla; if (r.kalibrace) m.kalibrace = r.kalibrace; });
                  toast("UVTT importováno", "ok");
                } catch (e: any) { toast("UVTT import selhal: " + e.message, "err"); } }}
              onExportUvtt={() => download(exportUvtt(map), `${map.id}.uvtt`)}
              onExportJson={() => download(JSON.stringify(map, null, 2), `${map.id}.json`)}
              onImportJson={async (f) => { try { const d = JSON.parse(await f.text()); push((m) => Object.assign(m, migrateMap(d, ASSETS))); } catch { toast("Neplatný JSON", "err"); } }}
              onExportPng={async () => {
                const [{ renderToStaticMarkup }, { MapPreview }] = await Promise.all([import("react-dom/server"), import("./MapPreview")]);
                const snapshot = new DOMParser().parseFromString(renderToStaticMarkup(<MapPreview map={map} staticLighting />), "image/svg+xml").documentElement;
                await exportPng(snapshot as unknown as SVGSVGElement, 70, `${map.id}.png`);
              }}
              calib={calib} setCalib={setCalib} />}
          </div>
        </aside>
      </div>
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {helpOpen && <ShortcutHelp tools={TOOLS} onClose={() => setHelpOpen(false)} />}
      {contextMenu && <><div className="me-menu-dismiss" onPointerDown={() => setContextMenu(null)} /><div className="me-object-menu" role="menu" aria-label={sel.some(s=>s.kind==="trasa")?"Akce trasy":"Akce objektu"} style={{left:contextMenu.x,top:contextMenu.y}} onKeyDown={e => {if(e.key === "Escape") setContextMenu(null);if(e.key === "ArrowDown" || e.key === "ArrowUp"){e.preventDefault();const buttons=[...e.currentTarget.querySelectorAll("button")];const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+(e.key === "ArrowDown" ? 1 : -1)+buttons.length)%buttons.length]?.focus();}}}>
        {(map.objekty?.some(o=>sel.some(s=>s.id===o.id)&&toggleable(o,ASSETS[o.asset])) || map.svetla?.some(l=>sel.some(s=>s.id===l.id))) && <button role="menuitem" onClick={()=>runObjectAction("toggle-source")}>Zapnout / vypnout zdroj<kbd>⇧ L</kbd></button>}
        <small>VÝBĚR · {sel.length}</small>{([["duplicate","Duplikovat",<Copy size={15} />],["rotate-left","Otočit −15°",<Undo2 size={15} />],["rotate-right","Otočit +15°",<Redo2 size={15} />],["flip","Překlopit",<Layers3 size={15} />],["front","Dopředu",<ArrowUp size={15} />],["back","Dozadu",<ArrowDown size={15} />]] as const).filter(([action])=>!sel.some(s=>s.kind==="trasa")||action==="duplicate").map(([action,label,icon],i) => <button key={action} autoFocus={i===0} role="menuitem" onClick={() => runObjectAction(action)}>{icon}{label}</button>)}{!sel.some(s=>s.kind==="trasa")&&<><hr /><button role="menuitem" onClick={() => {changeVariants("next");setContextMenu(null);}}>Další varianta<kbd>A</kbd></button><button role="menuitem" onClick={() => {changeVariants("random");setContextMenu(null);}}>Náhodná varianta<kbd>⇧ A</kbd></button></>}<hr /><button className="danger" role="menuitem" onClick={() => runObjectAction("delete")}><Trash2 size={15} /> Smazat<kbd>Del</kbd></button>
      </div></>}

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

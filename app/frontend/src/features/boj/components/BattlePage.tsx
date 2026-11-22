/* Hlavní stránka boje: layout, orchestrace (výběr, targeting, resolve, inspektor,
   přidávání, nástroje, zóny, kontextové menu, multi-select, klávesnice, bottom sheet). */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get } from "../../../api";
import { useApp, isEditor } from "../../../store";
import { toast, confirmDialog } from "../../../components/ui";
import { fogPlayerState, mapCells, updateFog } from "../model/fog";
import { pointInPolygon } from "../model/lightGeometry";
import { isInteractiveTarget } from "./shortcuts";
import { useAssetManifest, useTextureManifest } from "../../mapeditor/assets/manifest";
import { setManifests } from "./MapV2Layers";
import { type MapV2, type MapWall } from "../model/mapV2";
import {toggleSource} from "../state/commands/sources";
import { updateLightState } from "../model/lightState";
import { Link, useNavigate } from "react-router-dom";
import { useBattle } from "../state/useBattle";
import "../boj.css";
import * as C from "../state/commands";
import { byId, cur, log } from "../rules/turn";
import { presetById } from "../rules/effects";
import { tokensInArea } from "../rules/areas";
import { planMovement, type MovementPlan } from "../rules/movement";
import { settingsOf } from "../rules/settings";
import { isFree } from "../rules/free";
import { reactionOptions, applyReaction, type ReactionOption, type ReactionTrigger } from "../rules/actions/reactions";
import { resolveAttack } from "../rules/attack";
import { previewDamage } from "../rules/damage";
import type { AttackDef, BattleMapData, Token, EffectPreset, MoveMode } from "../types";
import { uid } from "../types";
import MovePopover, { type DropReq } from "./MovePopover";
import OverridePrompt, { type OverrideOption } from "./OverridePrompt";
import SettingsPanel from "./SettingsPanel";
import BattleMap, { type Targeting, type ZonePlace, type MoveAtkPreview } from "./BattleMap";
import InitiativeBar, { MiniCoin } from "./InitiativeBar";
import ActorPanel from "./ActorPanel";
import TokenInspector from "./TokenInspector";
import AddCombatants, { freeSpot } from "./AddCombatants";
import CombatLog from "./CombatLog";
import ResolveDialog, { type Resolve } from "./ResolveDialog";
import EffectsPanel from "./EffectsPanel";
import ToolsPanel from "./ToolsPanel";
import TurnBanner from "./TurnBanner";
import { TurnHud, TargetHud } from "./CombatHud";
import type { ActionGroup } from "./combatHudModel";
import CtxMenu from "./CtxMenu";
import HelpOverlay from "./HelpOverlay";
import { difficulty } from "../rules/encounter";
import { resourceAction } from "../rules/resources";
import { MousePointer2, Ruler, MapPin, Users, Eraser, ScrollText, ShieldQuestion, X, Sparkles, Globe2, HelpCircle, Settings, Type, PanelRightClose, PanelRightOpen, MoreHorizontal , Maximize, PenLine, Eye} from "lucide-react";

type Panel = "akce" | "efekty" | "prostredi" | "inspektor" | "log";

export default function BattlePage() {
  const [params] = useSearchParams();
  const bid = params.get("boj") || "";
  const { user, previewPlayer } = useApp();
  const dm = isEditor(user) && !previewPlayer;
  const b = useBattle(bid);
  const [sel, setSel] = useState<string | null>(null);
  const [selSet, setSelSet] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<Panel>("akce");
  const [actionGroup, setActionGroup] = useState<ActionGroup>("all");
  const [hoverToken, setHoverToken] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "measure" | "zone" | "paint" | "fog" | "fog-room" | "light" | "kresba">("select");
  const [paintTile, setPaintTile] = useState("#");
  const [fogMode, setFogMode] = useState<"reveal" | "hide">("reveal");
  const [fogOverlay, setFogOverlay] = useState(false);
  const [viewAsPlayer, setViewAsPlayer] = useState(false);
  const [fogRoom, setFogRoom] = useState<string | null>(null);
  const fogInitialized = useRef("");
  const [zonePlace, setZonePlace] = useState<ZonePlace | null>(null);
  const [drawColor, setDrawColor] = useState("#f59e0b");
  const [twin1, setTwin1] = useState<string | null>(null);
  const [rx, setRx] = useState<{ opts: ReactionOption[]; run: (o?: ReactionOption) => void } | null>(null);
  const [pendingLight, setPendingLight] = useState<{ nazev: string; bright: number; dim: number } | null>(null);
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [resolve, setResolve] = useState<Resolve | null>(null);
  const [moveAtk, setMoveAtk] = useState<{ plan: MoveAtkPreview; tgtId: string; atk: AttackDef; srcId: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [onboardHide, setOnboardHide] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ t: Token; x: number; y: number } | null>(null);
  const [help, setHelp] = useState(false);
  const [dropReq, setDropReq] = useState<DropReq | null>(null);       // MovePopover při dropu
  const [ov, setOv] = useState<{ title: string; reason?: string; options: OverrideOption[]; children?: React.ReactNode } | null>(null); // generický override
  const [dmgCfm, setDmgCfm] = useState<{ r: Resolve; o: { overrideAdv?: number | null; manualD20?: number; manualDmg?: number; slot?: number; pact?: boolean; override?: boolean }; rolled: number; base: number; applied: number; mods: string[]; tgt: string; tgtId: string; hit: boolean } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);                   // ⋯ menu v toolbaru (mobil)
  const [loh, setLoh] = useState<{ idx: number; max: number; nazev: string; amt: number } | null>(null); // Lay on Hands input
  const [setOpen, setSetOpen] = useState(false);                     // Nastavení boje
  const [sheet, setSheet] = useState<"peek" | "half" | "full">("peek");
  const [names, setNames] = useState<"hover" | "always">(() => (localStorage.getItem("boj-names") as "always") || "hover");
  const [hoverAtk, setHoverAtk] = useState<AttackDef | null>(null);
  const [sideW, setSideW] = useState(() => Math.min(520, Math.max(300, Number(localStorage.getItem("boj-sidew")) || 340)));
  const [sideMini, setSideMini] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetStart = useRef<number>(0);

  const maps = useQuery({
    queryKey: ["map-data"],
    queryFn: () => get<{ bojove_mapy: BattleMapData[] }>("/api/map/data"),
    staleTime: 300_000,
  });
  const map = useMemo(() => {
    const raw: any = maps.data as any;
    const list = (raw?.bojove_mapy || raw?.data?.bojove_mapy || raw?.mapy || []).map((m: any) => ({ ...(m.data || {}), ...m, data: undefined })) as BattleMapData[];
    return list.find((m) => m.id === b.S?.map) || list[0];
  }, [maps.data, b.S?.map]);
  useEffect(() => {
    if (!dm || !b.S || !map || fogInitialized.current === `${bid}:${map.id}`) return;
    fogInitialized.current = `${bid}:${map.id}`;
    const next = structuredClone(b.S);
    if (!next.fog && map.mlha) next.fog = { on: true, revealed: {}, visible: {} };
    updateFog(next, map);
    if (JSON.stringify(next.fog) !== JSON.stringify(b.S.fog)) b.dispatch(s => { s.fog = next.fog; });
  }, [bid, map, b.S, dm]);

  useEffect(() => { b.load(); }, [bid]);
  const assetsQ = useAssetManifest(); const texQ = useTextureManifest();
  useEffect(() => { setManifests(assetsQ.data || {}, texQ.data || {}); }, [assetsQ.data, texQ.data]);
  const [maxi, setMaxi] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    document.body.classList.toggle("boj-max", maxi);
    if (maxi) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    return () => document.body.classList.remove("boj-max");
  }, [maxi]);
  // app sidebar: sbalit na stránce boje, při odchodu vrátit
  const setSidebar = useApp((s) => s.setSidebar);
  useEffect(() => {
    const was = useApp.getState().sidebarOpen;
    setSidebar(false);
    return () => setSidebar(was);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const S = useMemo(() => b.S && (viewAsPlayer || !dm) ? fogPlayerState(b.S) : b.S, [b.S, viewAsPlayer, dm]);
  const hudDm = dm && !viewAsPlayer;
  const lightInit = useRef("");
  useEffect(() => {
    if (!dm || !S || !map || lightInit.current === `${bid}:${map.id}`) return;
    lightInit.current = `${bid}:${map.id}`;
    b.dispatch(s => updateLightState(s, map));
  }, [dm, !!S, map, bid]);
  const selTok = sel ? byId(S!, sel) : undefined;
  const curTok = S ? cur(S) : undefined;
  const shownTok = selTok || curTok;
  const diff = S ? difficulty(S.tok) : null;

  /* ---- klávesové zkratky ---- */
  useEffect(() => {
    if (!S || !map) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setTargeting(null); setResolve(null); setMoveAtk(null); setCtxMenu(null); setZonePlace(null); setTool("select"); setDropReq(null); setOv(null); setDmgCfm(null); setLoh(null); setSetOpen(false); return; }
      if (isInteractiveTarget(e.target)) return;
      if (e.key === "?") { setHelp((v) => !v); return; }
      if (!hudDm) return;
      if ((e.key === " " || e.key.toLowerCase() === "n") && !e.ctrlKey) { e.preventDefault(); b.dispatch((s) => C.nextTurn(s)); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? b.redo() : b.undo(); return; }
      if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); b.redo(); return; }
      if (e.key.toLowerCase() === "m") { setTool("measure"); return; }
      if (e.key.toLowerCase() === "f") {
        if (e.shiftKey && dm) { setMaxi((v) => !v); return; }
        window.dispatchEvent(new Event("boj-fit")); return;
      }
      if (e.key === "+") { window.dispatchEvent(new CustomEvent("boj-zoom", { detail: "in" })); return; }
      if (e.key === "-") { window.dispatchEvent(new CustomEvent("boj-zoom", { detail: "out" })); return; }
      if (e.key === "0") { window.dispatchEvent(new CustomEvent("boj-zoom", { detail: "reset" })); return; }
      if (e.key.toLowerCase() === "t" && shownTok?.atk[0]) { setTargeting({ atk: shownTok.atk[0], srcId: shownTok.id }); return; }
      if (/^[1-9]$/.test(e.key) && shownTok) {
        const a = shownTok.atk[Number(e.key) - 1];
        if (a) onAttack(a);
        return;
      }
      if (e.key === "Delete" && selTok) {
        void confirmDialog({ title: "Odebrat z boje", text: selTok.nazev, okLabel: "Odebrat", danger: true })
          .then((ok) => { if (ok) b.dispatch((s) => C.removeToken(s, selTok.id)); });
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selTok?.x != null) {
        e.preventDefault();
        const d: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
        const [dx, dy] = d[e.key];
        const nx = selTok.x + dx, ny = selTok.y! + dy;
        const set = settingsOf(S);
        if (e.altKey) { // Alt+šipka = teleport o krok
          cmd((s) => C.moveToken(s, selTok.id, nx, ny, { mode: "teleport" }));
          return;
        }
        const pl = planMovement(S, map, selTok, [], [nx, ny], "pravidla", set);
        if (!pl.blocked && pl.overFt <= 0 && !pl.oas.length)
          cmd((s) => C.moveToken(s, selTok.id, nx, ny, { ft: pl.ft, oas: pl.oas, mode: "pravidla" }));
        else setDropReq({ t: selTok, plan: pl, waypoints: [], pt: { x: window.innerWidth / 2, y: window.innerHeight / 2 }, kind: pl.blocked ? "blocked" : pl.oas.length && pl.overFt <= 0 ? "oa" : "over" });
        return;
      }
      if (e.key.toLowerCase() === "h" || e.key.toLowerCase() === "d") {
        if (selTok) { setPanel("inspektor"); setSideMini(false); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (b.err) return <div className="boj-err">⚠ {b.err} <button className="boj-btn2" onClick={b.load}>Znovu</button></div>;
  if (!S || !map) return <div className="boj-loading">Načítám bojiště…</div>;

  const onDoor = (w: MapWall) => {
    const open = S.dvere?.[w.id] ?? w.open;
    const toggle = () => cmd((s) => {
      s.dvere = { ...(s.dvere || {}), [w.id]: !open };
      log(s, "system", `${!open ? "Otevřeny" : "Zavřeny"} dveře`, "PJ");
    });
    if (w.locked && !open) {
      confirmDialog({ title: "Zamčené dveře", text: "Dveře jsou zamčené. Odemknout a otevřít?", okLabel: "Odemknout" })
        .then((ok) => { if (ok) { cmd((s) => { s.dvere = { ...(s.dvere || {}), [w.id]: true }; log(s, "system", "Dveře odemčeny a otevřeny", "PJ"); }); } });
    } else toggle();
  };
  const cmdBase = b.dispatch;
  const cmd = (fn: (s: any) => void) => { if (hudDm) cmdBase((s: any) => { fn(s); updateLightState(s, map); updateFog(s, map); }); };
  const ctx = { map };

  /* ---- handlery ---- */
  const onAttack = (atk: AttackDef, opts?: { slot?: number; pact?: boolean; meta?: string[] }) => {
    const src = shownTok;
    if (!src) { toast("Nejdřív vyber útočníka", "err"); return; }
    if (atk.utility) { // utility kouzlo — rovnou seslat na sebe/log (bez targetingu)
      cmd((s) => { const res = C.cmdAttack(s, { atkId: src.id, tgtId: src.id, atk, slot: opts?.slot, pact: opts?.pact }, ctx); if (!res.ok) toast(res.reason || "Kouzlo nešlo", "err"); });
      return;
    }
    if (atk.area) setTargeting({ atk, srcId: src.id, area: true, slot: opts?.slot, pact: opts?.pact, meta: opts?.meta });
    else setTargeting({ atk, srcId: src.id, slot: opts?.slot, pact: opts?.pact, meta: opts?.meta });
    setPanel("akce");
  };
  const onTarget = (tgtId: string) => {
    if (!targeting) return;
    const src = byId(S, targeting.srcId), tgt = byId(S, tgtId);
    if (!src || !tgt) return;
    const ev = C.evalUi(S, map, src, tgt, targeting.atk);
    const reason = ev.beyondRange ? "mimo dostřel" : ev.cover === 9 ? "plný kryt" : "nelze zacílit";
    if (!ev.canTarget) {
      // nabídni přesun+útok pro melee
      const plan = C.planMoveAttack(S, map, src, tgt, targeting.atk);
      if (plan) { setMoveAtk({ plan, tgtId, atk: targeting.atk, srcId: targeting.srcId }); setTargeting(null); return; }
      const st = settingsOf(S).automatizace.dosah;
      if (st === "hlidat") {
        setOv({
          title: `${src.nazev} → ${tgt.nazev}`,
          reason: `${reason} (${ev.dist} ft) — pravidla to neumožňují`,
          options: [
            { label: "Zaútočit i tak (DM)", dm: true, onPick: () => { setOv(null); setResolve({ kind: "attack", atk: targeting.atk, srcId: targeting.srcId, tgtId, force: true, meta: targeting.meta }); setTargeting(null); } },
          ],
        });
      } else if (st === "varovat") {
        setResolve({ kind: "attack", atk: targeting.atk, srcId: targeting.srcId, tgtId, force: true, meta: targeting.meta });
      } else { toast(`${tgt.nazev}: ${reason} (${ev.dist} ft)`, "err"); return; }
      setTargeting(null);
      return;
    }
    // Twinned: první klik = cíl 1, druhý klik = cíl 2 → resolve oba útoky
    if ((targeting.meta || []).includes("twinned") && !twin1) {
      setTwin1(tgtId); toast("Twinned: vyber druhý cíl", "info"); return;
    }
    const fire = (dis: boolean) => {
      if (twin1) {
        const t1 = twin1; setTwin1(null); setTargeting(null);
        cmd((s2) => {
          C.cmdAttack(s2, { atkId: src.id, tgtId: t1, atk: targeting.atk, slot: targeting.slot, pact: targeting.pact, meta: targeting.meta }, ctx);
          C.cmdAttack(s2, { atkId: src.id, tgtId, atk: targeting.atk, override: true }, ctx);
        });
        return;
      }
      setResolve({ kind: "attack", atk: targeting.atk, srcId: targeting.srcId, tgtId, meta: targeting.meta, preDis: dis } as any);
      setTargeting(null);
    };
    // Protection: spojenec cíle do 5 ft může před hodem dát Dis
    const prot = reactionOptions(S, { kind: "hit", attacker: src, target: tgt, atk: targeting.atk }).filter((oo) => oo.id.startsWith("protect"));
    if (prot.length) {
      setRx({ opts: prot, run: (oo) => { setRx(null); if (oo) cmd((s2) => { const rr = applyReaction(s2, oo, { kind: "hit", attacker: src, target: tgt, atk: targeting.atk }, Math.random); if (rr.msg) log(s2, "system", rr.msg, "PJ"); }); fire(!!oo); } });
      return;
    }
    fire(false);
  };
  const doMoveAttack = () => {
    if (!moveAtk) return;
    const { plan, tgtId, atk, srcId } = moveAtk;
    cmd((s) => C.moveToken(s, srcId, plan.cell[0], plan.cell[1], { ft: plan.ft, oas: plan.oas }));
    setMoveAtk(null);
    setResolve({ kind: "attack", atk, srcId, tgtId });
  };
  const onArea = (anchor: [number, number]) => {
    if (!targeting?.area) return;
    const a = targeting.atk;
    const src = byId(S, targeting.srcId);
    const shape = a.area!.shape;
    let spec: any = { shape, size: a.area!.size, anchor };
    if ((shape === "cone" || shape === "line") && src?.x != null) {
      spec = { ...spec, anchor: [src.x, src.y!], dir: Math.atan2(anchor[1] - (src.y ?? 0), anchor[0] - (src.x ?? 0)) * 180 / Math.PI };
    }
    const tgtIds = tokensInArea(spec, S.tok, src).map((t) => t.id);
    setResolve({ kind: "area", atk: a, srcId: targeting.srcId, spec, tgtIds, slot: targeting.slot });
    setTargeting(null);
  };
  const onZone = (x: number, y: number, dir?: number) => {
    if (!zonePlace?.preset.zone) return;
    if (!zonePlace.anchor) { setZonePlace({ ...zonePlace, anchor: [x, y] }); return; }
    cmd((s) => C.cmdPresetZone(s, zonePlace.preset.id, [x, y], dir ?? 0, curTok?.id || sel || undefined));
    setZonePlace(null); setTool("select");
  };
  /* ---- drag&drop rozhodovací strom: příprava → volno, mimo tah → podle nastavení,
     limit/OA → popover, jinak rovnou pohyb. Alt = teleport, Shift = nucený. ---- */
  const execMove = (t: Token, plan: MovementPlan, wps: [number, number][], mode: MoveMode, to: [number, number], zones?: boolean) => {
    const target = plan.blocked && plan.farthest ? plan.farthest : to;
    const mid = [...wps, target].slice(0, -1); // pro segmentové trigger zóny stačí finální pozice
    void mid;
    cmd((s) => C.moveToken(s, t.id, target[0], target[1], {
      ft: mode === "pravidla" || mode === "prekrocit" || mode === "dash" ? plan.ft : 0,
      oas: mode === "nuceny" || mode === "teleport" ? [] : plan.oas,
      mode, override: true, zones,
    }));
  };
  const onDrop = (t: Token, to: [number, number], plan: MovementPlan, wps: [number, number][],
                 pt: { x: number; y: number }, mods: { alt: boolean; shift: boolean }, group?: Set<string>) => {
    if (!hudDm) return;
    const set = settingsOf(S);
    // Volný režim: přímé přemístění bez plánování/OA/popoverů
    if (isFree(S)) {
      cmd((s) => {
        if (group && group.size > 1) {
          const dx = to[0] - (t.x ?? 0), dy = to[1] - (t.y ?? 0);
          for (const id of group) {
            const g = byId(s, id); if (!g || g.x == null) continue;
            C.moveToken(s, id, g.x + dx, (g.y ?? 0) + dy, {});
          }
        } else C.moveToken(s, t.id, to[0], to[1], {});
      });
      return;
    }
    // modifikátory mají přednost
    if (mods.alt) { execMove(t, plan, wps, "teleport", to); return; }
    if (mods.shift) { execMove(t, plan, wps, "nuceny", to); return; }
    // skupinový drag: příprava = volné posunutí zachovající offsety; boj = nucený přesun
    if (group && group.size > 1) {
      const dx = to[0] - (t.x ?? 0), dy = to[1] - (t.y ?? 0);
      cmd((s) => {
        for (const id of group) {
          const g = byId(s, id); if (!g || g.x == null) continue;
          C.moveToken(s, id, g.x + dx, (g.y ?? 0) + dy, { mode: "nuceny", zones: set.pohyb.zonyPriPresunuDM && S.round > 0 });
        }
      });
      return;
    }
    // příprava: vždy volné rozmístění, bez nákladů/OA/zón
    if (S.round === 0) { execMove(t, plan, wps, "nuceny", to, false); return; }
    // žeton mimo tah
    if (cur(S)?.id !== t.id) {
      if (set.pohyb.mimoTah === "zeptat") setDropReq({ t, plan, waypoints: wps, pt, kind: "mimoTah" });
      else execMove(t, plan, wps, "nuceny", to);
      return;
    }
    // blokovaná cesta → teleport/nucený popover
    if (plan.blocked) { setDropReq({ t, plan, waypoints: wps, pt, kind: "blocked" }); return; }
    // přes limit
    if (plan.overFt > 0) {
      if (set.pohyb.limit === "volne") { execMove(t, plan, wps, set.pohyb.vychoziPrekroceni || "prekrocit", to); return; }
      setDropReq({ t, plan, waypoints: wps, pt, kind: "over" });
      return;
    }
    // OA podle nastavení
    if (plan.oas.length) {
      if (set.pohyb.oa === "zeptat") { setDropReq({ t, plan, waypoints: wps, pt, kind: "oa" }); return; }
      execMove(t, plan, wps, "pravidla", to);
      if (set.pohyb.oa === "jenZaznam") cmd((s) => log(s, "system", `${t.nazev}: OA připomenutí — ${plan.oas.join(", ")}`, "PJ"));
      return;
    }
    execMove(t, plan, wps, "pravidla", to);
  };
  // Reakce: nabídne prompt; proceed zavolá pokračování
  const askRx = (trig: ReactionTrigger, proceed: (pre?: { miss?: boolean; dmgMul?: number; dmgFlat?: number; countered?: boolean }) => void) => {
    const opts = reactionOptions(S, trig);
    if (!opts.length) { proceed(); return; }
    setRx({ opts, run: (o) => {
      setRx(null);
      if (!o) { proceed(); return; }
      const res = applyReaction(S, o, trig, Math.random);
      cmd((s) => { const r = applyReaction(s, o, trig, Math.random); if (r.msg) log(s, "system", r.msg, "PJ"); });
      proceed(res);
    } });
  };
  const applyResolve = (o: { overrideAdv?: number | null; manualD20?: number; manualDmg?: number; slot?: number; pact?: boolean; override?: boolean; lucky?: "adv" | "dis"; inspire?: boolean }) => {
    if (!resolve) return;
    const r = resolve;
    if ((r as any).preDis && o.overrideAdv == null) o.overrideAdv = -1;
    if (o.lucky || o.inspire) cmd((s2) => {
      const A0r = byId(s2, r.srcId);
      if (o.lucky && A0r) {
        const z = (A0r.zdroje || []).find((zz: any) => /lucky|luck/i.test(zz.nazev) && zz.max - zz.used > 0);
        if (z) { z.used++; log(s2, "system", `${A0r.nazev}: Lucky (−1 Luck Point)`, A0r.nazev); }
      }
      if (o.inspire && A0r) { A0r.heroicInspiration = false; log(s2, "system", `${A0r.nazev}: Heroic Inspiration — přehozeno`, A0r.nazev); }
    });
    // potvrzení zranění: nejdřív náhled (stejný d20), DM může upravit a pak teprve aplikovat
    if (r.kind === "attack" && o.manualDmg == null && (settingsOf(S).automatizace.zraneni === "potvrdit" || isFree(S))) {
      const A = byId(S, r.srcId), B = byId(S, r.tgtId);
      if (A && B) {
        const res = resolveAttack({ attacker: A, target: B, atk: r.atk, map, tokens: S.tok, overrideAdv: o.overrideAdv, state: S, teren: S.teren, ax: undefined, ay: undefined }, { manualD20: o.manualD20, force: r.force });
        if (res && res.hit && res.dmgByType.length) {
          const n = r.atk.n || 1;
          const parts = res.dmgByType.map((p) => ({ amount: p.amount * n, type: p.type }));
          const prev = previewDamage(B, parts);
          setResolve(null);
          setDmgCfm({ r, o, rolled: res.used, base: parts.reduce((a, p) => a + p.amount, 0), applied: prev.applied, mods: prev.mods, tgt: B.nazev, tgtId: B.id, hit: true });
          return;
        }
      }
    }
    const A0 = byId(S, r.srcId);
    if (r.atk.kind === "spell" && (r.atk.lvl || 0) > 0 && A0 && !(r.meta || []).includes("subtle")) {
      const opts = reactionOptions(S, { kind: "enemyCasts", attacker: A0, target: undefined, distFt: undefined });
      if (opts.length) {
        setRx({ opts, run: (ro) => {
          setRx(null);
          cmd((s) => {
            if (ro) {
              const res = applyReaction(s, ro, { kind: "enemyCasts", attacker: A0 }, Math.random);
              if (res.msg) log(s, "system", res.msg, "PJ");
              if (res.countered) { log(s, "system", `${r.atk.nazev} zrušen Counterspellem — slot se nespotřebuje`, "PJ"); return; }
            }
            if (r.kind === "attack") { const res = C.cmdAttack(s, { atkId: r.srcId, tgtId: r.tgtId, atk: r.atk, ...o, override: o.override || r.force, meta: r.meta }, ctx); if (!res.ok) toast(res.reason || "Útok nešel", "err"); }
          });
        } });
        setResolve(null);
        return;
      }
    }
    cmd((s) => {
      if (r.kind === "attack") {
        const res = C.cmdAttack(s, { atkId: r.srcId, tgtId: r.tgtId, atk: r.atk, ...o, override: o.override || r.force, meta: r.meta }, ctx);
        if (!res.ok) toast(res.reason || "Útok nešel", "err");
      } else {
        const res = C.cmdArea(s, { srcId: r.srcId, spec: r.spec, atk: r.atk, manualDmg: o.manualDmg, slot: o.slot ?? r.slot, pact: o.pact, override: o.override || r.force }, ctx);
        if (!res.ok) toast(res.reason || "Nešlo", "err");
      }
    });
    setResolve(null);
  };
  const onPickPreset = (p: EffectPreset) => {
    const ids = selSet.size ? [...selSet] : sel ? [sel] : [];
    if (!ids.length) { toast("Vyber žeton(y) pro efekt", "err"); return; }
    cmd((s) => ids.forEach((id) => C.addEffect(s, id, p.id, curTok?.id || sel || undefined)));
    if (p.zone) { setZonePlace({ preset: p }); setTool("zone"); }
    toast(`${p.nazev} → ${ids.length} žeton${ids.length > 1 ? "ů" : ""}`, "ok");
  };
  const onZonePreset = (p: EffectPreset) => { setZonePlace({ preset: p }); setTool("zone"); setPanel("prostredi"); };
  const onCtxAction = (a: string) => {
    const t = ctxMenu?.t; if (!t) return;
    switch (a) {
      case "attack": {
        const atk = t.atk?.[0];
        if (atk) setTargeting({ atk, srcId: t.id });
        break;
      }
      case "dmg": case "heal": case "cond": setSel(t.id); setPanel("inspektor"); setSideMini(false); break;
      default:
        if (a.startsWith("hp:")) { const d = Number(a.slice(3)); cmd((s2) => { const tt = byId(s2, t.id); if (tt) { tt.hp = Math.max(0, Math.min(tt.max, tt.hp + d)); log(s2, "system", `${tt.nazev}: HP ${d > 0 ? "+" : ""}${d} → ${tt.hp}`, "PJ"); } }); }
        if (a.startsWith("tmp:")) { const d = Number(a.slice(4)); cmd((s2) => { const tt = byId(s2, t.id); if (tt) { tt.tmp = Math.max(0, (tt.tmp || 0) + d); log(s2, "system", `${tt.nazev}: temp HP ${tt.tmp}`, "PJ"); } }); }
        break;
      case "effect": setSel(t.id); setPanel("efekty"); break;
      case "hide": cmd((s) => C.patchToken(s, t.id, { skryty: !t.skryty })); break;
      case "remove": void confirmDialog({ title: "Odebrat z boje", text: t.nazev, okLabel: "Odebrat", danger: true })
        .then((ok) => { if (ok) cmd((s) => C.removeToken(s, t.id)); }); break;
    }
  };
  const onResource = (idx: number) => {
    const t = shownTok; if (!t) return;
    const z = t.zdroje?.[idx]; if (!z) return;
    const act = resourceAction(z.nazev, t);
    if (act.kind === "area") {
      const atk: AttackDef = {
        nazev: z.nazev, kind: "feature", save: "DEX", dc: t.dc || 8 + (t.pb || 2) + (t.mods.CON || 0),
        area: { shape: "cone", size: 30 }, dmg: "4d6", typ: "Fire", half: true,
      };
      setTargeting({ atk, srcId: t.id, area: true });
      cmd((s) => { const x = byId(s, t.id); if (x) x.zdroje[idx].used += 1; });
      return;
    }
    if (act.needsAmount) { setLoh({ idx, max: z.max - z.used, nazev: z.nazev, amt: Math.min(10, z.max - z.used) }); return; }
    cmd((s) => {
      const r = C.cmdUseResource(s, t.id, idx);
      if (!r.ok) setOv({ title: z.nazev, reason: r.msg, options: [{ label: "Použít i tak", dm: true, onPick: () => { setOv(null); cmd((s2) => void C.cmdUseResource(s2, t.id, idx, undefined, true)); } }] });
    });
  };

  const panels: { id: Panel; n: string; ico: React.ReactNode }[] = [
    { id: "akce", n: "Akce", ico: <ShieldQuestion size={13} /> },
    { id: "efekty", n: "Efekty", ico: <Sparkles size={13} /> },
    { id: "prostredi", n: "Prostředí", ico: <Globe2 size={13} /> },
    { id: "inspektor", n: "Inspektor", ico: <MousePointer2 size={13} /> },
    { id: "log", n: "Log", ico: <ScrollText size={13} /> },
  ];

  /* ---- bottom-sheet drag (mobile) ---- */
  const sheetDrag = (e: React.PointerEvent) => {
    sheetStart.current = e.clientY;
    const el = sheetRef.current!;
    el.setPointerCapture(e.pointerId);
  };
  const sheetMove = (e: React.PointerEvent) => {
    if (!sheetStart.current) return;
    const d = e.clientY - sheetStart.current;
    if (Math.abs(d) < 40) return;
    const order: ("peek" | "half" | "full")[] = ["peek", "half", "full"];
    const i = order.indexOf(sheet) + (d < 0 ? 1 : -1);
    setSheet(order[Math.max(0, Math.min(2, i))]);
    sheetStart.current = 0;
  };
  const sheetEnd = () => { sheetStart.current = 0; };

  /* resizable pravý panel (300–520 px, remembered) */
  const sideDrag = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).classList.add("on");
  };
  const sideMove = (e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).classList.contains("on")) return;
    const w = Math.min(520, Math.max(300, window.innerWidth - e.clientX));
    setSideW(w);
  };
  const sideEnd = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).classList.remove("on");
    try { localStorage.setItem("boj-sidew", String(sideW)); } catch { /* */ }
  };
  const cancelMode = () => { setTargeting(null); setZonePlace(null); setMoveAtk(null); if (["measure", "paint", "fog", "light"].includes(tool)) setTool("select"); };

  const empty = !S.tok.length;

  return (
    <div className="boj-page">
      <InitiativeBar
        S={S} sel={sel} dm={hudDm}
        onSelect={(id) => { setSel(id); setActionGroup("all"); setPanel("akce"); }}
        onNext={() => cmd((s) => C.nextTurn(s))}
        onRoll={() => cmd((s) => C.cmdRollInit(s))}
        onUndo={b.undo} onRedo={b.redo}
        canUndo canRedo saving={b.saving}
        onRound={(d) => cmd((s) => { s.round = Math.max(0, s.round + d); log(s, "system", `Kolo → ${s.round}`, "PJ"); })}
      />
      <div className="boj-body">
        <div className={`boj-mapwrap ${isFree(S) ? "free-map" : ""}`}>
          {isFree(S) && <div className="boj-freechip">Volný režim — bez pravidel</div>}
          <TurnBanner S={S} />
          <div className="boj-toolbar">
            <button className={`boj-tbtn ${tool === "select" ? "on" : ""}`} title="Vybrat / táhnout žetony" onClick={() => { setTool("select"); setZonePlace(null); }}><MousePointer2 size={14} /></button>
            <button className={`boj-tbtn ${tool === "measure" ? "on" : ""}`} title="Metr (M)" onClick={() => setTool("measure")}><Ruler size={14} /></button>
            {dm && <button className={`boj-tbtn ${tool === "zone" ? "on" : ""}`} title="Umístit zónu z knihovny" onClick={() => { setPanel("efekty"); }}><MapPin size={14} /></button>}
            {dm && <button className={`boj-tbtn ${tool === "kresba" ? "on" : ""}`} title="Kresba na mapu" onClick={() => setTool("kresba")}><PenLine size={14} /></button>}
            {dm && tool === "kresba" && <input type="color" className="boj-tcolor" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} title="Barva kresby" />}
            {dm && tool === "kresba" && <button className="boj-tbtn" title="Smazat všechny kresby" onClick={() => cmd((s) => { s.kresby = []; log(s, "system", "Kresby smazány", "PJ"); })}><Eraser size={14} /></button>}
            <span className="boj-mapname">{map.nazev}{map.osvetleni ? ` · ${map.osvetleni}` : ""}</span>
            {diff && <span className={`boj-diff ${diff.cls}`}>{diff.label}</span>}
            {dm && <button className="boj-btn2 pri" onClick={() => setAddOpen(true)}><Users size={14} /> Přidat</button>}
            {moveAtk && (
              <button className="boj-btn2 warn" onClick={doMoveAttack} title="Přesunout a zaútočit">
                ➤ {moveAtk.plan.ft} ft {moveAtk.plan.oas.length ? `⚠${moveAtk.plan.oas.length}` : ""}
              </button>
            )}
            {(targeting || zonePlace || moveAtk) && (
              <button className="boj-btn2 err" onClick={() => { setTargeting(null); setZonePlace(null); setMoveAtk(null); }}>
                <X size={13} /> {targeting?.area ? "klikni = střed oblasti" : targeting ? "klikni na cíl" : zonePlace ? "umísti zónu" : "zrušit"}
              </button>
            )}
            <div className={`boj-more ${moreOpen ? "open" : ""}`}>
              <button className="boj-tbtn boj-more-btn" title="Další nástroje" onClick={() => setMoreOpen(!moreOpen)}><MoreHorizontal size={14} /></button>
              <div className="boj-more-items">
                <button className={`boj-tbtn ${names === "always" ? "on" : ""}`} title={`Jména na mapě: ${names === "always" ? "vždy" : "při najetí"} (klik = přepnout)`}
                        onClick={() => { const v = names === "always" ? "hover" : "always"; setNames(v); localStorage.setItem("boj-names", v); }}><Type size={14} /><span className="boj-more-lab">Jména</span></button>
                {dm && <button className="boj-tbtn" title="Nastavení boje" onClick={() => { setSetOpen(true); setMoreOpen(false); }}><Settings size={14} /><span className="boj-more-lab">Nastavení</span></button>}
                <button className="boj-tbtn" title="Nápověda (?)" onClick={() => { setHelp(true); setMoreOpen(false); }}><HelpCircle size={14} /><span className="boj-more-lab">Nápověda</span></button>
                {dm && <button className="boj-tbtn" title="Maximalizovat (Shift+F)" onClick={() => { setMaxi(!maxi); setMoreOpen(false); }}><Maximize size={14} /><span className="boj-more-lab">Maximalizovat</span></button>}
                {dm && map?.id && <button className="boj-tbtn" title="Otevřít tuto mapu v editoru" onClick={() => { nav(`/boj/mapa/${map.id}`); setMoreOpen(false); }}><PenLine size={14} /><span className="boj-more-lab">Upravit mapu</span></button>}
                {dm && <button className={`boj-tbtn ${viewAsPlayer ? "on" : ""}`} aria-pressed={viewAsPlayer} title="Zobrazit jako hráč" onClick={() => { setViewAsPlayer(!viewAsPlayer); setMoreOpen(false); }}><Eye size={14} /><span className="boj-more-lab">Zobrazit jako hráč</span></button>}
                {dm && <div className="boj-seg" role="group" aria-label="Režim boje">
                  <button className={`boj-seg-b ${!isFree(S) ? "on" : ""}`} onClick={() => cmd((s) => { if (isFree(s)) { s.nastaveni = { ...(s.nastaveni || {}), rezim: "pravidla" } as any; log(s, "system", "Režim: Pravidla", "PJ"); } })}>Pravidla</button>
                  <button className={`boj-seg-b free ${isFree(S) ? "on" : ""}`} onClick={() => cmd((s) => { if (!isFree(s)) { s.nastaveni = { ...(s.nastaveni || {}), rezim: "volny" } as any; log(s, "system", "Režim: Volný — bez pravidel", "PJ"); } })}>Volný</button>
                </div>}
              </div>
            </div>
          </div>
          <BattleMap
            bid={bid} S={S} map={map} sel={sel} selSet={selSet} dm={dm && !viewAsPlayer} tool={viewAsPlayer ? "select" : tool}
            fogOverlay={fogOverlay} fogRoom={fogRoom} onFogRoom={(x,y) => { const room = [...((map as MapV2).interiery || [])].reverse().find(r => pointInPolygon([x,y],r.poly)); setFogRoom(room?.id || null); }}
            paintTile={paintTile} fogMode={fogMode}
            targeting={targeting} zonePlace={zonePlace} moveAtk={moveAtk?.plan}
            hoverAtk={hoverAtk} names={names} followTurn={settingsOf(S).pohyb.sledujTah !== false}
            onCancelMode={cancelMode}
            fx={b.newFx} onFxDone={b.markFx}
            onHoverToken={setHoverToken}
            onSelect={(id, add) => { if (add && id) { const n = new Set(selSet); n.has(id) ? n.delete(id) : n.add(id); setSelSet(n); } else { setSel(id); setActionGroup("all"); if (!add) setSelSet(new Set()); } }}
            onSelSet={setSelSet}
            onInspect={(id) => { setSel(id); setPanel("inspektor"); setSideMini(false); }}
            onDrop={onDrop}
            onPresetDrop={(tokId, pid) => { const pr = presetById(pid); if (!pr) return;
              cmd((s2) => C.addEffect(s2, tokId, pr.id, curTok?.id || undefined));
              toast(`${pr.nazev} → ${byId(S, tokId)?.nazev}`, "ok"); }}
            zoneEdit={isFree(S) || dm}
            onZoneEdit={(id, p) => cmd((s2) => { const z = s2.zones.find((zz: any) => zz.id === id); if (!z) return;
              if (p.anchor) z.anchor = p.anchor;
              if (p.size) z.shape.size = p.size;
              log(s2, "system", `Zóna ${z.nazev}: úprava`, "PJ"); })}
            onTarget={onTarget}
            onArea={onArea}
            onZone={onZone}
            onPaint={(cells) => cmd((s) => C.cmdPaint(s, cells, paintTile))}
            onFogPaint={(cells, reveal) => cmd((s) => C.cmdFogCells(s, cells.filter(([x,y]) => x >= 0 && y >= 0 && y < map.mrizka.length && x < map.mrizka[y].length), reveal))}
            onLightPlace={(x, y) => { if (pendingLight) { cmd((s) => C.cmdAddLight(s, { ...pendingLight, anchor: [x, y] })); setPendingLight(null); setTool("select"); } }}
            onCtxMenu={(t, pt) => setCtxMenu({ t, x: pt.x, y: pt.y })}
            onDoor={onDoor} onSource={id=>{if(dm)cmd(s=>toggleSource(s,map,id,dm));}}
            onWeather={weather => cmd(s => { s.pocasi = weather; })}
            drawColor={drawColor}
            onDraw={(pts, stroke) => cmd((s) => { s.kresby = [...(s.kresby || []), { id: uid(), kind: "free", pts, stroke, width: 3, dmOnly: true } as any]; })}
          >
            <TargetHud S={S} t={byId(S, hoverToken || sel)} map={map} dm={hudDm} />
            <TurnHud S={S} dm={hudDm} onEnd={() => cmd(s => C.nextTurn(s))} onGroup={group => { setSel(curTok?.id || null); setActionGroup(group); setPanel("akce"); setSideMini(false); setSheet("half"); }} />
          </BattleMap>
        </div>
        <aside ref={sheetRef} className={`boj-side sheet-${sheet} ${sideMini ? "mini" : ""}`} style={sideMini ? undefined : { width: sideW }}>
          <div className="boj-sheet-handle" onPointerDown={sheetDrag} onPointerMove={sheetMove} onPointerUp={sheetEnd} onPointerCancel={sheetEnd} />
          <div className="boj-side-resizer" onPointerDown={sideDrag} onPointerMove={sideMove} onPointerUp={sideEnd} onPointerCancel={sideEnd} />
          <div className={`boj-side-tabs ${sideW < 450 ? "icons" : ""}`}>
            {panels.map((p) => (
              <button key={p.id} className={panel === p.id && !sideMini ? "on" : ""} title={p.n}
                      onClick={() => { setPanel(p.id); setSideMini(false); }}>{p.ico} <span>{p.n}</span></button>
            ))}
            <button className="boj-side-collapse" title={sideMini ? "Rozbalit panel" : "Sbalit panel"} onClick={() => setSideMini(!sideMini)}>
              {sideMini ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
            </button>
          </div>
          <div className="boj-side-body">
            {panel === "akce" && (
              shownTok
                ? <ActorPanel S={S} t={shownTok} targeting={targeting} onAttack={onAttack} group={actionGroup} onGroup={setActionGroup}
                              onStdAction={(a) => cmd((s) => C.cmdStdAction(s, shownTok.id, a, selTok?.id))}
                              onCheck={(n, m, mode) => cmd((s) => C.cmdCheck(s, shownTok.id, n, m, mode))}
                              onUseItem={(i, ba) => cmd((s) => C.cmdUseItem(s, shownTok.id, i, undefined, ba))}
                              onFeature={(key) => cmd((s) => { const res = C.cmdFeature(s, shownTok.id, key, selTok?.id !== shownTok.id ? selTok?.id : undefined); if (!res.ok) toast(res.reason || "Nejde", "err"); })}
                              onResource={onResource} onUndoMove={() => cmd((s) => C.undoTurnMovement(s, shownTok.id))} dm={hudDm}
                              onHoverAtk={setHoverAtk} />
                : <i className="boj-none">Vyber žeton na mapě</i>
            )}
            {panel === "efekty" && (
              <EffectsPanel S={S} sel={shownTok || null} selSet={selSet} dm={hudDm}
                onPickPreset={onPickPreset}
                onZonePreset={onZonePreset}
                onRemoveEffect={(tid, eid) => cmd((s) => C.removeEffect(s, tid, eid))}
                onRemoveZone={(zid) => cmd((s) => C.removeZone(s, zid))}
                onDropConc={(srcId) => cmd((s) => C.dropConc(s, srcId))} />
            )}
            {panel === "prostredi" && (
              <ToolsPanel S={S} map={map} sel={selTok || null} dm={dm}
                fogOverlay={fogOverlay} onFogOverlay={setFogOverlay} viewAsPlayer={viewAsPlayer} onViewAsPlayer={setViewAsPlayer}
                fogRoom={fogRoom} onFogRoom={(reveal) => { const room = (map as MapV2).interiery?.find(r => r.id === fogRoom); if (room) cmd(s => C.cmdFogCells(s, mapCells(map, room.poly), reveal)); }}
                onFogAll={() => cmd(s => C.cmdFogAll(s, map))} onFogReset={() => cmd(s => C.cmdFogReset(s, map))}
                tool={tool} paintTile={paintTile} fogMode={fogMode}
                onTool={setTool} onPaintTile={setPaintTile} onFogMode={setFogMode}
                onFogToggle={(on) => cmd((s) => C.cmdFogToggle(s, on))}
                onFogParty={() => cmd((s) => C.cmdFogParty(s, map))}
                onAddLight={(l) => { if (l.tokenId) cmd((s) => C.cmdAddLight(s, l)); else { setPendingLight(l); setTool("light"); toast("Klikni do mapy = umísti světlo", "ok"); } }}
                onRemoveLight={(id) => cmd((s) => C.cmdRemoveLight(s, id))}
                onLightLevel={(l) => cmd((s) => C.cmdLightLevel(s, l))}
                onRemoveZone={(zid) => cmd((s) => C.removeZone(s, zid))}
                onDice={(expr, adv) => cmd((s) => C.cmdDice(s, shownTok?.nazev || "PJ", expr, adv))}
                onRest={(kind) => cmd((s) => C.cmdRest(s, s.tok.filter((t: Token) => !t.dead).map((t: Token) => t.id), kind))} />
            )}
            {panel === "inspektor" && (
              shownTok
                ? <TokenInspector S={S} t={shownTok} cmd={cmd} dm={hudDm} onClose={() => setPanel("akce")} />
                : <i className="boj-none">Dvojklik na žeton otevře inspektor</i>
            )}
            {panel === "log" && <CombatLog log={S.log} pj={dm} />}
          </div>
        </aside>
      </div>

      {addOpen && dm && (
        <AddCombatants
          S={S} map={map}
          onAdd={(t) => { const xy = freeSpot(S, map, t.side, t.s); cmd((s) => C.addToken(s, t, xy)); }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {resolve && (
        <ResolveDialog S={S} map={map} r={resolve} onApply={applyResolve} onClose={() => setResolve(null)} />
      )}
      {ctxMenu && <CtxMenu t={ctxMenu.t} x={ctxMenu.x} y={ctxMenu.y} dm={dm} onClose={() => setCtxMenu(null)} onAction={onCtxAction} />}
      {help && <HelpOverlay onClose={() => setHelp(false)} />}
      {dropReq && dm && <MovePopover S={S} map={map} req={dropReq} cmd={cmd} onClose={() => setDropReq(null)} />}
      {setOpen && dm && <SettingsPanel S={S} cmd={cmd} onClose={() => setSetOpen(false)} />}
      {ov && <OverridePrompt title={ov.title} reason={ov.reason} options={ov.options} onClose={() => setOv(null)}>{ov.children}</OverridePrompt>}
      {loh && (
        <OverridePrompt title={loh.nazev} reason={`Kolik HP z poolu? (${loh.max} volných)`} onClose={() => setLoh(null)}
          options={[
            { label: `Použít ${loh.amt} HP`, onPick: () => { const amt = loh.amt, idx = loh.idx; const t = shownTok; setLoh(null); if (t) cmd((s) => { const r = C.cmdUseResource(s, t.id, idx, amt); if (!r.ok) toast(r.msg, "err"); }); } },
          ]}>
          <input type="number" min={1} max={loh.max} value={loh.amt} autoFocus
                 onChange={(e) => setLoh({ ...loh, amt: Math.max(1, Math.min(loh.max, Number(e.target.value) || 1)) })}
                 style={{ width: "100%", marginTop: 4 }} />
        </OverridePrompt>
      )}
      {rx && (
        <div className="boj-modal"><div className="boj-card boj-rx">
          <h3>Reakce</h3>
          {rx.opts.map((o) => (
            <button key={o.id} className="boj-rx-opt" onClick={() => rx.run(o)}>
              <b>{o.who}: {o.nazev}</b><span>{o.desc}</span>
            </button>
          ))}
          <button className="boj-btn2" onClick={() => rx.run(undefined)}>Přeskočit</button>
          <button className="boj-btn2" onClick={() => { setRx(null); cmd((s) => { s.nastaveni = { ...(s.nastaveni || {}), automatizace: { ...s.nastaveni!.automatizace, reakce: "vypnuto" } } as any; log(s, "system", "Reakce: prompty vypnuty pro tento boj", "PJ"); }); }}>Nezobrazovat v tomto boji</button>
        </div></div>
      )}
      {dmgCfm && (
        <OverridePrompt title={`Zranění: ${dmgCfm.tgt}`} reason={`Hod d20 ${dmgCfm.rolled} — výsledné damage po resistencích${dmgCfm.mods.length ? ` (${dmgCfm.mods.join(", ")})` : ""}`} onClose={() => setDmgCfm(null)}
          options={[
            { label: `Aplikovat ${dmgCfm.applied}`, onPick: () => { const d = dmgCfm; setDmgCfm(null); cmd((s) => { const rr = d.r; if (rr.kind === "attack") { const res = C.cmdAttack(s, { atkId: rr.srcId, tgtId: rr.tgtId, atk: rr.atk, ...d.o, manualD20: d.rolled, manualDmg: d.applied, override: d.o.override || rr.force, meta: rr.meta }, ctx); if (!res.ok) toast(res.reason || "Útok nešel", "err"); } }); } },
          ]}>
          <div className="boj-dmg-hero">
            <input type="number" min={0} value={dmgCfm.applied} aria-label="Výsledné zranění"
                   onChange={(e) => setDmgCfm({ ...dmgCfm, applied: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
          <div className="boj-seg boj-seg-full">
            {[["×½", Math.floor(dmgCfm.applied / 2)], ["×2", dmgCfm.applied * 2], ["0", 0]].map(([l, v]) => (
              <button key={l as string} onClick={() => setDmgCfm({ ...dmgCfm, applied: v as number })}>{l}</button>
            ))}
          </div>
          {(() => { const tt = byId(S, dmgCfm.tgtId); return tt ? (
            <div className="boj-dmg-tgt">
              <MiniCoin t={tt} size={26} />
              <b>{tt.nazev}</b>
              <span>finální zranění <b className="num">{dmgCfm.applied}</b></span>
            </div>
          ) : null; })()}
          <em className="boj-dmg-base">(hozeno {dmgCfm.base}{dmgCfm.mods.length ? ` · ${dmgCfm.mods.join(", ")}` : ""})</em>
          {(() => {
            if (dmgCfm.r.kind !== "attack") return null;
            const A = byId(S, dmgCfm.r.srcId), B = byId(S, dmgCfm.tgtId);
            if (!A || !B) return null;
            const opts = [
              ...reactionOptions(S, { kind: "hit", attacker: A, target: B, atk: dmgCfm.r.atk, hitTotal: dmgCfm.rolled + (dmgCfm.r.atk.bonus || 0) }),
              ...reactionOptions(S, { kind: "damaged", attacker: A, target: B, atk: dmgCfm.r.atk, distFt: Math.max(Math.abs((A.x ?? 0) - (B.x ?? 0)), Math.abs((A.y ?? 0) - (B.y ?? 0))) * 5 }),
            ];
            if (!opts.length) return null;
            return <div className="boj-rx">
              <b style={{ fontSize: 11 }}>Reakce:</b>
              {opts.map((o) => <button key={o.id} className="boj-rx-opt" title={o.desc} onClick={() => {
                const r = dmgCfm.r;
                cmd((s) => {
                  const res = applyReaction(s, o, { kind: o.id.startsWith("rebuke") || o.id.startsWith("uncanny") || o.id.startsWith("intercept") ? "damaged" : "hit", attacker: A, target: B, atk: r.atk, hitTotal: dmgCfm.rolled + (r.atk.bonus || 0) }, Math.random);
                  if (res.msg) log(s, "system", res.msg, "PJ");
                  if (res.miss) { setDmgCfm(null); return; }
                  if (res.dmgMul) setDmgCfm((d) => d ? { ...d, applied: Math.floor(d.applied * res.dmgMul!) } : d);
                  if (res.dmgFlat) setDmgCfm((d) => d ? { ...d, applied: Math.max(0, d.applied + res.dmgFlat!) } : d);
                });
              }}><b>{o.who}: {o.nazev}</b></button>)}
            </div>;
          })()}
        </OverridePrompt>
      )}
      {empty && !addOpen && !onboardHide && (
        <div className="boj-onboard">
          <div>
            <button className="boj-onboard-x" onClick={() => setOnboardHide(true)} title="Zavřít">✕</button>
            <h3>Příprava boje</h3>
            <ol>
              <li>Vyber mapu bojiště (v tomto boji: <b>{map.nazev}</b>)</li>
              <li>Přidej družinu — tlačítko <b>Přidat</b> vpravo nahoře</li>
              <li>Přidej střetnutí z mapy nebo netvory z bestiáře</li>
              <li>Zahoď <b>Iniciativu</b> a hraj</li>
            </ol>
            {dm && <button className="boj-btn2 pri" onClick={() => setAddOpen(true)}><Users size={14} /> Přidat účastníky</button>}
          </div>
        </div>
      )}
    </div>
  );
}

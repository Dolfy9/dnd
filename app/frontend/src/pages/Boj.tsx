import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { get, put, post } from "../api";
import { useApp, isEditor } from "../store";
import EntityPicker, { useEntityIndex } from "../components/EntityPicker";

const CONDITIONS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated",
  "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];
const SIDE_LABEL: Record<string, string> = { druzina: "Družina", nepratele: "Nepřátelé", neutral: "Neutrální" };
const SIDE_COLOR: Record<string, string> = { druzina: "#4a7ba6", nepratele: "#a33", neutral: "#8a6b3d" };

const d20 = () => 1 + Math.floor(Math.random() * 20);
const uid = () => Math.random().toString(36).slice(2, 9);
const cellName = (x: number, y: number) => String.fromCharCode(65 + (x % 26)) + (y + 1);
const hasC = (t: any, n: string) => (t.cond || []).some((c: any) => c.name === n);
const incap = (t: any) => ["Incapacitated", "Paralyzed", "Stunned", "Unconscious", "Petrified"].some((n) => hasC(t, n)) || t.dead;

function blankState(name: string, mapRef: string) {
  return { nazev: name, stav: "priprava", mapa: mapRef, stav_boje: { round: 0, turn: -1, ord: [], tok: [], eco: {}, log: [] } };
}

export default function Boj() {
  const [params] = useSearchParams();
  const bid = params.get("boj") || "";
  const { user } = useApp();
  const editor = isEditor(user);
  const [battle, setBattle] = useState<any>(null);
  const [state, setState] = useState<any>(null);
  const [version, setVersion] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [maps, setMaps] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);
  const verRef = useRef(0);
  verRef.current = version;

  const sb = state?.stav_boje || { round: 0, turn: -1, ord: [], tok: [], eco: {}, log: [] };
  const tok = useCallback((id: string | null) => sb.tok.find((t: any) => t.id === id), [sb]);
  const actor = sb.turn >= 0 ? tok(sb.ord[sb.turn]) : null;
  const selT = tok(sel);
  const battleMap = useMemo(() => maps.find((m: any) => m.id === (state?.mapa || battle?.map_ref)), [maps, state, battle]);

  const load = useCallback(async () => {
    const b = await get<any>(`/api/battles/${bid}`);
    setBattle(b);
    const st = b.state?.stav_boje ? b.state : { ...b.state, stav_boje: blankState(b.name, b.map_ref).stav_boje };
    setState(st); setVersion(b.version || 0);
  }, [bid]);

  useEffect(() => { load(); get<any>("/api/map/data").then((d) => setMaps(d.bojove_mapy || [])); }, [load]);

  // live sync
  useEffect(() => {
    if (!bid) return;
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`);
    ws.onopen = () => ws.send(JSON.stringify({ op: "sub", channel: `battle:${bid}` }));
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.channel === `battle:${bid}` && m.event === "state" && m.data.version !== verRef.current) {
          setState(m.data.state); setVersion(m.data.version);
        }
        if (m.channel === `battle:${bid}` && m.event === "shared") load();
      } catch { /* noop */ }
    };
    return () => ws.close();
  }, [bid, load]);

  // --- mutace: editor mění stav, PUT → server → WS broadcast ---
  const save = useCallback(async (st: any, ver: number) => {
    setDirty(true);
    try {
      const r = await put<any>(`/api/battles/${bid}/state`, { state: st, version: ver });
      setVersion(r.version); verRef.current = r.version;
    } catch (e: any) {
      if (String(e).includes("409")) await load();
      else alert("Uložení selhalo: " + e.message);
    } finally { setDirty(false); }
  }, [bid, load]);

  const mutate = useCallback((fn: (st: any) => void) => {
    if (!editor) return;
    setState((prev: any) => {
      const st = JSON.parse(JSON.stringify(prev));
      fn(st.stav_boje);
      st.upraveno = new Date().toISOString();
      save(st, verRef.current);
      return st;
    });
  }, [editor, save]);

  const log = (s: any, text: string, pj = false) => {
    s.log = s.log || [];
    const a = s.turn >= 0 ? s.tok.find((t: any) => t.id === s.ord[s.turn]) : null;
    s.log.unshift({ k: s.round, c: new Date().toTimeString().slice(0, 8), kdo: a?.nazev || "", t: text, pj });
    if (s.log.length > 500) s.log.length = 500;
  };

  // --- akce ---
  const rollInit = () => mutate((s) => {
    for (const t of s.tok) t.init = d20() + (Number(t.initB) || 0);
    s.ord = s.tok.filter((t: any) => !t.dead).map((t: any) => t.id).sort((a: any, b: any) => {
      const ta = s.tok.find((x: any) => x.id === a), tb = s.tok.find((x: any) => x.id === b);
      return tb.init - ta.init;
    });
    s.round = 1; s.turn = 0; s.eco = {};
    log(s, "⚔ Boj začíná – hozena iniciativa.", true);
  });

  const nextTurn = () => mutate((s) => {
    if (!s.ord.length) return;
    s.turn++;
    if (s.turn >= s.ord.length) { s.turn = 0; s.round++; log(s, `— Kolo ${s.round} —`, true); }
    s.eco = {};
    const a = s.tok.find((t: any) => t.id === s.ord[s.turn]);
    if (a?.conc) { /* Concentration reminder in UI */ }
  });

  const endBattle = () => mutate((s) => { s.round = 0; s.turn = -1; s.eco = {}; log(s, "Boj skončil.", true); });

  const dmg = (t: any, n: number) => mutate((s) => {
    const x = s.tok.find((q: any) => q.id === t.id); if (!x) return;
    let rest = n;
    if (rest > 0 && x.tmp > 0) { const a = Math.min(x.tmp, rest); x.tmp -= a; rest -= a; }
    x.hp = Math.max(0, Math.min(x.max, x.hp - rest));
    if (x.hp <= 0 && x.kind !== "pc") x.dead = true;
    log(s, `${x.nazev}: ${rest > 0 ? "−" + rest + " HP" : "+" + (-rest) + " HP"} (→ ${x.hp}/${x.max}${x.tmp ? " +" + x.tmp + " tmp" : ""})`);
  });

  const toggleCond = (t: any, name: string) => mutate((s) => {
    const x = s.tok.find((q: any) => q.id === t.id); if (!x) return;
    x.cond = x.cond || [];
    const i = x.cond.findIndex((c: any) => c.name === name);
    if (i >= 0) { x.cond.splice(i, 1); log(s, `${x.nazev}: stav ${name} zrušen.`); }
    else { x.cond.push({ name }); log(s, `${x.nazev}: stav ${name}.`); }
  });

  const ds = (t: any, ok: boolean) => mutate((s) => {
    const x = s.tok.find((q: any) => q.id === t.id); if (!x) return;
    x.ds = x.ds || { s: 0, f: 0 };
    if (ok) x.ds.s = Math.min(3, x.ds.s + 1); else x.ds.f = Math.min(3, x.ds.f + 1);
    if (x.ds.f >= 3) { x.dead = true; log(s, `☠ ${x.nazev} umírá (3× death save fail).`, true); }
    else if (x.ds.s >= 3) { x.hp = 1; x.ds = { s: 0, f: 0 }; log(s, `${x.nazev} se stabilizuje (1 HP).`); }
    else log(s, `${x.nazev}: death save ${ok ? "✓" : "✗"}`);
  });

  const removeTok = (t: any) => mutate((s) => {
    s.tok = s.tok.filter((x: any) => x.id !== t.id);
    s.ord = s.ord.filter((id: any) => id !== t.id);
    if (s.turn >= s.ord.length) s.turn = s.ord.length - 1;
    log(s, `${t.nazev} odebrán.`, true);
    setSel(null);
  });

  const moveTok = (t: any, x: number, y: number) => mutate((s) => {
    const q = s.tok.find((z: any) => z.id === t.id); if (!q) return;
    q.x = x; q.y = y;
    log(s, `${q.nazev} → ${cellName(x, y)}`);
  });

  const addPc = (entId: number | null, entName: string, sheet?: any) => mutate((s) => {
    const t = {
      id: uid(), nazev: entName, kind: "pc", side: "druzina", s: 1,
      hp: sheet?.hp || 10, max: sheet?.hp || 10, tmp: 0,
      ac: sheet?.ac || 10, initB: sheet?.init || 0, init: null,
      speed: 30, cond: [], dead: false, ds: { s: 0, f: 0 }, entId,
    };
    s.tok.push(t);
    log(s, `+ ${t.nazev} (HP ${t.max}, AC ${t.ac})`, true);
  });

  const addCustom = (f: any) => mutate((s) => {
    const t = { id: uid(), kind: "custom", s: Number(f.s) || 1, tmp: 0, cond: [], dead: false, ds: { s: 0, f: 0 }, ...f,
      hp: Number(f.hp) || 10, max: Number(f.hp) || 10, ac: Number(f.ac) || 10, initB: Number(f.initB) || 0, init: null };
    s.tok.push(t); log(s, `+ ${t.nazev}`, true);
  });

  const setShare = (shared: boolean) => post(`/api/battles/${bid}/share`, { shared }).then(load);

  const tile = (x: number, y: number) => {
    const m = battleMap?.data?.mrizka;
    return m && y >= 0 && y < m.length && x >= 0 && x < m[y].length ? m[y][x] : "#";
  };
  const walkable = (x: number, y: number) => tile(x, y) !== "#";

  if (!battle || !state) return <div className="p-8 text-[var(--ink-3)] font-ui">Načítám boj…</div>;
  const sides = ["druzina", "nepratele", "neutral"];

  return (
    <div className="h-full flex flex-col font-ui">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--line)] flex-wrap">
        <Link to="/boje" className="text-[var(--ink-3)] hover:text-[var(--ink)]">← Boje</Link>
        <b className="text-sm">{battle.name}</b>
        <span className={"chip text-[11px]" + (sb.round ? " chip-accent" : "")}>{sb.round ? `kolo ${sb.round}` : battle.status}</span>
        {dirty && <span className="text-[11px] text-[var(--ink-3)]">ukládám…</span>}
        {editor && (
          <div className="ml-auto flex gap-1.5">
            {!sb.round && sb.tok.length > 0 && <button className="btn sm chip-accent" onClick={rollInit}>⚔ Začít (hod iniciativy)</button>}
            {sb.round > 0 && <button className="btn sm chip-accent" onClick={nextTurn}>Další tah →</button>}
            {sb.round > 0 && <button className="btn sm" onClick={endBattle}>Konec boje</button>}
            <button className={"btn sm" + (battle.shared ? " chip-accent" : "")} onClick={() => setShare(!battle.shared)}>
              📡 {battle.shared ? "Sdíleno hráčům" : "Sdílet hráčům"}
            </button>
          </div>
        )}
        {!editor && battle.shared && <span className="ml-auto text-xs text-[var(--ink-3)]">📡 živě sdíleno – jen prohlížení</span>}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* mapa */}
        <div className="flex-1 overflow-auto bg-[#10171f] p-3">
          {battleMap ? (
            <BattleMapGrid map={battleMap.data} tokens={sb.tok} sel={sel} setSel={setSel}
              editor={editor} walkable={walkable} onMove={moveTok} />
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--ink-3)] text-sm">
              Boj bez mapy – použij tracker vpravo.
            </div>
          )}
        </div>

        {/* tracker */}
        <aside className="w-[340px] shrink-0 border-l border-[var(--line)] overflow-y-auto p-3 space-y-3">
          {/* iniciativa */}
          <div className="card p-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">Iniciativa</div>
            <ol className="space-y-0.5">
              {sb.ord.map((id: string, i: number) => {
                const t = tok(id); if (!t) return null;
                return (
                  <li key={id} onClick={() => setSel(id)}
                    className={"flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm" +
                      (i === sb.turn ? " bg-[var(--accent-soft)] border border-[var(--accent)] font-bold" : " hover:bg-[var(--bg-3)]") +
                      (t.dead || t.hp <= 0 ? " opacity-45 line-through" : "")}>
                    <span className="w-6 text-right text-xs">{t.init ?? "–"}</span>
                    <span className="w-2 h-2 rounded-full" style={{ background: SIDE_COLOR[t.side] }} />
                    <span className="flex-1 truncate">{t.nazev}</span>
                    <span className="text-xs text-[var(--ink-3)]">{t.hp}/{t.max}</span>
                  </li>
                );
              })}
              {sb.tok.filter((t: any) => !sb.ord.includes(t.id)).map((t: any) => (
                <li key={t.id} onClick={() => setSel(t.id)}
                  className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm opacity-70">
                  <span className="w-6 text-right text-xs">·</span>
                  <span className="w-2 h-2 rounded-full" style={{ background: SIDE_COLOR[t.side] }} />
                  <span className="flex-1 truncate">{t.nazev}</span>
                  <span className="text-xs text-[var(--ink-3)]">mimo pořadí</span>
                </li>
              ))}
              {!sb.tok.length && <li className="text-xs text-[var(--ink-3)] p-2">Žádní účastníci.</li>}
            </ol>
          </div>

          {/* detail žetonu */}
          {selT && (
            <div className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: SIDE_COLOR[selT.side] }} />
                <b className="flex-1">{selT.nazev}</b>
                <span className="text-xs text-[var(--ink-3)]">AC {selT.ac}</span>
                {editor && <button className="btn sm" title="Odebrat" onClick={() => confirm(`Odebrat ${selT.nazev}?`) && removeTok(selT)}>✕</button>}
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                {editor && <button className="btn sm" onClick={() => dmg(selT, 5)}>−5</button>}
                {editor && <button className="btn sm" onClick={() => dmg(selT, 1)}>−1</button>}
                <div className="flex-1">
                  <div className="cs-hpbar"><i style={{ width: Math.max(0, Math.min(100, selT.hp / selT.max * 100)) + "%" }} /></div>
                  <div className="text-center text-xs mt-0.5">{selT.hp} / {selT.max}{selT.tmp ? ` +${selT.tmp} tmp` : ""}</div>
                </div>
                {editor && <button className="btn sm" onClick={() => dmg(selT, -1)}>+1</button>}
                {editor && <button className="btn sm" onClick={() => dmg(selT, -5)}>+5</button>}
              </div>
              {editor && (
                <div className="flex gap-1.5 mb-2">
                  <input className="inp !py-0.5 !w-20 text-xs" placeholder="±vlastní" id={`dmg-${selT.id}`}
                    onKeyDown={(e) => { if (e.key === "Enter") { const v = Number((e.target as HTMLInputElement).value); if (v) { dmg(selT, v); (e.target as HTMLInputElement).value = ""; } } }} />
                  <button className="btn sm" onClick={() => { const el = document.getElementById(`dmg-${selT.id}`) as HTMLInputElement; const v = Number(el.value); if (v) { dmg(selT, v); el.value = ""; } }}>Aplikuj</button>
                  <button className="btn sm" title="+10 temp" onClick={() => mutate((s) => { const x = s.tok.find((q: any) => q.id === selT.id); if (x) x.tmp = (x.tmp || 0) + 10; })}>+tmp</button>
                </div>
              )}
              {/* stavy */}
              <div className="flex flex-wrap gap-1 mb-2">
                {CONDITIONS.map((c) => (
                  <button key={c} disabled={!editor} onClick={() => toggleCond(selT, c)}
                    className={"chip text-[10px]" + (hasC(selT, c) ? " chip-accent" : " opacity-50") + (editor ? " cursor-pointer" : "")}>{c}</button>
                ))}
              </div>
              {/* death saves pro PC na 0 HP */}
              {selT.kind === "pc" && selT.hp <= 0 && !selT.dead && (
                <div className="text-xs">
                  <b>Death saves:</b> ✓{selT.ds?.s || 0} · ✗{selT.ds?.f || 0}
                  {editor && <>
                    <button className="btn sm ml-2" onClick={() => ds(selT, true)}>+✓</button>
                    <button className="btn sm" onClick={() => ds(selT, false)}>+✗</button>
                  </>}
                </div>
              )}
              {selT.dead && <div className="text-xs font-bold text-[#a33]">☠ Mrtvý</div>}
              {incap(selT) && !selT.dead && <div className="text-xs text-[#a33]">Nemůže jednat</div>}
              <div className="text-xs text-[var(--ink-3)] mt-1">
                {selT.x != null ? `pole ${cellName(selT.x, selT.y)}` : "není na mapě"}
                {selT.speed ? ` · rychlost ${selT.speed} ft` : ""}
              </div>
            </div>
          )}

          {/* přidání účastníků */}
          {editor && <AddToken addPc={addPc} addCustom={addCustom} />}

          {/* log */}
          <div className="card p-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1">Log</div>
            <div className="space-y-0.5 max-h-64 overflow-y-auto text-xs">
              {(sb.log || []).map((l: any, i: number) => (
                <div key={i} className={l.pj ? "text-[var(--accent-2)]" : ""}>
                  <span className="text-[var(--ink-3)]">{l.k ? `k${l.k} ` : ""}{l.c} </span>{l.t}
                </div>
              ))}
              {!sb.log?.length && <div className="text-[var(--ink-3)]">Zatím prázdné.</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* --- SVG bojová mapa --- */
const TILE_FILL: Record<string, string> = {
  "#": "#00000088", ".": "transparent", S: "#4a7ba622", r: "#4a7ba655",
  "%": "#8a6b3d33", "^": "#ffffff18", "~": "#4a7ba633",
};

function BattleMapGrid({ map, tokens, sel, setSel, editor, walkable, onMove }: any) {
  const CELL = 34;
  const mrizka: string[] = map.mrizka || [];
  const W = mrizka[0]?.length || 0, H = mrizka.length;
  const svgRef = useRef<SVGSVGElement>(null);

  const cellAt = (e: React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (r.width / W));
    const y = Math.floor((e.clientY - r.top) / (r.height / H));
    return [x, y];
  };

  const click = (e: React.MouseEvent) => {
    if (!editor || !sel) return;
    const [x, y] = cellAt(e);
    const t = tokens.find((q: any) => q.id === sel);
    if (t && walkable(x, y)) onMove(t, x, y);
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W * CELL} ${H * CELL}`}
      className="w-full max-w-[1100px] mx-auto select-none" onClick={click}>
      {map.obrazek && (
        <image href={`/repo/11_Mapy/${map.obrazek}`} x={0} y={0} width={W * CELL} height={H * CELL} preserveAspectRatio="none" />
      )}
      {/* mřížka + neprostupné */}
      {mrizka.map((row, y) => [...row].map((c, x) => (
        <rect key={x + "," + y} x={x * CELL} y={y * CELL} width={CELL} height={CELL}
          fill={TILE_FILL[c] || "transparent"} stroke="#ffffff10" strokeWidth={0.5} />
      )))}
      {/* žetony */}
      {tokens.filter((t: any) => t.x != null).map((t: any) => (
        <g key={t.id} transform={`translate(${(t.x + t.s / 2) * CELL} ${(t.y + t.s / 2) * CELL})`}
          onClick={(e) => { e.stopPropagation(); setSel(t.id); }} className="cursor-pointer">
          <circle r={t.s * CELL / 2 - 2} fill={SIDE_COLOR[t.side]}
            stroke={t.id === sel ? "#ffd76a" : "#0009"} strokeWidth={t.id === sel ? 3 : 1.5} opacity={t.dead ? 0.4 : 0.95} />
          <text textAnchor="middle" dy={4} fontSize={Math.min(13, t.s * CELL / 2.6)} fill="#fff" fontWeight={700}>
            {String(t.nazev).split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2)}
          </text>
          <rect x={-t.s * CELL / 2 + 2} y={t.s * CELL / 2 - 6} width={(t.s * CELL - 4)} height={4} rx={2} fill="#000a" />
          <rect x={-t.s * CELL / 2 + 2} y={t.s * CELL / 2 - 6} width={(t.s * CELL - 4) * Math.max(0, t.hp / t.max)} height={4} rx={2} fill={t.hp > t.max / 2 ? "#4a7" : "#a33"} />
        </g>
      ))}
    </svg>
  );
}

/* --- přidání účastníků --- */
function AddToken({ addPc, addCustom }: any) {
  const [mode, setMode] = useState<"pc" | "custom">("pc");
  const [pcPath, setPcPath] = useState("");
  const [pcName, setPcName] = useState("");
  const [pcSheet, setPcSheet] = useState<any>(null);
  const index = useEntityIndex();
  const [f, setF] = useState({ nazev: "", side: "nepratele", hp: 10, ac: 10, initB: 0, s: 1, speed: 30, pocet: 1 });

  const pickPc = async (path: string) => {
    setPcPath(path);
    const item = index.data?.get(path);
    if (!item) { setPcName(""); setPcSheet(null); return; }
    setPcName(item.name);
    const p = await get<any>(`/api/page?path=${encodeURIComponent(path)}`);
    setPcSheet(p.entity?.sheet || null);
  };

  return (
    <div className="card p-3">
      <div className="flex gap-1 mb-2">
        <button className={"btn sm" + (mode === "pc" ? " chip-accent" : "")} onClick={() => setMode("pc")}>Postava</button>
        <button className={"btn sm" + (mode === "custom" ? " chip-accent" : "")} onClick={() => setMode("custom")}>Vlastní</button>
      </div>
      {mode === "pc" ? (
        <div>
          <EntityPicker target="postava" value={pcPath} onChange={pickPc} />
          <button className="btn sm mt-2 w-full" disabled={!pcPath} onClick={() => addPc(pcPath, pcName, pcSheet)}>+ Přidat do boje{pcSheet ? ` (HP ${pcSheet.hp}, AC ${pcSheet.ac})` : ""}</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <input className="inp !py-1 text-sm" placeholder="Název (netvor)" value={f.nazev}
            onChange={(e) => setF({ ...f, nazev: e.target.value })} />
          <div className="grid grid-cols-3 gap-1.5">
            <label className="text-[10px]">HP<input type="number" className="inp !py-1" value={f.hp} onChange={(e) => setF({ ...f, hp: Number(e.target.value) })} /></label>
            <label className="text-[10px]">AC<input type="number" className="inp !py-1" value={f.ac} onChange={(e) => setF({ ...f, ac: Number(e.target.value) })} /></label>
            <label className="text-[10px]">Init<input type="number" className="inp !py-1" value={f.initB} onChange={(e) => setF({ ...f, initB: Number(e.target.value) })} /></label>
            <label className="text-[10px]">Strana
              <select className="inp !py-1" value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })}>
                <option value="nepratele">Nepřátelé</option><option value="druzina">Družina</option><option value="neutral">Neutrální</option>
              </select></label>
            <label className="text-[10px]">Velikost
              <select className="inp !py-1" value={f.s} onChange={(e) => setF({ ...f, s: Number(e.target.value) })}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}×{n}</option>)}
              </select></label>
            <label className="text-[10px]">Počet<input type="number" min={1} className="inp !py-1" value={f.pocet} onChange={(e) => setF({ ...f, pocet: Number(e.target.value) })} /></label>
          </div>
          <button className="btn sm w-full" disabled={!f.nazev.trim()} onClick={() => {
            for (let i = 0; i < (f.pocet || 1); i++) addCustom({ ...f, nazev: f.pocet > 1 ? `${f.nazev} ${i + 1}` : f.nazev });
          }}>+ Přidat</button>
        </div>
      )}
    </div>
  );
}

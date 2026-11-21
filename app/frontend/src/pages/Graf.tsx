import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Waypoints } from "lucide-react";
import { get } from "../api";
import EntityPicker from "../components/EntityPicker";
import { PageHeader } from "../components/ui";
import { useApp, isEditor } from "../store";

interface GNode { id: string; title: string; type: string; url: string; center?: boolean }
interface GEdge { src: string; dst: string; kind: string; dir: string }
interface Pos { x: number; y: number; vx: number; vy: number }

const TYPE_COLORS: Record<string, string> = {
  postava: "#4a7ba6", zeme: "#5a8a4a", mesto: "#8a6b3d", frakce: "#a33a3a",
  kampan: "#7a4a9e", quest: "#b0762a", sezeni: "#3a8a80", hadanka: "#9e4a6e",
  misto: "#6a8a3a", kniha: "#7a6a9e", obchod: "#9e7a3a", druh: "#4a9e8a",
  povolani: "#8a4a6e", podtrida: "#6e4a9e", svet: "#9e9e5a", adresar: "#888",
  stranka: "#777",
};
const TYPE_LABELS: Record<string, string> = {
  postava: "Postava", zeme: "Země", mesto: "Město", frakce: "Frakce", kampan: "Kampaň",
  quest: "Quest", sezeni: "Sezení", hadanka: "Hádanka", misto: "Místo",
  kniha: "Kniha", obchod: "Obchod", druh: "Druh", povolani: "Povolání",
  podtrida: "Podtřída", svet: "Svět", stranka: "Stránka", adresar: "Složka",
};
const color = (t: string) => TYPE_COLORS[t] || "#777";

const W = 900, H = 620, MAX_NODES = 80;

function layout(nodes: GNode[], edges: GEdge[]): Map<string, Pos> {
  const n = nodes.length;
  const pos = new Map<string, Pos>();
  nodes.forEach((nd, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    pos.set(nd.id, { x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 200, vx: 0, vy: 0 });
  });
  const center = nodes.find((x) => x.center)?.id || nodes[0]?.id;

  for (let it = 0; it < 200; it++) {
    const k = 1 - it / 200;
    nodes.forEach((a, i) => {
      const pa = pos.get(a.id)!;
      for (let j = i + 1; j < n; j++) {
        const pb = pos.get(nodes[j].id)!;
        let dx = pa.x - pb.x, dy = pa.y - pb.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const rep = 9000 / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        pa.vx += dx * rep * k; pa.vy += dy * rep * k;
        pb.vx -= dx * rep * k; pb.vy -= dy * rep * k;
      }
    });
    edges.forEach((e) => {
      const pa = pos.get(e.src), pb = pos.get(e.dst);
      if (!pa || !pb) return;
      let dx = pb.x - pa.x, dy = pb.y - pa.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - 140) * 0.002 * k;
      dx /= d; dy /= d;
      pa.vx += dx * f * d; pa.vy += dy * f * d;
      pb.vx -= dx * f * d; pb.vy -= dy * f * d;
    });
    nodes.forEach((nd) => {
      const p = pos.get(nd.id)!;
      p.vx += (W / 2 - p.x) * 0.005 * k;
      p.vy += (H / 2 - p.y) * 0.005 * k;
      p.x += Math.max(-8, Math.min(8, p.vx));
      p.y += Math.max(-8, Math.min(8, p.vy));
      p.vx *= 0.6; p.vy *= 0.6;
      p.x = Math.max(90, Math.min(W - 90, p.x));
      p.y = Math.max(30, Math.min(H - 50, p.y));
    });
    if (center) { const p = pos.get(center)!; p.x = W / 2; p.y = H / 2; p.vx = p.vy = 0; }
  }
  return pos;
}

const KIND_OPTS: { k: string; label: string }[] = [
  { k: "fm", label: "Vazby" }, { k: "link", label: "Odkazy" }, { k: "mention", label: "Zmínky" },
];

export default function Graf() {
  const [sp, setSp] = useSearchParams();
  const path = sp.get("path") || "";
  const nav = useNavigate();
  const { user } = useApp();
  const editor = isEditor(user);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [hops, setHops] = useState(1);
  const [kinds, setKinds] = useState<Set<string>>(new Set(["fm", "link"]));

  const kindsParam = [...kinds].join(",");
  const graph = useQuery({
    queryKey: ["graph", path, hops, kindsParam],
    queryFn: () => get<{ nodes: GNode[]; edges: GEdge[] }>(
      `/api/graph/neighborhood?path=${encodeURIComponent(path)}&hops=${hops}&kinds=${kindsParam}`),
    enabled: !!path,
    retry: false,
  });
  const stats = useQuery({
    queryKey: ["graph-stats"],
    queryFn: () => get<{ pages_by_type: Record<string, number>; edges: Record<string, number>; orphans: { path: string; title: string }[] }>(
      "/api/graph/stats"),
    enabled: editor,
  });

  // omez na MAX_NODES uzlů podle stupně (centrum vždy zůstane)
  const { nodes, edges, total } = useMemo(() => {
    const all = graph.data?.nodes || [];
    const allE = graph.data?.edges || [];
    if (all.length <= MAX_NODES) return { nodes: all, edges: allE, total: all.length };
    const deg = new Map<string, number>();
    allE.forEach((e) => { deg.set(e.src, (deg.get(e.src) || 0) + 1); deg.set(e.dst, (deg.get(e.dst) || 0) + 1); });
    const keep = new Set(
      [...all].sort((a, b) => (b.center ? 1 : 0) - (a.center ? 1 : 0) || (deg.get(b.id) || 0) - (deg.get(a.id) || 0))
        .slice(0, MAX_NODES).map((x) => x.id));
    return {
      nodes: all.filter((x) => keep.has(x.id)),
      edges: allE.filter((e) => keep.has(e.src) && keep.has(e.dst)),
      total: all.length,
    };
  }, [graph.data]);

  const pos = useMemo(() => (nodes.length ? layout(nodes, edges) : new Map<string, Pos>()), [nodes, edges]);
  const selNode = nodes.find((x) => x.id === sel);
  const usedTypes = [...new Set(nodes.map((x) => x.type))];

  // popisky: ≤40 uzlů → centrum + přímí sousedé; jinak jen hover
  const labeled = useMemo(() => {
    const s = new Set<string>();
    if (nodes.length && nodes.length <= 40) {
      const c = nodes.find((x) => x.center)?.id;
      if (c) {
        s.add(c);
        edges.forEach((e) => {
          if (e.src === c) s.add(e.dst);
          if (e.dst === c) s.add(e.src);
        });
      }
    }
    if (hov) s.add(hov);
    if (sel) s.add(sel);
    return s;
  }, [nodes, edges, hov, sel]);

  useEffect(() => { setSel(null); }, [path]);

  const toggleKind = (k: string) => setKinds((s) => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k);
    if (!n.size) n.add(k); // aspoň jeden typ musí být zapnutý
    return n;
  });

  return (
    <div className="h-full flex min-h-0">
      <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col gap-3">
        <PageHeader icon={<Waypoints size={20} />} title="Graf vazeb"
          subtitle="Okolí stránky – klik na uzel přecentruje, dvojklik otevře stránku"
          actions={
            <div className="w-80 max-w-full">
              <EntityPicker value={path} onChange={(p) => setSp(p ? { path: p } : {})}
                placeholder="Vyber stránku nebo entitu…" />
            </div>
          } />

        <div className="flex items-center gap-3 flex-wrap font-ui text-[12px]">
          <span className="flex rounded-md border border-[var(--line)] overflow-hidden">
            {[1, 2].map((h) => (
              <button key={h} onClick={() => setHops(h)}
                className={"px-2.5 py-1 " + (hops === h ? "bg-[var(--accent-soft)] text-[var(--accent-2)] font-bold" : "text-[var(--ink-3)] hover:bg-[var(--panel-2)]")}>
                {h} {h === 1 ? "krok" : "kroky"}
              </button>
            ))}
          </span>
          {KIND_OPTS.map(({ k, label }) => (
            <label key={k} className="flex items-center gap-1.5 cursor-pointer text-[var(--ink-2)]">
              <input type="checkbox" className="accent-[var(--accent)]" checked={kinds.has(k)}
                onChange={() => toggleKind(k)} />
              {label}
            </label>
          ))}
          {total > nodes.length && (
            <span className="text-[var(--ink-3)]">zobrazeno {nodes.length} z {total}</span>
          )}
          {selNode && (
            <Link to={selNode.url} className="btn sm flex items-center gap-1 ml-auto">
              <ExternalLink size={13} /> Otevřít „{selNode.title}“
            </Link>
          )}
        </div>

        {!path && (
          <div className="card p-10 text-center font-ui text-[var(--ink-3)] text-sm">
            Vyber stránku – zobrazí se její okolí v grafu vazeb.
            Kliknutím na uzel se graf přecentruje, dvojklikem přejdeš na stránku.
          </div>
        )}
        {path && graph.isLoading && <div className="text-sm font-ui text-[var(--ink-3)]">Načítám graf…</div>}
        {graph.error && <div className="text-sm font-ui text-red-400">{graph.error.message}</div>}

        {!!nodes.length && (
          <div className="card p-0 overflow-hidden flex-1 min-h-[400px]">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block">
              {edges.map((e, i) => {
                const a = pos.get(e.src), b = pos.get(e.dst);
                if (!a || !b) return null;
                const st = e.kind === "fm"
                  ? { strokeWidth: 2.6, strokeDasharray: undefined, opacity: 0.85 }
                  : e.kind === "mention"
                    ? { strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.45 }
                    : { strokeWidth: 1.4, strokeDasharray: undefined, opacity: 0.6 };
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ink-3)" {...st} />;
              })}
              {nodes.map((nd) => {
                const p = pos.get(nd.id)!;
                const isC = !!nd.center, isSel = sel === nd.id || hov === nd.id;
                const label = nd.title.length > 22 ? nd.title.slice(0, 21) + "…" : nd.title;
                return (
                  <g key={nd.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer"
                    onClick={() => { setSel(nd.id); if (!isC) setSp({ path: nd.id }); }}
                    onDoubleClick={() => nav(nd.url)}
                    onMouseEnter={() => setHov(nd.id)} onMouseLeave={() => setHov(null)}>
                    <circle r={isC ? 17 : isSel ? 12 : 9}
                      fill={color(nd.type)} stroke={isSel ? "var(--accent)" : "var(--panel)"}
                      strokeWidth={isSel ? 3 : 2}>
                      <title>{nd.title}</title>
                    </circle>
                    {labeled.has(nd.id) && (
                      <text y={isC ? 30 : 24} textAnchor="middle" fontSize={isC ? 12 : 11}
                        fill="var(--ink)" fontWeight={isC ? 700 : 400}
                        style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "var(--panel)", strokeWidth: 3 }}>
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
        {path && !graph.isLoading && !nodes.length && !graph.error && (
          <div className="card p-6 font-ui text-sm text-[var(--ink-3)]">
            Stránka nemá žádné vazby ani odkazy – je osamělá.
          </div>
        )}

        {!!nodes.length && (
          <div className="flex gap-4 flex-wrap font-ui text-[11px] text-[var(--ink-3)]">
            {usedTypes.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color(t) }} />
                {TYPE_LABELS[t] || t}
              </span>
            ))}
            <span className="flex items-center gap-1.5"><i className="w-5 h-0 border-t-2 border-[var(--ink-3)] inline-block" /> vazba</span>
            <span className="flex items-center gap-1.5"><i className="w-5 h-0 border-t border-[var(--ink-3)] inline-block" /> odkaz</span>
            <span className="flex items-center gap-1.5"><i className="w-5 h-0 border-t border-dashed border-[var(--ink-3)] inline-block opacity-60" /> zmínka</span>
          </div>
        )}
      </div>

      {editor && (
        <aside className="hidden lg:block w-72 shrink-0 border-l border-[var(--line)] overflow-y-auto p-4 space-y-4 font-ui">
          <div className="card p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-2">Statistiky</div>
            {stats.data ? (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px]">
                  {Object.entries(stats.data.pages_by_type).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                    <div key={t} className="flex justify-between">
                      <span className="text-[var(--ink-2)]">{TYPE_LABELS[t] || t}</span>
                      <span className="text-[var(--ink-3)]">{c}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-[var(--line)] text-[12px] flex gap-3">
                  <span>{stats.data.edges.fm} vazeb</span>
                  <span>{stats.data.edges.link} odkazů</span>
                  <span>{stats.data.edges.mention} zmínek</span>
                </div>
              </>
            ) : <div className="text-xs text-[var(--ink-3)]">Načítám…</div>}
          </div>
          {!!stats.data?.orphans.length && (
            <div className="card p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
                Nepropojené stránky ({stats.data.orphans.length})
              </div>
              <ul className="space-y-1 max-h-80 overflow-y-auto">
                {stats.data.orphans.map((o) => (
                  <li key={o.path}>
                    <button className="text-[13px] text-left hover:underline"
                      onClick={() => setSp({ path: o.path })}>
                      {o.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

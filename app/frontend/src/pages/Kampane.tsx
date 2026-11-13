import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Trash2, ArrowUp, ArrowDown, Swords, ScrollText,
  Users, BookOpen, AlertTriangle, X, ImagePlus,
} from "lucide-react";
import { get, post, put, del, upload } from "../api";
import { useApp, isEditor } from "../store";

interface Kampan {
  id: number; name: string; path: string; slug: string; status: string;
  url: string; tags: string[]; data: Record<string, any>;
}
interface Battle { id: string; name: string; status: string; kampan: string }

const STAV: Record<string, string> = {
  "příprava": "bg-sky-900/40 text-sky-200 border-sky-700/50",
  "aktivní": "bg-emerald-900/40 text-emerald-200 border-emerald-700/50",
  "pozastavená": "bg-amber-900/40 text-amber-200 border-amber-700/50",
  "dokončená": "bg-zinc-700/40 text-zinc-300 border-zinc-600/50",
};

const battleFor = (b: Battle, k: Kampan) =>
  b.kampan === k.path || b.kampan === k.name;

// obálka kampaně: 07_Kampane/obrazky/Obalka_<slug>.webp (konvence – bez datového pole)
const coverOf = (k: Kampan) => {
  const slug = k.slug || k.path.split("/").pop()?.replace(/\.md$/, "");
  return slug ? `/repo/07_Kampane/obrazky/Obalka_${slug}.webp` : "";
};

export default function Kampane() {
  const { user } = useApp();
  const editor = isEditor(user);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"poradi" | "nazev" | "stav">("poradi");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [delId, setDelId] = useState<Kampan | null>(null);
  const [ver, setVer] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<Kampan | null>(null);

  const kampaneQ = useQuery({
    queryKey: ["kampane"],
    queryFn: () => get<{ items: Kampan[] }>("/api/entities?type=kampan&size=200"),
    refetchInterval: 30_000,
  });
  const battlesQ = useQuery({
    queryKey: ["battles"],
    queryFn: () => get<{ battles: Battle[] }>("/api/battles"),
    refetchInterval: 30_000,
  });

  const battles = battlesQ.data?.battles || [];
  const items = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let rows = (kampaneQ.data?.items || []).filter((k) => !/README\.md$/i.test(k.path));
    if (ql) rows = rows.filter((k) =>
      [k.name, k.data?.region, k.data?.temata, k.data?.urovne, ...(k.tags || [])]
        .some((v) => String(v || "").toLowerCase().includes(ql)));
    const stavRank = (s: string) =>
      ["aktivní", "příprava", "pozastavená", "dokončená"].indexOf(s) + 1 || 9;
    return [...rows].sort((a, b) =>
      sort === "poradi"
        ? (a.data?.poradi ?? 9999) - (b.data?.poradi ?? 9999) || a.name.localeCompare(b.name, "cs")
        : sort === "stav"
          ? stavRank(a.data?.stav) - stavRank(b.data?.stav) || a.name.localeCompare(b.name, "cs")
          : a.name.localeCompare(b.name, "cs"));
  }, [kampaneQ.data, q, sort]);

  const move = async (k: Kampan, dir: -1 | 1) => {
    const ordered = items.filter((x) => x.id !== k.id);
    const pos = items.findIndex((x) => x.id === k.id);
    const target = pos + dir;
    if (target < 0 || target >= items.length) return;
    // přečísluj pořadí všech podle nové pozice
    ordered.splice(target, 0, k);
    await Promise.all(ordered.map((x, i) =>
      put(`/api/entities/${x.id}`, { data: { ...(x.data || {}), poradi: i + 1 } })));
    qc.invalidateQueries({ queryKey: ["kampane"] });
  };

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true); setErr("");
    try {
      const r = await post<{ id: number }>("/api/entities", {
        type: "kampan", dir: "07_Kampane", name: newName.trim(),
        data: { stav: "příprava" },
      });
      qc.invalidateQueries({ queryKey: ["kampane", "nav", "entity-index"] });
      setShowNew(false); setNewName("");
      nav(`/kampane/${r.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Vytvoření selhalo");
      setBusy(false);
    }
  };

  // nahraný obrázek → 1200×540 webp obálka
  const toWebp = (file: File) => new Promise<Blob>((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const W = 1200, H = 540;
      const sc = Math.max(W / img.width, H / img.height);
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      c.getContext("2d")!.drawImage(img,
        (W - img.width * sc) / 2, (H - img.height * sc) / 2, img.width * sc, img.height * sc);
      c.toBlob((b) => (b ? res(b) : rej(new Error("konverze selhala"))), "image/webp", .88);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });

  const onCoverFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    const k = uploadTarget.current;
    ev.target.value = "";
    if (!f || !k) return;
    const blob = await toWebp(f);
    await upload(`/api/media/upload?dir=${encodeURIComponent("07_Kampane/obrazky")}`,
      blob, `Obalka_${k.slug}.webp`);
    setVer((v) => v + 1);
  };

  const remove = async () => {
    if (!delId) return;
    setBusy(true);
    try {
      await del(`/api/entities/${delId.id}`);
      qc.invalidateQueries({ queryKey: ["kampane", "nav", "entity-index"] });
      setDelId(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 fade-in">
        <div className="flex items-end justify-between gap-4 mb-1 flex-wrap">
          <div>
            <h1 className="chapter-title !text-left !mb-0">Kampaně</h1>
            <p className="text-sm text-[var(--ink-3)] italic mt-1">
              Přehled všech kampaní – stav, družina, questy, sezení a boje.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
              <input className="input !pl-8 !py-1.5 w-56" placeholder="Hledat kampaň…"
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input !py-1.5 !w-auto" value={sort}
              onChange={(e) => setSort(e.target.value as any)}>
              <option value="poradi">Vlastní pořadí</option>
              <option value="stav">Podle stavu</option>
              <option value="nazev">Podle názvu</option>
            </select>
            {editor && (
              <button className="btn chip-accent flex items-center gap-1.5" onClick={() => setShowNew(true)}>
                <Plus size={15} /> Nová kampaň
              </button>
            )}
          </div>
        </div>
        <div className="chapter-rule"><i>✦</i></div>

        {kampaneQ.isLoading && <div className="text-[var(--ink-3)] py-12 text-center">Načítám kampaně…</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((k, i) => {
            const d = k.data || {};
            const stav = String(d.stav || "");
            const bts = battles.filter((b) => battleFor(b, k));
            const counts: { icon: typeof Swords; n: number; l: string }[] = [
              { icon: Users, n: (d.postavy || []).length, l: "postav" },
              { icon: ScrollText, n: (d.questy || []).length, l: "questů" },
              { icon: BookOpen, n: (d.sezeni || []).length, l: "sezení" },
              { icon: Swords, n: bts.length, l: "bojů" },
            ];
            const cover = coverOf(k);
            return (
              <div key={k.id} className="card p-0 kampan-card group">
                {cover && (
                  <img src={cover + `?v=${ver}`} alt="" className="cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                )}
                <div className="kampan-card-grad" />
                <div className="kampan-card-body">
                  {stav && (
                    <span className={`chip border self-end ${STAV[stav] || "bg-[var(--bg-2)] text-[var(--ink-2)] border-[var(--line)]"}`}>
                      {stav}
                    </span>
                  )}
                  <div className="spacer" />
                  <Link to={`/kampane/${k.id}`}
                    className="text-xl font-bold leading-tight hover:text-[var(--accent-2)] hover:no-underline"
                    style={{ fontFamily: "var(--font-head)" }}>
                    {k.name}
                  </Link>
                  {d.temata && <div className="text-xs text-[var(--ink-3)] italic mt-0.5 line-clamp-1">{d.temata}</div>}
                  <div className="flex items-center gap-3 mt-2 text-[12px] text-[var(--ink-3)]">
                    {d.urovne && <span>lvl {d.urovne}</span>}
                    {d.region && <span>{String(d.region).split("/").pop()?.replace(/\.md$/, "").replace(/_/g, " ")}</span>}
                    {counts.map((c) => (
                      <span key={c.l} className="flex items-center gap-1" title={c.l}>
                        <c.icon size={12} /> {c.n}
                      </span>
                    ))}
                  </div>
                  {editor && (
                    <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-[var(--line)]">
                      <button className="btn btn-ghost !px-1.5 !py-1" title="Posunout nahoru" disabled={i === 0}
                        onClick={() => move(k, -1)}><ArrowUp size={14} /></button>
                      <button className="btn btn-ghost !px-1.5 !py-1" title="Posunout dolů" disabled={i === items.length - 1}
                        onClick={() => move(k, 1)}><ArrowDown size={14} /></button>
                      <div className="flex-1" />
                      <button className="btn btn-ghost !px-1.5 !py-1 !text-xs" title="Nahrát obálku"
                        onClick={() => { uploadTarget.current = k; fileRef.current?.click(); }}>
                        <ImagePlus size={14} />
                      </button>
                      <Link to={k.url} className="btn btn-ghost !px-2 !py-1 !text-xs">Wiki stránka</Link>
                      <button className="btn btn-ghost !px-1.5 !py-1 !text-red-400" title="Smazat kampaň"
                        onClick={() => setDelId(k)}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!kampaneQ.isLoading && !items.length && (
          <div className="text-center text-[var(--ink-3)] py-16">
            {q ? "Žádná kampaň neodpovídá hledání." : "Zatím žádné kampaně – založ první."}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onCoverFile} />

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center" onMouseDown={() => setShowNew(false)}>
          <div className="card w-full max-w-sm p-5 fade-in" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Nová kampaň</h2>
              <button className="btn btn-ghost !px-2" onClick={() => setShowNew(false)}><X size={16} /></button>
            </div>
            <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">Název kampaně</label>
            <input className="input w-full mb-4" value={newName} autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()} />
            {err && <div className="text-red-400 text-xs mb-3">{err}</div>}
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setShowNew(false)}>Zrušit</button>
              <button className="btn chip-accent" disabled={!newName.trim() || busy} onClick={create}>Vytvořit</button>
            </div>
          </div>
        </div>
      )}

      {delId && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center" onMouseDown={() => setDelId(null)}>
          <div className="card w-full max-w-sm p-5 fade-in" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2 text-red-400">
              <AlertTriangle size={18} /><h2 className="text-lg font-bold">Smazat kampaň?</h2>
            </div>
            <p className="text-sm text-[var(--ink-2)] mb-4">
              <b>{delId.name}</b> bude trvale smazána včetně její wiki stránky. Akci nelze vrátit.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setDelId(null)}>Zrušit</button>
              <button className="btn !bg-red-700 !border-red-700 !text-white" disabled={busy} onClick={remove}>
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, del } from "../api";
import { useApp, isEditor } from "../store";

const PAGE = 25;

export default function Boje() {
  const { user } = useApp();
  const editor = isEditor(user);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["battles"],
    queryFn: () => get<any>("/api/battles"),
    refetchInterval: 15000,
  });
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [kampanFiltr, setKampanFiltr] = useState("");
  const [sort, setSort] = useState<{ k: string; d: 1 | -1 }>({ k: "updated_at", d: -1 });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", kampan: "", quest: "", sezeni: "", map_ref: "" });
  const [busy, setBusy] = useState(false);
  const [maps, setMaps] = useState<any[]>([]);

  const battles = data?.battles || [];
  const kampanPages: any[] = data?.pages?.kampan || [];
  const kampanTitle = (v: string) =>
    kampanPages.find((p) => p.path === v)?.title || v || "—";
  const kampanPath = (v: string) =>
    kampanPages.find((p) => p.path === v || p.title === v)?.path;
  const battleKampane = (b: any): string[] =>
    Array.isArray(b.kampane) && b.kampane.length ? b.kampane : (b.kampan ? [b.kampan] : []);
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let rows = ql ? battles.filter((b: any) =>
      [b.name, b.kampan, ...(b.kampane || []), b.quest, b.sezeni].some((v) => String(v || "").toLowerCase().includes(ql))) : battles;
    if (kampanFiltr) rows = rows.filter((b: any) =>
      battleKampane(b).some((k) => k === kampanFiltr || kampanTitle(k) === kampanFiltr));
    rows = [...rows].sort((a: any, b: any) => {
      const av = a[sort.k] ?? "", bv = b[sort.k] ?? "";
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.d;
    });
    return rows;
  }, [battles, q, sort, kampanFiltr, kampanPages]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const th = (k: string, label: string) => (
    <th className="cursor-pointer select-none" onClick={() => setSort((s) => ({ k, d: s.k === k ? (s.d * -1) as 1 | -1 : 1 }))}>
      {label} {sort.k === k ? (sort.d === 1 ? "▲" : "▼") : ""}
    </th>
  );

  const openNew = async () => {
    if (!maps.length) setMaps((await get<any>("/api/map/data")).bojove_mapy || []);
    setShowNew(true);
  };
  const create = async () => {
    setBusy(true);
    try {
      const r = await post<any>("/api/battles", form);
      qc.invalidateQueries({ queryKey: ["battles"] });
      window.location.href = `/boj?boj=${r.id}`;
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto font-ui">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">⚔ Boje</h1>
        <input className="inp !w-56 !py-1.5 ml-auto" placeholder="Filtrovat…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select className="inp !w-auto !py-1.5" value={kampanFiltr}
          onChange={(e) => { setKampanFiltr(e.target.value); setPage(0); }}>
          <option value="">Všechny kampaně</option>
          {kampanPages.map((p) => <option key={p.path} value={p.title}>{p.title}</option>)}
        </select>
        {editor && <button className="btn" onClick={openNew}>+ Nový boj</button>}
      </div>
      <div className="card overflow-hidden">
        <table className="tbl w-full">
          <thead><tr>{th("name", "Název")}{th("status", "Stav")}{th("kampan", "Kampaň")}<th>Účastníci</th>{th("kola", "Kolo")}{th("updated_at", "Upraveno")}{editor && <th />}</tr></thead>
          <tbody>
            {rows.map((b: any) => (
              <tr key={b.id}>
                <td><Link to={`/boj?boj=${b.id}`}>{b.name}</Link>{b.shared ? " 📡" : ""}</td>
                <td><span className={"chip text-[11px]" + (b.status === "aktivni" ? " chip-accent" : "")}>{b.status}</span></td>
                <td className="text-[var(--ink-3)]">
                  {battleKampane(b).map((k, i) => (
                    <span key={k}>
                      {i > 0 && ", "}
                      {kampanPath(k)
                        ? <Link to={`/kampane/${kampanPath(k)}`}>{kampanTitle(k)}</Link>
                        : kampanTitle(k)}
                    </span>
                  ))}
                  {!battleKampane(b).length && "—"}
                </td>
                <td className="text-xs">{b.ucastnici?.length || 0}</td>
                <td>{b.kola || "—"}</td>
                <td className="text-xs text-[var(--ink-3)]">{String(b.updated_at || "").slice(0, 16).replace("T", " ")}</td>
                {editor && (
                  <td className="text-right">
                    <button className="btn sm" title="Smazat" onClick={async () => {
                      if (confirm(`Smazat boj „${b.name}“?`)) { await del(`/api/battles/${b.id}`); qc.invalidateQueries({ queryKey: ["battles"] }); }
                    }}>✕</button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-[var(--ink-3)]">Žádné boje.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex gap-1 justify-center mt-3">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} className={"btn sm" + (i === page ? " chip-accent" : "")} onClick={() => setPage(i)}>{i + 1}</button>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[600]" onClick={() => setShowNew(false)}>
          <div className="card p-5 w-96 font-ui" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-3">Nový boj</h2>
            <label className="block text-xs mb-1">Název</label>
            <input className="inp mb-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            {(["kampan", "quest", "sezeni"] as const).map((k) => (
              <div key={k}>
                <label className="block text-xs mb-1 capitalize">{k}</label>
                <select className="inp mb-3" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>
                  <option value="">—</option>
                  {(data?.pages?.[k] || []).map((p: any) => <option key={p.path} value={p.path}>{p.title}</option>)}
                </select>
              </div>
            ))}
            <label className="block text-xs mb-1">Bojová mapa</label>
            <select className="inp mb-4" value={form.map_ref} onChange={(e) => setForm({ ...form, map_ref: e.target.value })}>
              <option value="">— bez mapy</option>
              {maps.map((m: any) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setShowNew(false)}>Zrušit</button>
              <button className="btn chip-accent" disabled={!form.name.trim() || busy} onClick={create}>Vytvořit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

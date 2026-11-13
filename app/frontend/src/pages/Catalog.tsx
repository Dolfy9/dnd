import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { get } from "../api";

type Row = Record<string, unknown>;
type Col = { label: string; sort?: string; fn: (r: Row) => unknown };

const d = (r: Row, k: string) => (r.data as Row | undefined)?.[k];

const KINDS: Record<string, { label: string; api: string; cols: Col[]; sortDefault?: string }> = {
  postavy: {
    label: "Postavy", api: "/api/catalog/postavy",
    cols: [
      { label: "Jméno", sort: "name", fn: (r) => r.name },
      { label: "Titul", sort: "titul", fn: (r) => r.titul },
      { label: "Druh", sort: "druh", fn: (r) => r.druh },
      { label: "Povolání", fn: (r) => r.tridy },
      { label: "Úroveň", sort: "uroven", fn: (r) => r.uroven || "" },
      { label: "Vazeb", sort: "zmínky", fn: (r) => (r["zmínky"] as number) || "" },
    ],
  },
  obchody: {
    label: "Obchody", api: "/api/catalog/obchody",
    cols: [
      { label: "Název", sort: "name", fn: (r) => r.name },
      { label: "Typ", sort: "typ", fn: (r) => r.typ },
      { label: "Město", fn: (r) => (r.mesto as Row)?.title || "" },
      { label: "Majitel", fn: (r) => ((r.majitel as Row[]) || []).map((m) => m.name).join(", ") },
      { label: "Čtvrť", sort: "ctvrt", fn: (r) => r.ctvrt },
    ],
  },
  druhy: {
    label: "Druhy", api: "/api/catalog/druhy",
    cols: [
      { label: "Druh", sort: "name", fn: (r) => r.name },
      { label: "Velikost", sort: "velikost", fn: (r) => r.velikost },
      { label: "Rychlost", fn: (r) => r.rychlost },
      { label: "Zdroj", sort: "zdroj", fn: (r) => r.zdroj },
    ],
  },
  frakce: {
    label: "Frakce", api: "/api/catalog/entity/frakce",
    cols: [
      { label: "Název", sort: "name", fn: (r) => r.name },
      { label: "Štítky", fn: (r) => ((r.tags as string[]) || []).join(", ") },
    ],
  },
  mesta: {
    label: "Města", api: "/api/catalog/entity/mesto",
    cols: [
      { label: "Název", sort: "name", fn: (r) => r.name },
      { label: "Štítky", fn: (r) => ((r.tags as string[]) || []).join(", ") },
    ],
  },
  zeme: {
    label: "Země", api: "/api/catalog/entity/zeme",
    cols: [
      { label: "Název", sort: "name", fn: (r) => r.name },
      { label: "Štítky", fn: (r) => ((r.tags as string[]) || []).join(", ") },
    ],
  },
  povolani: {
    label: "Povolání (Classes)", api: "/api/rules/list/class",
    cols: [
      { label: "Název", sort: "name", fn: (r) => r.name },
      { label: "Hit Die", fn: (r) => d(r, "hit_die") || d(r, "hit-die") || d(r, "kostka") },
    ],
  },
  podtridy: {
    label: "Podtřídy", api: "/api/rules/list/subclass",
    cols: [
      { label: "Název", sort: "name", fn: (r) => r.name },
      { label: "Třída", fn: (r) => d(r, "class") || d(r, "trida") },
    ],
  },
  pozadi: {
    label: "Pozadí", api: "/api/rules/list/background",
    cols: [
      { label: "Název", sort: "name", fn: (r) => r.name },
      { label: "Feat", fn: (r) => d(r, "feat") || d(r, "origin_feat") },
    ],
  },
  featy: {
    label: "Featy", api: "/api/rules/list/feat",
    cols: [
      { label: "Název", sort: "name", fn: (r) => r.name },
      { label: "Kategorie", fn: (r) => d(r, "kategorie") || d(r, "category") },
    ],
  },
  kouzla: {
    label: "Kouzla", api: "/api/rules/list/spell",
    cols: [
      { label: "Kouzlo", sort: "name", fn: (r) => r.name },
      { label: "Úroveň", sort: "uroven", fn: (r) => d(r, "uroven") },
      { label: "Škola", sort: "skola", fn: (r) => d(r, "skola") },
      { label: "Sesílání", fn: (r) => d(r, "cas") },
      { label: "Dosah", fn: (r) => d(r, "dosah") },
    ],
  },
  bestiar: {
    label: "Bestiář", api: "/api/rules/list/monster",
    cols: [
      { label: "Netvor", sort: "name", fn: (r) => r.name },
      { label: "CR", sort: "cr_num", fn: (r) => d(r, "cr") },
      { label: "HP", sort: "hp", fn: (r) => d(r, "hp") },
      { label: "AC", fn: (r) => d(r, "ac") },
    ],
  },
  predmety: {
    label: "Předměty", api: "/api/rules/list/item",
    cols: [
      { label: "Předmět", sort: "name", fn: (r) => r.name },
      { label: "Typ", sort: "druh", fn: (r) => d(r, "druh") || d(r, "kategorie") },
      { label: "Vzácnost", sort: "vzacnost", fn: (r) => d(r, "vzacnost") },
      { label: "Cena", fn: (r) => d(r, "cena") },
    ],
  },
  glosar: {
    label: "Glosář", api: "/api/rules/list/glossary",
    cols: [
      { label: "Pojem", sort: "name", fn: (r) => r.name },
      { label: "Štítek", fn: (r) => d(r, "stitek") },
    ],
  },
};

export default function Catalog() {
  const { kind = "postavy" } = useParams();
  const def = KINDS[kind];
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const size = 50;

  useEffect(() => { setSort("name"); setOrder("asc"); setPage(1); setQ(""); setQInput(""); }, [kind]);
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [qInput]);

  const data = useQuery({
    queryKey: ["catalog", kind, q, sort, order, page],
    queryFn: () => get<{ items: Row[]; total: number; page: number; pages: number }>(
      `${def.api}${def.api.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}&sort=${sort}&order=${order}&page=${page}&size=${size}`),
    enabled: !!def,
    placeholderData: (prev) => prev,
  });

  if (!def) return <div className="p-8 font-ui text-[var(--ink-3)]">Neznámý katalog „{kind}“.</div>;

  const items = data.data?.items || [];
  const total = data.data?.total ?? items.length;
  const pages = data.data?.pages ?? 1;

  const toggleSort = (key: string) => {
    if (sort === key) setOrder(order === "asc" ? "desc" : "asc");
    else { setSort(key); setOrder("asc"); }
    setPage(1);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto fade-in">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold">{def.label}</h1>
        <span className="text-sm text-[var(--ink-3)] font-ui">{total} položek</span>
        <input
          className="input !w-64 ml-auto !py-1.5 !text-sm"
          placeholder="Filtrovat na serveru…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
      </div>
      <div className="flex gap-1.5 mb-4 flex-wrap font-ui text-xs">
        {Object.entries(KINDS).map(([k, v]) => (
          <Link key={k} to={`/katalog/${k}`}
            className={`btn !text-xs !py-1 ${k === kind ? "!border-[var(--accent)] !text-[var(--accent-2)]" : ""}`}>
            {v.label}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm font-ui">
          <thead>
            <tr className="border-b border-[var(--line)] text-left">
              {def.cols.map((c, i) => (
                <th key={i}
                  className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)]
                    ${c.sort ? "cursor-pointer select-none hover:text-[var(--ink)]" : ""}`}
                  onClick={() => c.sort && toggleSort(c.sort)}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort === c.sort && (order === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={String(it.key ?? it.id ?? i)} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-2)]">
                {def.cols.map((c, j) => (
                  <td key={j} className="px-3 py-2">
                    {j === 0 && it.url ? <Link to={String(it.url)}>{String(c.fn(it) ?? "—")}</Link>
                      : j === 0 && it.key ? <span className="text-[var(--accent-2)]">{String(c.fn(it) ?? "—")}</span>
                      : String(c.fn(it) ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && !data.isLoading && (
          <div className="p-4 text-sm text-[var(--ink-3)]">Nic nenalezeno.</div>
        )}
        {data.isLoading && <div className="p-4 text-sm text-[var(--ink-3)]">Načítám…</div>}
        {data.error && <div className="p-4 text-sm text-red-400">{data.error.message}</div>}
      </div>
      {pages > 1 && (
        <div className="flex items-center gap-2 mt-3 font-ui text-sm justify-center">
          <button className="btn !py-1 !px-2" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-[var(--ink-2)]">{page} / {pages}</span>
          <button className="btn !py-1 !px-2" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { get } from "../api";

interface Proposal { path: string; title: string; type: string; status: string; url: string }

export default function Navrhy() {
  const data = useQuery({
    queryKey: ["navrhy"],
    queryFn: () => get<{ items: Proposal[] }>("/api/admin/navrhy"),
  });
  const items = data.data?.items || [];
  return (
    <div className="p-6 max-w-3xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-1">Návrhy k revizi</h1>
      <p className="text-sm font-ui text-[var(--ink-3)] mb-4">
        Stránky označené „Stav: návrh“. Po schválení změň stav na „kánon“.
      </p>
      <div className="card divide-y divide-[var(--line)] font-ui">
        {items.map((p) => (
          <Link key={p.path} to={p.url}
            className="flex items-center px-4 py-2.5 hover:no-underline hover:bg-[var(--panel-2)]">
            <span className="chip chip-accent mr-2">návrh</span>
            <span className="text-sm">{p.title}</span>
            <span className="ml-auto text-xs text-[var(--ink-3)]">{p.path}</span>
          </Link>
        ))}
        {!items.length && !data.isLoading && (
          <div className="px-4 py-6 text-sm text-[var(--ink-3)]">Žádné návrhy – vše je schváleno.</div>
        )}
        {data.error && <div className="px-4 py-4 text-sm text-red-400">{data.error.message}</div>}
      </div>
    </div>
  );
}

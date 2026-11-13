import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get } from "../api";

interface EntItem { id: number; name: string; path: string; type: string; type_label: string; url: string }

// sdílená cache jmen entit pro labely pickerů
export const useEntityIndex = () =>
  useQuery({
    queryKey: ["entity-index"],
    queryFn: () => get<{ items: EntItem[] }>("/api/entities?limit=1000"),
    staleTime: 60_000,
    select: (r) => {
      const m = new Map<string, EntItem>();
      for (const i of r.items) m.set(i.path, i);
      return m;
    },
  });

export const labelFor = (path: string) =>
  path.split("/").pop()!.replace(/\.md$/, "").replace(/_/g, " ");

interface Props {
  target?: string;              // typ entity (nepovinné = libovolný)
  value: string;                // path v repu ("" = nic)
  onChange: (path: string) => void;
  placeholder?: string;
}

export default function EntityPicker({ target, value, onChange, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<EntItem[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const index = useEntityIndex();
  const label = value ? (index.data?.get(value)?.name ?? labelFor(value)) : "";

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (q.length < 1) { setOpts([]); return; }
    const t = setTimeout(async () => {
      const r = await get<{ items: EntItem[] }>(
        `/api/entities?q=${encodeURIComponent(q)}${target ? `&type=${target}` : ""}&limit=15`);
      setOpts(r.items);
    }, 200);
    return () => clearTimeout(t);
  }, [q, target]);

  return (
    <div className="relative" ref={box}>
      <div className="flex gap-1">
        <input
          className="input !py-1 !text-[13px] flex-1"
          placeholder={placeholder || "Hledat entitu…"}
          value={open ? q : label || q}
          onFocus={() => { setOpen(true); setQ(""); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        />
        {value && (
          <button type="button" className="btn !py-1 !px-2 !text-xs" onClick={() => onChange("")}
            title="Zrušit výběr">✕</button>
        )}
      </div>
      {open && (q.length >= 1 || opts.length > 0) && (
        <div className="card absolute left-0 right-0 top-9 z-40 max-h-56 overflow-y-auto p-1 fade-in">
          {opts.map((o) => (
            <button key={o.id} type="button"
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--accent-soft)] font-ui text-[13px] flex gap-2"
              onMouseDown={(e) => { e.preventDefault(); onChange(o.path); setOpen(false); }}>
              <span className="truncate">{o.name}</span>
              <span className="ml-auto text-[10px] text-[var(--ink-3)]">{o.type_label}</span>
            </button>
          ))}
          {q && !opts.length && <div className="px-2 py-2 text-xs text-[var(--ink-3)]">Nic nenalezeno</div>}
        </div>
      )}
      {value && !open && (
        <div className="text-[11px] text-[var(--ink-3)] mt-0.5 font-ui">
          <Link to={`/p/${encodeURI(value.replace(/\.md$/, ""))}`} className="text-[var(--ink-3)]">↗ {value}</Link>
        </div>
      )}
    </div>
  );
}

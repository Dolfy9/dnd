import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "../api";

export type ObsahItem = { key: string; name: string; vlastni: boolean; stranka?: string; data?: any };

export function useObsah(kind: string, q = "") {
  return useQuery({
    queryKey: ["obsah", kind, q],
    queryFn: () =>
      get<{ items?: ObsahItem[] } & ObsahItem[]>(
        `/api/postava/obsah?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(q)}`),
    staleTime: 30_000,
  });
}

function itemsOf(d: any): ObsahItem[] {
  return Array.isArray(d) ? d : (d?.items || []);
}

/* Výběr z oficiálního + vlastního obsahu (druh/třída/feat/kouzlo/předmět…). */
export default function ContentPicker({ kind, value, onChange, placeholder, filter }: {
  kind: string; value?: string; placeholder?: string;
  onChange: (key: string, item?: ObsahItem) => void;
  filter?: (it: ObsahItem) => boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useObsah(kind, q);
  const items = itemsOf(data).filter((it) => !filter || filter(it));
  return (
    <span className="cs-pick">
      <input className="cs-e" value={open ? q : (value ?? "")} placeholder={placeholder || "— vyber —"}
        onFocus={() => { setOpen(true); setQ(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange("", undefined); }} />
      {open && (
        <span className="cs-pick-list">
          {isLoading && <span className="cs-pick-item">Načítám…</span>}
          {!isLoading && !items.length && <span className="cs-pick-item cs-pick-none">Nic nenalezeno</span>}
          {items.slice(0, 60).map((it) => (
            <button key={it.key} type="button" className="cs-pick-item"
              onMouseDown={(e) => { e.preventDefault(); onChange(it.name, it); setOpen(false); }}>
              {it.name}{it.vlastni && <em className="cs-vlastni">vlastní</em>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

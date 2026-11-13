import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { search } from "../api";
import { useApp } from "../store";

interface Hit {
  label: string;
  sub?: string;
  url: string;
}

export default function Omnibox() {
  const { omnibox, setOmnibox } = useApp();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Record<string, Hit[]>>({});
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (omnibox) {
      setQ("");
      setHits({});
      setSel(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [omnibox]);

  useEffect(() => {
    if (!omnibox || q.trim().length < 2) {
      setHits({});
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await search(q);
        const groups: Record<string, Hit[]> = {};
        for (const [g, items] of Object.entries(r.groups)) {
          groups[g] = (items as Record<string, unknown>[]).map((it) => ({
            label: String(it.title || it.name || ""),
            sub: String(it.kind_label || it.type || it.snippet || it.path || ""),
            url: String(it.url || `/p/${it.path}`),
          }));
        }
        setHits(groups);
        setSel(0);
      } finally {
        setBusy(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, omnibox]);

  const flat = useMemo(() => Object.values(hits).flat(), [hits]);

  if (!omnibox) return null;

  const go = (url: string) => {
    setOmnibox(false);
    nav(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[12vh]"
      onMouseDown={() => setOmnibox(false)}>
      <div className="card w-full max-w-xl overflow-hidden fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 border-b border-[var(--line)]">
          <Search size={16} className="text-[var(--ink-3)]" />
          <input
            ref={input}
            className="flex-1 bg-transparent py-3 font-ui text-[15px] outline-none text-[var(--ink)]"
            placeholder="Hledat stránky, postavy, kouzla, netvory…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOmnibox(false);
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === "Enter" && flat[sel]) go(flat[sel].url);
            }}
          />
          {busy && <span className="text-xs text-[var(--ink-3)] font-ui">…</span>}
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-1.5">
          {Object.entries(hits).map(([group, items]) => (
            <div key={group} className="mb-1">
              <div className="px-2 pt-2 pb-1 text-[10px] font-ui font-bold uppercase tracking-wider text-[var(--ink-3)]">
                {group}
              </div>
              {items.map((h) => {
                const idx = flat.indexOf(h);
                return (
                  <button
                    key={h.url + h.label}
                    className={`w-full text-left px-2.5 py-2 rounded-md font-ui flex items-baseline gap-2
                      ${idx === sel ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--panel-2)]"}`}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => go(h.url)}
                  >
                    <span className="text-sm text-[var(--ink)]">{h.label}</span>
                    <span className="text-[11px] text-[var(--ink-3)] truncate">{h.sub}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {q.length >= 2 && !busy && flat.length === 0 && (
            <div className="p-4 text-sm text-[var(--ink-3)] font-ui">Nic nenalezeno.</div>
          )}
          {q.length < 2 && (
            <div className="p-4 text-sm text-[var(--ink-3)] font-ui">
              Piš aspoň 2 znaky. Enter otevře první výsledek.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

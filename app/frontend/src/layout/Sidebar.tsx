import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Search, Clock } from "lucide-react";
import { useNav } from "../api";
import { useApp } from "../store";
import type { NavItem, NavSection } from "../types";

// ---------- nedávné stránky (localStorage) ----------

const RECENTS_KEY = "mont-recents";

export function pushRecent(path: string, title: string) {
  try {
    const list: { path: string; title: string }[] = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    const next = [{ path, title }, ...list.filter((r) => r.path !== path)].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function Recents() {
  const [items, setItems] = useState<{ path: string; title: string }[]>([]);
  const loc = useLocation();
  useEffect(() => {
    try { setItems(JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]")); }
    catch { setItems([]); }
  }, [loc.pathname]);
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-2 pt-1 pb-1 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)]">
        <Clock size={11} /> Nedávné
      </div>
      {items.map((r) => (
        <Link key={r.path} to={`/p/${encodeURI(r.path.replace(/\.md$/, ""))}`}
          className="block px-2 py-1 rounded-md font-ui text-[13px] text-[var(--ink-2)] hover:bg-[var(--panel-2)] hover:no-underline truncate"
          style={{ paddingLeft: 22 }}>
          {r.title}
        </Link>
      ))}
    </div>
  );
}

// ---------- strom ----------

function matches(item: NavItem, q: string): boolean {
  if (!q) return true;
  const n = q.toLocaleLowerCase("cs");
  if (item.title.toLocaleLowerCase("cs").includes(n)) return true;
  return (item.children || []).some((c) => matches(c, q));
}

function containsActive(item: NavItem, pathname: string): boolean {
  if (item.url && pathname === item.url) return true;
  return (item.children || []).some((c) => containsActive(c, pathname));
}

function Item({ item, depth }: { item: NavItem; depth: number }) {
  const loc = useLocation();
  const active = item.url && (loc.pathname === item.url || loc.pathname === item.url + "/");
  const hasKids = !!item.children?.length;
  const [open, setOpen] = useState(() => containsActive(item, loc.pathname));

  useEffect(() => {
    if (containsActive(item, loc.pathname)) setOpen(true);
  }, [loc.pathname]);

  if (hasKids) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left font-ui text-[13px]
            ${open ? "text-[var(--ink)]" : "text-[var(--ink-2)]"} hover:bg-[var(--accent-soft)]`}
          style={{ paddingLeft: 6 + depth * 13 }}
        >
          <ChevronRight size={12} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="truncate font-medium">{item.title}</span>
          <span className="ml-auto text-[10px] text-[var(--ink-3)]">{item.children!.length}</span>
        </button>
        {open && (
          <div>
            {item.children!.map((c, i) => (
              <Item key={c.id || c.path || i} item={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }
  const href = item.url || "#";
  return (
    <Link
      to={href}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-ui text-[13px] hover:no-underline
        ${active
          ? "bg-[var(--accent-soft)] text-[var(--accent-2)] font-semibold"
          : "text-[var(--ink-2)] hover:bg-[var(--panel-2)]"}`}
      style={{ paddingLeft: 6 + depth * 13 + 14 }}
      title={item.title}
    >
      <span className="truncate">{item.title}</span>
      {item.secret && <span className="ml-auto text-[10px]">🔒</span>}
    </Link>
  );
}

export default function Sidebar() {
  const { user } = useApp();
  const nav = useNav(!!user);
  const [q, setQ] = useState("");
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({ svet: true });
  const loc = useLocation();

  const sections = useMemo(() => {
    const s = nav.data?.sections || [];
    if (!q) return s;
    return s
      .map((sec: NavSection) => ({
        ...sec,
        children: (sec.children || []).filter((c) => matches(c, q)),
      }))
      .filter((sec) => !sec.children || sec.children.length > 0 || sec.url);
  }, [nav.data, q]);

  // automaticky otevři sekci obsahující aktivní stránku
  useEffect(() => {
    for (const sec of nav.data?.sections || []) {
      if ((sec.children || []).some((c) => containsActive(c, loc.pathname))) {
        setOpenSec((s) => (s[sec.id] ? s : { ...s, [sec.id]: true }));
      }
    }
  }, [loc.pathname, nav.data]);

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--line)] bg-[var(--bg-2)] flex flex-col min-h-0">
      <div className="p-2 border-b border-[var(--line)]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--ink-3)]" />
          <input
            className="input !pl-8 !py-1.5 !text-[13px]"
            placeholder="Filtrovat menu…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {!q && <Recents />}
        {sections.map((sec) => {
          const expandable = !sec.url && !!sec.children?.length;
          const isOpen = q ? true : openSec[sec.id];
          return (
            <div key={sec.id} className="mb-1">
              <div className="flex items-center">
                {sec.url ? (
                  <Link
                    to={sec.url}
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md font-ui text-[13px] font-bold hover:no-underline uppercase tracking-wider hover:bg-[var(--accent-soft)]
                      ${loc.pathname === sec.url ? "text-[var(--accent-2)]" : "text-[var(--ink)]"}`}
                  >
                    {sec.title}
                  </Link>
                ) : (
                  <button
                    onClick={() => setOpenSec((s) => ({ ...s, [sec.id]: !s[sec.id] }))}
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md font-ui text-[13px] font-bold text-left uppercase tracking-wider hover:bg-[var(--accent-soft)]
                      ${isOpen ? "text-[var(--ink)]" : "text-[var(--ink-3)]"}`}
                  >
                    {sec.title}
                    <ChevronRight size={12} className={`ml-auto transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                )}
              </div>
              {(isOpen || !expandable) && (sec.children || []).map((item) => (
                <Item key={item.id || item.path || item.title} item={item} depth={0} />
              ))}
            </div>
          );
        })}
        {nav.isLoading && <div className="p-3 text-sm text-[var(--ink-3)] font-ui">Načítám menu…</div>}
      </nav>
    </aside>
  );
}

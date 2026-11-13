import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Castle, Search, PanelLeft, SunMoon, Eye, LogOut, ChevronDown, User as UserIcon, Plus,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { logout, useNav } from "../api";
import { isEditor, useApp, useTheme, THEME_LABELS, MODE_LABELS, type Theme, type Mode } from "../store";
import NewEntityDialog from "../components/NewEntityDialog";
import type { NavSection } from "../types";

/* hlavní kategorie v horní liště – pořadí a cíl kliknutí */
const TOP: { id: string; to: string }[] = [
  { id: "mapa", to: "/mapa" },
  { id: "svet", to: "/k/svet" },
  { id: "hra", to: "/k/hra" },
  { id: "znalosti", to: "/k/znalosti" },
  { id: "sprava", to: "/k/sprava" },
];

function NavMenu({ sec, onClose }: { sec: NavSection; onClose: () => void }) {
  const kids = sec.children || [];
  return (
    <div className="topnav-menu" onMouseLeave={onClose}>
      {kids.map((c, i) => {
        const sub = c.children || [];
        if (sub.length) {
          return (
            <div key={c.id || i} className="grp">
              {c.url
                ? <Link to={c.url} className="grp-link" onClick={onClose}>{c.title}</Link>
                : c.title}
              {sub.slice(0, 14).map((g, j) => (
                <Link key={g.id || j} to={g.url || "#"} className="sub" onClick={onClose}>
                  {g.title}
                </Link>
              ))}
              {sub.length > 14 && (
                <Link to={`/k/${sec.id}`} className="sub" onClick={onClose}>
                  vše ({sub.length}) →
                </Link>
              )}
            </div>
          );
        }
        return (
          <Link key={c.id || i} to={c.url || "#"} onClick={onClose}>
            {c.title}
          </Link>
        );
      })}
      {!kids.length && (
        <Link to={sec.url || `/k/${sec.id}`} onClick={onClose}>Otevřít {sec.title}</Link>
      )}
    </div>
  );
}

export default function TopBar() {
  const { user, setUser, setOmnibox, previewPlayer, togglePreview, setSidebar, sidebarOpen } = useApp();
  const { theme, mode, setTheme, setMode } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const [menu, setMenu] = useState<"" | "theme" | "user">("");
  const [openCat, setOpenCat] = useState("");
  const [newEntity, setNewEntity] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeT = useRef<number>(0);

  const navQ = useNav(!!user);
  const secs = navQ.data?.sections || [];
  const byId = Object.fromEntries(secs.map((s) => [s.id, s]));

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenu(""); setOpenCat("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => { setOpenCat(""); }, [loc.pathname]);

  const open = (id: string) => { window.clearTimeout(closeT.current); setOpenCat(id); };
  const close = () => { closeT.current = window.setTimeout(() => setOpenCat(""), 180); };

  const editor = isEditor(user);
  const active = loc.pathname === "/mapa" ? "mapa"
    : loc.pathname.startsWith("/kampane") || loc.pathname.startsWith("/boj") ? "hra"
    : loc.pathname.startsWith("/k/") ? loc.pathname.slice(3) : "";

  return (
    <header className="shrink-0 flex items-center gap-1 px-3 border-b-2 border-[var(--accent)] bg-[var(--panel)] z-40 relative"
      style={{ height: 52 }} ref={ref}>
      <button className="btn btn-ghost !px-2" onClick={() => setSidebar(!sidebarOpen)} aria-label="Menu">
        <PanelLeft size={18} />
      </button>
      <Link to="/" className="flex items-center gap-2 mr-3 hover:no-underline">
        <Castle size={20} className="text-[var(--accent)]" />
        <span style={{ fontFamily: "var(--font-head)", letterSpacing: ".08em" }}
          className="font-bold text-[var(--ink)]">MONTELIEN</span>
      </Link>

      {/* hlavní kategorie – hover menu, klik → uvítací stránka */}
      <nav className="topnav hidden md:flex items-stretch self-stretch" aria-label="Hlavní kategorie">
        {TOP.filter((t) => t.id !== "sprava" || editor).map((t) => {
          const sec = byId[t.id];
          if (!sec) return null;
          return (
            <div key={t.id} className="relative flex"
              onMouseEnter={() => open(t.id)} onMouseLeave={close}>
              <Link
                to={t.to}
                className={`topnav-link flex items-center ${active === t.id ? "on" : ""}`}
              >
                {sec.title}
                {(sec.children?.length ?? 0) > 0 &&
                  <ChevronDown size={13} className="ml-1 opacity-60" />}
              </Link>
              {openCat === t.id && (sec.children?.length ?? 0) > 0 &&
                <NavMenu sec={sec} onClose={() => setOpenCat("")} />}
            </div>
          );
        })}
      </nav>

      <button
        className="input !w-auto flex-1 max-w-md text-left flex items-center gap-2 !py-1.5 cursor-pointer ml-auto"
        onClick={() => setOmnibox(true)}
      >
        <Search size={15} className="text-[var(--ink-3)]" />
        <span className="text-[var(--ink-3)]">Hledat…</span>
        <kbd className="ml-auto text-[10px] text-[var(--ink-3)] border border-[var(--line)] rounded px-1">Ctrl K</kbd>
      </button>

      {editor && (
        <button className="btn btn-ghost !px-2" title="Nová entita" onClick={() => setNewEntity(true)}>
          <Plus size={17} />
        </button>
      )}
      {(user?.role === "admin") && (
        <button className="btn btn-ghost !px-2" title={previewPlayer ? "Náhled: hráč" : "Náhled: DM"}
          onClick={togglePreview}>
          <Eye size={17} className={previewPlayer ? "text-[var(--accent)]" : ""} />
        </button>
      )}

      {/* vzhled */}
      <div className="relative">
        <button className="btn btn-ghost !px-2" onClick={() => setMenu(menu === "theme" ? "" : "theme")} title="Vzhled">
          <SunMoon size={17} />
        </button>
        {menu === "theme" && (
          <div className="topnav-menu right-0 left-auto" style={{ minWidth: 170 }}>
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <a key={m} href="#" onClick={(e) => { e.preventDefault(); setMode(m); }}
                className={mode === m ? "!text-[var(--accent)]" : ""}>{MODE_LABELS[m]}</a>
            ))}
            <div className="grp">Motiv</div>
            {Object.keys(THEME_LABELS).map((t) => (
              <a key={t} href="#" onClick={(e) => { e.preventDefault(); setTheme(t as Theme); }}
                className={theme === t ? "!text-[var(--accent)]" : ""}>{THEME_LABELS[t as Theme]}</a>
            ))}
          </div>
        )}
      </div>

      {/* uživatel */}
      <div className="relative">
        <button className="btn btn-ghost !px-2 flex items-center gap-1"
          onClick={() => setMenu(menu === "user" ? "" : "user")}>
          <UserIcon size={17} />
          <span className="text-xs hidden lg:inline">{user?.name}</span>
        </button>
        {menu === "user" && (
          <div className="topnav-menu right-0 left-auto" style={{ minWidth: 150 }}>
            <div className="grp">{user?.name} · {user?.role}</div>
            <a href="#" onClick={async (e) => {
              e.preventDefault();
              await logout(); qc.clear(); setUser(null); nav("/login");
            }}>
              <LogOut size={13} className="inline mr-1" /> Odhlásit
            </a>
          </div>
        )}
      </div>
      {newEntity && <NewEntityDialog onClose={() => setNewEntity(false)} />}
    </header>
  );
}

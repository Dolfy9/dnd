import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import { useApp } from "../store";

/* Jeden scroller na stránku = <main>. Pozice se ukládá per history key:
   PUSH na jinou cestu → nahoru; POP (zpět/vpřed) → obnovit pozici;
   změna jen query/tab (stejné pathname) → pozice zůstane. */
export default function AppShell() {
  const sidebarOpen = useApp((s) => s.sidebarOpen);
  const setSidebar = useApp((s) => s.setSidebar);
  const mainRef = useRef<HTMLElement>(null);
  const positions = useRef(new Map<string, number>());
  const lastPath = useRef("");
  const loc = useLocation();
  const navType = useNavigationType();

  // průběžně si pamatovat scrollTop pro aktuální history key
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const save = () => positions.current.set(loc.key, el.scrollTop);
    el.addEventListener("scroll", save, { passive: true });
    return () => el.removeEventListener("scroll", save);
  }, [loc.key]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const samePath = lastPath.current === loc.pathname;
    lastPath.current = loc.pathname;
    if (samePath) return;                    // jen query/tab → nepřeskakovat
    const saved = positions.current.get(loc.key);
    el.scrollTop = navType === "POP" && saved != null ? saved : 0;
  }, [loc.key, loc.pathname, navType]);

  // mobilní drawer: Esc + navigace zavřou
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebar(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSidebar]);
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebar(false);
  }, [loc.pathname, setSidebar]);

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        {/* sidebar: ≥1024 inline sloupec, <1024 off-canvas drawer */}
        <div className={"sb-wrap" + (sidebarOpen ? " open" : "")}>
          <div className="sb-backdrop" onClick={() => setSidebar(false)} aria-hidden="true" />
          {sidebarOpen && <Sidebar />}
        </div>
        <main ref={mainRef} className="app-main flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

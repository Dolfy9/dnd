import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useMe } from "./api";
import { useApp, isEditor } from "./store";
import AppShell from "./layout/AppShell";
import MusicPlayer from "./components/MusicPlayer";
import Heraldika from "./pages/Heraldika";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PageView from "./pages/PageView";
import Catalog from "./pages/Catalog";
import Omnibox from "./components/Omnibox";
import { AdminUsers, AdminAudit, AdminSystem } from "./pages/Admin";
import Mapa from "./pages/Mapa";
import Boj from "./pages/Boj";
import Boje from "./pages/Boje";
import Kampane from "./pages/Kampane";
import KampanDetail from "./pages/KampanDetail";
import { MusicPage, GraphPage, ZnalostiPage } from "./pages/Placeholders";
import Category from "./pages/Category";

export default function App() {
  const me = useMe();
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const setOmnibox = useApp((s) => s.setOmnibox);
  const loc = useLocation();

  useEffect(() => {
    if (me.data !== undefined) setUser(me.data);
  }, [me.data, setUser]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOmnibox(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOmnibox]);

  if (me.isLoading) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-[var(--ink-3)] font-ui text-sm">Načítám Montelien…</div>
      </div>
    );
  }

  if (!user && loc.pathname !== "/login") {
    return <Login />;
  }

  const editor = isEditor(user);

  return (
    <>
      <Omnibox />
      <MusicPlayer />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="/p/*" element={<PageView />} />
          <Route path="/katalog/:kind" element={<Catalog />} />
          <Route path="/editor" element={<Dashboard />} />
          <Route path="/pravidla" element={<ZnalostiPage />} />
          <Route path="/znalosti" element={<ZnalostiPage />} />
          <Route path="/k/:sec" element={<Category />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/boj" element={<Boj />} />
          <Route path="/boje" element={<Boje />} />
          <Route path="/kampane" element={<Kampane />} />
          <Route path="/kampane/*" element={<KampanDetail />} />
          <Route path="/hudba" element={<MusicPage />} />
          <Route path="/heraldika" element={<Heraldika />} />
          <Route path="/graf" element={<GraphPage />} />
          <Route path="/sprava/navrhy" element={<Dashboard />} />
          <Route path="/sprava/uzivatele" element={editor ? <AdminUsers /> : <Dashboard />} />
          <Route path="/sprava/audit" element={editor ? <AdminAudit /> : <Dashboard />} />
          <Route path="/sprava/system" element={editor ? <AdminSystem /> : <Dashboard />} />
          <Route path="*" element={<PageView />} />
        </Route>
      </Routes>
    </>
  );
}

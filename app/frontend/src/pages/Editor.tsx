import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, put, del } from "../api";
import type { PageData } from "../types";

export default function Editor() {
  const [sp] = useSearchParams();
  const path = sp.get("path") || "";
  const nav = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const page = useQuery({
    queryKey: ["editor", path],
    queryFn: () => get<PageData>(`/api/page?path=${encodeURIComponent(path)}&raw=1`),
    enabled: !!path,
  });

  useEffect(() => {
    if (page.data?.raw != null && !dirty) setText(page.data.raw);
  }, [page.data, dirty]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await put(`/api/page?path=${encodeURIComponent(path)}`, { full: text });
      setDirty(false);
      setMsg("Uloženo ✓");
      qc.invalidateQueries({ queryKey: ["page", path] });
      qc.invalidateQueries({ queryKey: ["nav"] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Uložení selhalo");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Opravdu smazat ${path}? Soubor se smaže z repozitáře.`)) return;
    setBusy(true);
    try {
      await del(`/api/page?path=${encodeURIComponent(path)}`);
      qc.invalidateQueries({ queryKey: ["nav"] });
      nav("/");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Smazání selhalo");
      setBusy(false);
    }
  };

  if (!path) return <div className="p-8 font-ui text-sm text-[var(--ink-3)]">Chybí ?path=.</div>;
  if (page.isLoading) return <div className="p-8 font-ui text-sm text-[var(--ink-3)]">Načítám…</div>;
  if (page.error) return <div className="p-8 font-ui text-sm text-red-400">{page.error.message}</div>;

  const url = "/p/" + encodeURI(path.replace(/\.md$/, ""));

  return (
    <div className="h-full flex flex-col p-4 gap-2">
      <div className="flex items-center gap-2 font-ui text-sm flex-wrap">
        <Link to={url} className="btn !text-xs !py-1">← Zpět na stránku</Link>
        <span className="text-[var(--ink-3)] text-xs truncate">{path}</span>
        {dirty && <span className="chip chip-accent">neuloženo</span>}
        <span className="ml-auto flex gap-2 items-center">
          {msg && <span className={`text-xs ${msg.includes("✓") ? "text-emerald-500" : "text-red-400"}`}>{msg}</span>}
          <button className="btn !text-xs !py-1" onClick={() => { setText(page.data?.raw || ""); setDirty(false); }}
            disabled={!dirty}>Zahodit změny</button>
          <button className="btn btn-danger !text-xs !py-1" onClick={remove} disabled={busy}>Smazat</button>
          <button className="btn btn-primary !text-xs !py-1" onClick={save} disabled={busy || !dirty}>
            {busy ? "Ukládám…" : "Uložit"}
          </button>
        </span>
      </div>
      <textarea
        className="input flex-1 font-mono !text-[13px] leading-relaxed resize-none"
        spellCheck={false}
        value={text}
        onChange={(e) => { setText(e.target.value); setDirty(true); setMsg(""); }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
        }}
      />
      <div className="font-ui text-[11px] text-[var(--ink-3)]">
        Markdown včetně YAML frontmatter. Sekce „## Pro DM (tajné)“ se hráčům nezobrazí. Ctrl+S = uložit.
      </div>
    </div>
  );
}

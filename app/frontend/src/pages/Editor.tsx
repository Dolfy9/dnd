import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bold, Italic, Heading2, Heading3, Link2, List, Quote,
  EyeOff, FileBadge, Save, Trash2, Undo2,
} from "lucide-react";
import { get, put, del, post } from "../api";
import type { PageData } from "../types";
import Markdown from "../components/Markdown";
import { confirmDialog, toast } from "../components/ui";

const stripFront = (t: string) => t.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

export default function Editor() {
  const splat = useParams()["*"] || "";
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const path = (() => {
    let p = decodeURIComponent(splat).replace(/^\/+|\/+$/g, "");
    if (!p) p = sp.get("path") || "";
    if (p && !p.toLowerCase().endsWith(".md")) p += ".md";
    return p;
  })();

  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState("");
  const dirty = text !== loaded;
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"text" | "nahled" | "oboji">(
    () => (typeof window !== "undefined" && window.innerWidth >= 1100 ? "oboji" : "text"));
  const [preview, setPreview] = useState("");

  const page = useQuery({
    queryKey: ["editor", path],
    queryFn: () => get<PageData>(`/api/page?path=${encodeURIComponent(path)}&raw=1`),
    enabled: !!path,
    retry: false,
  });

  useEffect(() => {
    if (page.data?.raw != null) { setText(page.data.raw); setLoaded(page.data.raw); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.data?.path]);

  // živý náhled (debounce ~400 ms, bez frontmatter)
  useEffect(() => {
    if (view === "text") return;
    const t = setTimeout(async () => {
      try {
        const r = await post<{ html: string }>("/api/page/preview", { path, body: stripFront(text) });
        setPreview(r.html);
      } catch { /* náhled se přeskočí */ }
    }, 400);
    return () => clearTimeout(t);
  }, [text, view, path]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["page", path] });
    qc.invalidateQueries({ queryKey: ["nav"] });
    qc.invalidateQueries({ queryKey: ["entity-index"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
  }, [qc, path]);

  const save = useCallback(async () => {
    if (!dirty || busy) return;
    setBusy(true);
    try {
      await put(`/api/page?path=${encodeURIComponent(path)}`, { full: text });
      setLoaded(text);
      invalidate();
      toast("Uloženo.", "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Uložení selhalo", "err");
    } finally { setBusy(false); }
  }, [dirty, busy, path, text, invalidate]);

  const guard = async (what: string) =>
    !dirty || await confirmDialog({
      title: "Neuložené změny",
      text: `Máš neuložené změny – ${what} je zahodí. Pokračovat?`,
      okLabel: "Zahodit změny", danger: true,
    });

  const back = async () => { if (await guard("návrat na stránku")) nav(url); };

  const discard = async () => {
    if (await guard("zahození změn")) setText(loaded);
  };

  const remove = async () => {
    if (!await confirmDialog({
      title: "Smazat stránku",
      text: `Opravdu smazat ${path}? Soubor se smaže z repozitáře.`,
      okLabel: "Smazat", danger: true,
    })) return;
    setBusy(true);
    try {
      await del(`/api/page?path=${encodeURIComponent(path)}`);
      qc.invalidateQueries({ queryKey: ["nav"] });
      toast("Stránka smazána.", "ok");
      const dir = path.includes("/") ? path.split("/").slice(0, -1).join("/") : "";
      nav(dir ? "/p/" + encodeURI(dir) : "/");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Smazání selhalo", "err");
      setBusy(false);
    }
  };

  // ---------- formátovací lišta ----------
  const wrap = (pre: string, post = pre, placeholder = "text") => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = text.slice(s, e) || placeholder;
    const next = text.slice(0, s) + pre + sel + post + text.slice(e);
    setText(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + pre.length, s + pre.length + sel.length); });
  };
  const linePrefix = (pfx: string) => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const start = text.lastIndexOf("\n", s - 1) + 1;
    const next = text.slice(0, start) + pfx + text.slice(start);
    setText(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + pfx.length, e + pfx.length); });
  };
  const link = () => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = text.slice(s, e) || "text odkazu";
    const next = text.slice(0, s) + `[${sel}](` + text.slice(e) + ")";
    const urlPos = s + sel.length + 3;
    setText(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(urlPos, urlPos); });
  };
  const dmSection = () => {
    if (/^## Pro DM/m.test(text)) { toast("Sekce Pro DM už existuje.", "info"); return; }
    setText(text.replace(/\s*$/, "") + "\n\n## Pro DM (tajné)\n\n");
  };
  const stavNavrh = () => {
    if (/^\s*>\s*\*\*Stav:\*\*/m.test(text)) { toast("Stav už je uveden.", "info"); return; }
    const lines = text.split("\n");
    const h1 = lines.findIndex((l) => /^#\s/.test(l));
    lines.splice(h1 >= 0 ? h1 + 1 : 0, 0, "", "> **Stav:** návrh");
    setText(lines.join("\n"));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === "s") { e.preventDefault(); save(); }
    else if (k === "b") { e.preventDefault(); wrap("**"); }
    else if (k === "i") { e.preventDefault(); wrap("*"); }
  };

  if (!path) return <Navigate to="/" replace />;
  const url = "/p/" + encodeURI(path.replace(/\.md$/, ""));
  const title = page.data?.title || path.split("/").pop()!.replace(/\.md$/, "").replace(/_/g, " ");

  return (
    <div className="h-full flex flex-col">
      {/* horní lišta */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--line)] flex-wrap font-ui">
        <button className="btn btn-ghost !px-2" onClick={back} title="Zpět na stránku">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{title}</div>
          <div className="text-[11px] text-[var(--ink-3)] truncate">{path}</div>
        </div>
        {dirty && <span className="chip chip-accent !text-[11px]">neuloženo</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn sm" onClick={discard} disabled={!dirty || busy} title="Zahodit změny">
            <Undo2 size={14} /> Zahodit změny
          </button>
          <button className="btn btn-danger sm" onClick={remove} disabled={busy} title="Smazat stránku">
            <Trash2 size={14} /> Smazat
          </button>
          <button className="btn btn-primary sm" onClick={save} disabled={busy || !dirty}>
            <Save size={14} /> {busy ? "Ukládám…" : "Uložit"}
          </button>
        </div>
      </div>

      {/* nástroje + přepínač pohledu */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[var(--line)] font-ui flex-wrap">
        <Tb onClick={() => wrap("**")} title="Tučně (Ctrl+B)"><Bold size={14} /></Tb>
        <Tb onClick={() => wrap("*")} title="Kurzíva (Ctrl+I)"><Italic size={14} /></Tb>
        <Tb onClick={() => linePrefix("## ")} title="Nadpis 2"><Heading2 size={14} /></Tb>
        <Tb onClick={() => linePrefix("### ")} title="Nadpis 3"><Heading3 size={14} /></Tb>
        <Tb onClick={link} title="Odkaz"><Link2 size={14} /></Tb>
        <Tb onClick={() => linePrefix("- ")} title="Seznam"><List size={14} /></Tb>
        <Tb onClick={() => linePrefix("> ")} title="Citace"><Quote size={14} /></Tb>
        <span className="w-px h-4 bg-[var(--line)] mx-1" />
        <Tb onClick={dmSection} title="Přidat sekci „## Pro DM (tajné)“"><EyeOff size={14} /> Pro DM</Tb>
        <Tb onClick={stavNavrh} title="Vložit „> **Stav:** návrh“"><FileBadge size={14} /> Stav: návrh</Tb>
        <span className="ml-auto flex rounded-md border border-[var(--line)] overflow-hidden">
          {([["text", "Text"], ["nahled", "Náhled"], ["oboji", "Obojí"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={"px-2.5 py-1 text-xs font-ui " + (view === v ? "bg-[var(--accent-soft)] text-[var(--accent-2)] font-bold" : "text-[var(--ink-3)] hover:bg-[var(--panel-2)]")}>
              {l}
            </button>
          ))}
        </span>
      </div>

      {page.isLoading && <div className="p-8 font-ui text-sm text-[var(--ink-3)]">Načítám…</div>}
      {page.error && <div className="p-8 font-ui text-sm text-red-400">{page.error.message}</div>}

      {!page.isLoading && !page.error && (
        <div className={"flex-1 min-h-0 flex ed-split view-" + view}>
          {view !== "nahled" && (
            <textarea
              ref={taRef}
              className="input flex-1 !rounded-none !border-0 !border-r !border-[var(--line)] font-mono !text-[13px] leading-relaxed resize-none !bg-transparent focus:!border-[var(--line)]"
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
            />
          )}
          {view !== "text" && (
            <div className="ed-preview flex-1 min-w-0 overflow-y-auto px-6 py-4">
              <Markdown html={preview} />
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-1.5 border-t border-[var(--line)] font-ui text-[11px] text-[var(--ink-3)]">
        Markdown včetně YAML frontmatter. Sekce „## Pro DM (tajné)“ se hráčům nezobrazí. Ctrl+S uložit, Ctrl+B/Ctrl+I tučně/kurzíva.
      </div>
    </div>
  );
}

function Tb({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button type="button" className="btn btn-ghost !px-2 !py-1 !text-xs flex items-center gap-1"
      onClick={onClick} title={title}>
      {children}
    </button>
  );
}

// přesměrování staré adresy /editor?path=… → /upravit/…
export function EditorRedirect() {
  const [sp] = useSearchParams();
  const p = sp.get("path") || "";
  return <Navigate to={p ? `/upravit/${encodeURI(p.replace(/\.md$/, ""))}` : "/"} replace />;
}

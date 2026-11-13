import { Link } from "react-router-dom";
import { put } from "../api";
import { isEditor, useApp } from "../store";
import type { PageData } from "../types";

const PRED_LABELS: Record<string, string> = {
  v_zemi: "Země", v_meste: "Město", ve_frakci: "Frakce", v_kampani: "Kampaň",
  vlastni: "Vlastní", zamestnava: "Zaměstnavatel", umi_kouzlo: "Kouzla",
  je_druhu: "Druh", ma_pozadi: "Pozadí",
};

function LinkList({ items }: { items: { title?: string; name?: string; url: string; type?: string }[] }) {
  return (
    <ul className="space-y-1">
      {items.map((b, i) => (
        <li key={i}>
          <Link to={b.url} className="text-[13px] font-ui">
            {b.title || b.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const SKIP_KEYS = new Set(["jmeno", "nazev", "stitky", "portret", "obrazek", "overeno"]);

function fmtVal(v: unknown): string {
  if (Array.isArray(v)) {
    if (!v.length) return "";
    return v.map((x) => (x && typeof x === "object" ? ((x as Record<string, unknown>).nazev ?? JSON.stringify(x)) : String(x))).join(", ");
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.entries(o).filter(([, x]) => x !== "" && x != null).map(([k, x]) => `${k}: ${x}`).join(", ");
  }
  return String(v ?? "");
}

function pathToUrl(p: string) {
  return "/p/" + encodeURI(p.replace(/\.md$/, ""));
}

function DataRows({ data }: { data: Record<string, unknown> }) {
  const rows = Object.entries(data)
    .filter(([k, v]) => !SKIP_KEYS.has(k) && v !== "" && v != null && !(Array.isArray(v) && !v.length))
    .slice(0, 14);
  if (!rows.length) return null;
  return (
    <div className="mt-3 pt-2 border-t border-[var(--line)] space-y-1 text-[12px]">
      {rows.map(([k, v]) => {
        const isPath = typeof v === "string" && v.endsWith(".md") && v.includes("/");
        return (
          <div key={k} className="flex gap-1.5">
            <span className="text-[var(--ink-3)] shrink-0">{k.replace(/_/g, " ")}:</span>
            {isPath
              ? <Link to={pathToUrl(String(v))} className="truncate">{String(v).split("/").pop()!.replace(/\.md$/, "").replace(/_/g, " ")}</Link>
              : <span className="truncate" title={fmtVal(v)}>{fmtVal(v)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function RightRail({ page }: { page: PageData }) {
  const { user } = useApp();
  const editor = isEditor(user);
  const e = page.entity;
  const bl = page.backlinks;
  const hasRels = e && (e.vazby_out.length + e.vazby_in.length > 0);
  const hasRail = e || bl.odkazy.length || bl.vazby.length || bl.zminky.length || page.toc.length > 1;

  if (!hasRail) return null;

  return (
    <aside className="hidden xl:block w-80 shrink-0 border-l border-[var(--line)] overflow-y-auto p-4 space-y-4 font-ui">
      {e && (
        <div className="card p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1">
            {e.type_label}
          </div>
          <div className="flex gap-3">
            {e.portret ? (
              <img src={`/repo/${e.portret}`} alt={e.name}
                className="w-16 h-16 object-cover rounded-lg border border-[var(--line)]" />
            ) : null}
            {editor && (
              <label className="btn sm self-start cursor-pointer" title="Nahrát portrét">
                ⤒
                <input type="file" accept="image/*" className="hidden" onChange={async (ev) => {
                  const f = ev.target.files?.[0]; if (!f) return;
                  const dir = `${(e.data as any)?.soubor_dir || ""}`;
                  const target = e.type === "postava" ? "04_Postavy/obrazky"
                    : `${(page.path.split("/").slice(0, -1).join("/")) || "11_Mapy"}/obrazky`;
                  const fd = new FormData(); fd.append("file", f);
                  const r = await fetch(`/api/media/upload?dir=${encodeURIComponent(target)}`, { method: "POST", body: fd });
                  const j = await r.json();
                  if (!r.ok) return alert(j.detail || "upload selhal");
                  await put(`/api/entities/${e.id}`, { data: { ...e.data, portret: j.path } });
                  location.reload();
                }} />
              </label>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{e.name}</div>
              {!!e.tags.length && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {e.tags.slice(0, 6).map((t) => <span key={t} className="chip">{t}</span>)}
                </div>
              )}
            </div>
          </div>
          <DataRows data={e.data} />
          {hasRels && (
            <div className="mt-3 space-y-1.5 text-[13px]">
              {e.vazby_out.map((r, i) => (
                <div key={i} className="flex gap-1.5">
                  <span className="text-[var(--ink-3)] shrink-0">{PRED_LABELS[r.pred] || r.pred}:</span>
                  <Link to={r.url} className="truncate">{r.name}</Link>
                </div>
              ))}
              {e.vazby_in.map((r, i) => (
                <div key={i} className="flex gap-1.5">
                  <span className="text-[var(--ink-3)] shrink-0">← {PRED_LABELS[r.pred] || r.pred}:</span>
                  <Link to={r.url} className="truncate">{r.name}</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {page.toc.length > 1 && (
        <div className="card p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
            Na této stránce
          </div>
          <ul className="space-y-1">
            {page.toc.filter((t) => t.level <= 3).map((t) => (
              <li key={t.slug}>
                <a href={`#${t.slug}`} className="text-[13px] font-ui text-[var(--ink-2)]"
                  style={{ paddingLeft: (t.level - 1) * 10, display: "inline-block" }}>
                  {t.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!bl.vazby.length && (
        <div className="card p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
            Související ({bl.vazby.length})
          </div>
          <LinkList items={bl.vazby} />
        </div>
      )}
      {!!bl.odkazy.length && (
        <div className="card p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
            Odkazuje sem ({bl.odkazy.length})
          </div>
          <LinkList items={bl.odkazy.slice(0, 30)} />
          {bl.odkazy.length > 30 && <div className="text-xs text-[var(--ink-3)] mt-1">+{bl.odkazy.length - 30} dalších</div>}
        </div>
      )}
      {!!bl.zminky.length && (
        <div className="card p-3 border-dashed">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
            Nepropojené zmínky ({bl.zminky.length})
          </div>
          <LinkList items={bl.zminky.slice(0, 20)} />
          {bl.zminky.length > 20 && <div className="text-xs text-[var(--ink-3)] mt-1">+{bl.zminky.length - 20} dalších</div>}
        </div>
      )}
    </aside>
  );
}

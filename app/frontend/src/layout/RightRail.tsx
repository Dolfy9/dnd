import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Waypoints } from "lucide-react";
import { put, upload } from "../api";
import { toast } from "../components/ui";
import { isEditor, useApp } from "../store";
import type { PageData } from "../types";

const PRED_LABELS: Record<string, string> = {
  v_zemi: "Země", v_meste: "Město", ve_frakci: "Frakce", v_kampani: "Kampaň",
  vlastni: "Vlastní", zamestnava: "Zaměstnavatel", umi_kouzlo: "Kouzla",
  je_druhu: "Druh", ma_pozadi: "Pozadí",
};

const humanKey = (k: string) =>
  (k.replace(/_/g, " ").charAt(0).toUpperCase() + k.replace(/_/g, " ").slice(1));

function LinkList({ items }: { items: { title?: string; name?: string; url: string; type?: string }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <>
      <ul className="space-y-1">
        {shown.map((b, i) => (
          <li key={i}>
            <Link to={b.url} className="text-[13px] font-ui">
              {b.title || b.name}
            </Link>
          </li>
        ))}
      </ul>
      {items.length > 8 && (
        <button className="mt-1.5 text-[11px] text-[var(--accent-2)] hover:underline"
          onClick={() => setAll(!all)}>
          {all ? "Zobrazit méně" : `Zobrazit všech ${items.length}`}
        </button>
      )}
    </>
  );
}

const SKIP_KEYS = new Set(["jmeno", "nazev", "stitky", "portret", "obrazek", "overeno"]);

// {trida, uroven, podtrida} → "Fighter 12 (Champion)"
const fmtTrida = (o: Record<string, unknown>) =>
  [o.trida, o.uroven].filter((x) => x !== "" && x != null).join(" ")
    + (o.podtrida ? ` (${o.podtrida})` : "");

function fmtVal(v: unknown): string {
  if (Array.isArray(v)) {
    if (!v.length) return "";
    return v.map((x) => {
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        if ("trida" in o || "uroven" in o || "podtrida" in o) return fmtTrida(o);
        return Object.values(o).filter((y) => y !== "" && y != null).join(" ");
      }
      return String(x);
    }).filter(Boolean).join(v.every((x) => typeof x === "string") ? ", " : " / ");
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const vals = Object.values(o);
    // plochý objekt čísel (atributy) → "STR 18 · DEX 12 …"
    if (vals.length && vals.every((x) => typeof x === "number")) {
      return Object.entries(o)
        .map(([k, x]) => `${k.toUpperCase()} ${x}`).join(" · ");
    }
    return Object.values(o).filter((x) => x !== "" && x != null).join(" · ");
  }
  return String(v ?? "");
}

function pathToUrl(p: string) {
  return "/p/" + encodeURI(p.replace(/\.md$/, ""));
}

function DataRows({ data }: { data: Record<string, unknown> }) {
  const [all, setAll] = useState(false);
  const rows = Object.entries(data)
    .filter(([k, v]) => !SKIP_KEYS.has(k) && v !== "" && v != null && !(Array.isArray(v) && !v.length))
    .slice(0, 14);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, 10);
  return (
    <div className="mt-3 pt-2 border-t border-[var(--line)] space-y-1 text-[12px]">
      {shown.map(([k, v]) => {
        const isPath = typeof v === "string" && v.endsWith(".md") && v.includes("/");
        return (
          <div key={k} className="flex gap-1.5">
            <span className="text-[var(--ink-3)] shrink-0">{humanKey(k)}:</span>
            {isPath
              ? <Link to={pathToUrl(String(v))} className="truncate">{String(v).split("/").pop()!.replace(/\.md$/, "").replace(/_/g, " ")}</Link>
              : <span title={fmtVal(v)}>{fmtVal(v)}</span>}
          </div>
        );
      })}
      {rows.length > 10 && (
        <button className="text-[11px] text-[var(--accent-2)] hover:underline"
          onClick={() => setAll(!all)}>
          {all ? "Zobrazit méně" : `Zobrazit vše (${rows.length})`}
        </button>
      )}
    </div>
  );
}

function PortraitUpload({ page, e }: { page: PageData; e: NonNullable<PageData["entity"]> }) {
  const qc = useQueryClient();
  const doUpload = async (f: File) => {
    const target = e.type === "postava" ? "04_Postavy/obrazky"
      : `${(page.path.split("/").slice(0, -1).join("/")) || "11_Mapy"}/obrazky`;
    try {
      const j = await upload<{ path: string }>(`/api/media/upload?dir=${encodeURIComponent(target)}`, f, f.name);
      await put(`/api/entities/${e.id}`, { data: { ...e.data, portret: j.path } });
      qc.invalidateQueries({ queryKey: ["page"] });
      toast("Obrázek nahrán.", "ok");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload selhal", "err");
    }
  };
  return (
    <input type="file" accept="image/*" className="hidden"
      onChange={(ev) => {
        const f = ev.target.files?.[0];
        ev.target.value = "";
        if (f) doUpload(f);
      }} />
  );
}

export default function RightRail({ page, variant = "aside" }: {
  page: PageData; variant?: "aside" | "details";
}) {
  const { user } = useApp();
  const editor = isEditor(user);
  const e = page.entity;
  const bl = page.backlinks;
  const hasRels = e && (e.vazby_out.length + e.vazby_in.length > 0);
  const hasGraph = hasRels || !!bl.odkazy.length || !!bl.vazby.length;
  const hasRail = e || bl.odkazy.length || bl.vazby.length || bl.zminky.length || page.toc.length > 1;

  if (!hasRail) return null;

  const body = (<>
      {e && (
        <div className="card p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
            {e.type_label}
          </div>
          {e.portret ? (
            <div className="relative mb-2 -mx-1 -mt-1">
              <img src={`/repo/${e.portret}`} alt={e.name}
                className="w-full aspect-[3/4] max-h-60 object-cover rounded-lg border border-[var(--line)]" />
              {editor && (
                <label className="absolute bottom-1.5 right-1.5 btn sm cursor-pointer !py-0.5 !px-1.5"
                  title="Nahrát jiný obrázek">
                  <ImagePlus size={13} />
                  <PortraitUpload page={page} e={e} />
                </label>
              )}
            </div>
          ) : editor ? (
            <label className="mb-2 -mx-1 -mt-1 block border-2 border-dashed border-[var(--line-2)] rounded-lg
              aspect-[3/1] grid place-items-center cursor-pointer text-[var(--ink-3)]
              hover:border-[var(--accent)] hover:text-[var(--accent-2)] transition-colors"
              title="Nahrát obrázek">
              <span className="flex items-center gap-1.5 text-xs"><ImagePlus size={15} /> Nahrát obrázek</span>
              <PortraitUpload page={page} e={e} />
            </label>
          ) : null}
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{e.name}</div>
            {!!e.tags.length && (
              <div className="flex flex-wrap gap-1 mt-1">
                {e.tags.slice(0, 6).map((t) => <span key={t} className="chip">{t}</span>)}
              </div>
            )}
          </div>
          <DataRows data={e.data} />
          {hasGraph && (
            <Link to={`/graf?path=${encodeURIComponent(page.path)}`}
              className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--accent-2)] hover:underline">
              <Waypoints size={13} /> Graf vazeb
            </Link>
          )}
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
          <LinkList items={bl.odkazy} />
        </div>
      )}
      {!!bl.zminky.length && (
        <div className="card p-3 border-dashed">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
            Nepropojené zmínky ({bl.zminky.length})
          </div>
          <LinkList items={bl.zminky} />
        </div>
      )}
  </>);

  // <xl: rozbalitelná sekce pod obsahem stránky, ≥xl: pravý sloupec
  if (variant === "details") {
    return (
      <details className="rr-details card p-3 mt-6 font-ui xl:hidden">
        <summary className="font-semibold text-sm cursor-pointer select-none">Podrobnosti</summary>
        <div className="mt-3 space-y-4">{body}</div>
      </details>
    );
  }
  return (
    <aside className="hidden xl:block w-80 shrink-0 border-l border-[var(--line)] overflow-y-auto p-4 space-y-4 font-ui rr-aside">
      {body}
    </aside>
  );
}

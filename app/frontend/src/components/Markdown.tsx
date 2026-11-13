import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { get } from "../api";

interface Pop {
  x: number;
  y: number;
  kind: string;
  key: string;
}

function SrdPopover({ pop, onClose }: { pop: Pop; onClose: () => void }) {
  const [html, setHtml] = useState("Načítám…");
  useEffect(() => {
    let dead = false;
    get<{ name: string; data: Record<string, unknown> }>(
      `/api/rules/srd/${encodeURIComponent(pop.kind)}/${encodeURIComponent(pop.key)}`)
      .then((r) => {
        if (dead) return;
        const d = r.data as Record<string, unknown>;
        const rows = Object.entries(d)
          .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
          .slice(0, 20)
          .map(([k, v]) => `<div style="display:flex;gap:.5em"><b style="min-width:8em">${k}</b><span>${String(v)}</span></div>`)
          .join("");
        const text = typeof d.text === "string" ? `<p style="margin-top:.6em;white-space:pre-wrap">${d.text}</p>` : "";
        setHtml(`<h3 style="margin:0 0 .5em;font-size:1.1rem">${r.name}</h3>` + rows + text);
      })
      .catch((e) => !dead && setHtml(`<em>${e.message}</em>`));
    return () => { dead = true; };
  }, [pop]);

  return createPortal(
    <div className="srd-pop font-ui text-sm" style={{ left: pop.x, top: pop.y }} onMouseLeave={onClose}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>,
    document.body,
  );
}

export default function Markdown({ html, cols }: { html: string; cols?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const [pop, setPop] = useState<Pop | null>(null);

  const onClick = useCallback((e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (a.dataset.srd) {
      e.preventDefault();
      const [kind, key] = a.dataset.srd.split(":", 2);
      const r = a.getBoundingClientRect();
      setPop({ x: Math.min(r.left, window.innerWidth - 580), y: r.bottom + 6, kind, key });
      return;
    }
    if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/repo/")) {
      e.preventDefault();
      nav(href);
    }
  }, [nav]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("click", onClick);
    // stavové blockquoty ("> Stav: návrh/kánon") jsou interní poznámky – skrýt
    el.querySelectorAll("blockquote").forEach((bq) => {
      const t = bq.textContent?.trim() || "";
      if (/^Stav:/i.test(t)) bq.style.display = "none";
    });
    return () => el.removeEventListener("click", onClick);
  }, [html, onClick]);

  // při cols: každá h2-sekce je samostatný blok → sloupce se plní po celých sekcích
  const processed = cols
    ? html.split(/(?=<h2[\s>])/i).map((s) => s.trim()).filter(Boolean)
        .map((s) => `<div class="col-sec">${s}</div>`).join("")
    : html;

  return (
    <>
      <div ref={ref} className={"content" + (cols ? " cols" : "")} dangerouslySetInnerHTML={{ __html: processed }} />
      {pop && <SrdPopover pop={pop} onClose={() => setPop(null)} />}
    </>
  );
}

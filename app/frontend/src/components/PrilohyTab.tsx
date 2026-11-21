import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { upload, del, put } from "../api";
import { toast, confirmDialog } from "./ui";

const IKONA: Record<string, string> = {
  image: "🖼", pdf: "📄", audio: "🎵", video: "🎬", text: "📃", other: "📎",
};
function druhSouboru(p: any): string {
  const t = String(p.typ || "");
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf") return "pdf";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("text/")) return "text";
  return "other";
}
function velikost(n: any): string {
  const b = Number(n) || 0;
  if (b > 1 << 20) return (b / (1 << 20)).toFixed(1) + " MB";
  if (b > 1 << 10) return Math.round(b / 1024) + " kB";
  return b + " B";
}
const url = (p: any) => `/api/media/prilohy/${encodeURI(String(p.cesta || ""))}`;

/* Záložka Přílohy na kartě postavy — upload/list/náhled/mazání. */
export default function PrilohyTab({ ent, editor, playerMode, commit }: {
  ent: any; editor: boolean; playerMode?: boolean;
  commit: (next: any) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [light, setLight] = useState<any>(null);
  const prilohy: any[] = Array.isArray(ent?.data?.prilohy) ? ent.data.prilohy : [];
  const viditelne = prilohy.filter((p) => !p.tajne || (editor && !playerMode));

  const nahraj = async (files: FileList | File[]) => {
    if (!files.length || !ent?.path) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 50 * 1024 * 1024) { toast(`${f.name}: max 50 MB`, "err"); continue; }
        await upload(`/api/media/prilohy?entita=${encodeURIComponent(ent.path)}`, f, f.name);
      }
      toast("Příloha nahrána.", "ok");
      qc.invalidateQueries({ queryKey: ["page"] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload selhal", "err");
    }
    setBusy(false);
  };
  const smaz = async (p: any) => {
    if (!await confirmDialog({ title: "Smazat přílohu", text: p.nazev || p.cesta, okLabel: "Smazat", danger: true })) return;
    try {
      await del(`/api/media/prilohy?entita=${encodeURIComponent(ent.path)}&cesta=${encodeURIComponent(p.cesta)}`);
      toast("Příloha smazána.", "ok");
      qc.invalidateQueries({ queryKey: ["page"] });
    } catch (e) { toast(e instanceof Error ? e.message : "Smazání selhalo", "err"); }
  };
  const tajneToggle = (p: any) => {
    const data = JSON.parse(JSON.stringify(ent.data));
    data.prilohy = (data.prilohy || []).map((x: any) =>
      x.cesta === p.cesta ? { ...x, tajne: !x.tajne } : x);
    commit(data);
  };

  return (
    <div>
      {editor && (
        <div
          className={"pa-drop" + (drag ? " on" : "")}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); nahraj(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}>
          {busy ? "Nahrávám…" : "Přetáhni soubory sem nebo klikni pro výběr (max 50 MB)"}
          <input ref={fileRef} type="file" multiple hidden
            onChange={(e) => { nahraj(e.target.files || []); e.target.value = ""; }} />
        </div>
      )}
      {!viditelne.length && <p className="text-[13px] italic text-[var(--ink-3)]">Žádné přílohy.</p>}
      <div className="pa-grid">
        {viditelne.map((p, i) => {
          const d = druhSouboru(p);
          const inline = d === "image" || d === "pdf" || d === "audio" || d === "video";
          return (
            <div key={i} className="pa-item">
              <div className="pa-thumb" onClick={() => inline && d === "image" ? setLight(p) : undefined}>
                {d === "image"
                  ? <img src={url(p)} alt={p.nazev || ""} loading="lazy" />
                  : <span className="pa-ico">{IKONA[d]}</span>}
                {p.tajne && <em className="pa-tajne">tajné</em>}
              </div>
              <div className="pa-meta">
                <b title={p.cesta}>{p.nazev || String(p.cesta).split("/").pop()}</b>
                <small>{velikost(p.velikost)}{p.pridano ? ` · ${String(p.pridano).slice(0, 10)}` : ""} · {p.typ || "?"}</small>
              </div>
              {(d === "pdf" || d === "audio" || d === "video") && (
                <details className="pa-prev">
                  <summary>Náhled</summary>
                  {d === "pdf" && <iframe src={url(p)} title={p.nazev} />}
                  {d === "audio" && <audio controls src={url(p)} />}
                  {d === "video" && <video controls src={url(p)} />}
                </details>
              )}
              <div className="pa-actions">
                <a className="btn sm" href={url(p)} download={p.nazev || true}>Stáhnout</a>
                {editor && !playerMode && (
                  <button type="button" className={"btn sm" + (p.tajne ? " btn-primary" : "")}
                    title="Vidí jen editori (DM)" onClick={() => tajneToggle(p)}>
                    {p.tajne ? "🔒 tajné" : "🔓 veřejné"}
                  </button>
                )}
                {editor && <button type="button" className="btn sm cs-delb" onClick={() => smaz(p)}>Smazat</button>}
              </div>
            </div>
          );
        })}
      </div>
      {light && (
        <div className="pa-light" onClick={() => setLight(null)}>
          <img src={url(light)} alt={light.nazev || ""} />
        </div>
      )}
    </div>
  );
}

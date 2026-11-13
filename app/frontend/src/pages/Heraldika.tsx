import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { put, upload } from "../api";
import { isEditor, useApp } from "../store";

type Item = { id: string; nazev: string; soubor: string; znak?: string; znak_en?: string;
  vlajka?: string; vlajka_en?: string; proc?: string };

const imgDir = (it: Item) => it.soubor.substring(0, it.soubor.lastIndexOf("/") + 1) + "obrazky";
const imgFile = (it: Item, kind: "znak" | "vlajka") => (kind === "vlajka" ? "Vlajka_" : "Znak_") + it.id + ".webp";
const imgPath = (it: Item, kind: "znak" | "vlajka", ver = 0) =>
  `/repo/${imgDir(it)}/${imgFile(it, kind)}${ver ? "?t=" + ver : ""}`;
const pageUrl = (soubor: string) => "/p/" + soubor.replace(/\.md$/, "");

function toWebp(file: File): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? res(b) : rej(new Error("konverze selhala"))), "image/webp", 0.9);
    };
    img.onerror = () => rej(new Error("obrázek se nepodařilo načíst"));
    img.src = URL.createObjectURL(file);
  });
}

export default function Heraldika() {
  const { user } = useApp();
  const editable = isEditor(user);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"zeme" | "mesta">("zeme");
  const [sel, setSel] = useState<Item | null>(null);
  const [q, setQ] = useState("");
  const [ver, setVer] = useState(0);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<"znak" | "vlajka">("znak");

  useEffect(() => {
    fetch("/repo/web/docs/heraldika_index.json").then((r) => r.json()).then(setData).catch(() => setData({}));
  }, []);

  const open = (it: Item) => {
    setSel(it); setErr("");
    setFields({ znak: it.znak || "", znak_en: it.znak_en || "", vlajka: it.vlajka || "",
      vlajka_en: it.vlajka_en || "", proc: it.proc || "" });
  };

  const replaceImage = (kind: "znak" | "vlajka") => {
    pendingKind.current = kind;
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !sel) return;
    setBusy(true); setErr("");
    try {
      const blob = await toWebp(file);
      await upload(`/api/media/upload?dir=${encodeURIComponent(imgDir(sel))}`, blob, imgFile(sel, pendingKind.current));
      setVer(Date.now());
    } catch (ex: any) { setErr(ex.message || "upload selhal"); }
    setBusy(false);
  };

  const saveFields = async () => {
    if (!sel) return;
    setBusy(true); setErr("");
    try {
      const r: any = await put("/api/admin/heraldry/entry", { typ: tab, id: sel.id, fields });
      setData((d: any) => ({ ...d, [tab]: (d?.[tab] || []).map((x: Item) => (x.id === sel.id ? r.entry : x)) }));
      setSel(r.entry);
    } catch (ex: any) { setErr(ex.message || "uložení selhalo"); }
    setBusy(false);
  };

  const items: Item[] = useMemo(() => {
    const list: Item[] = (data?.[tab] || []);
    const ql = q.trim().toLowerCase();
    return ql ? list.filter((i) => i.nazev.toLowerCase().includes(ql) || (i.znak || "").toLowerCase().includes(ql)) : list;
  }, [data, tab, q]);

  return (
    <div className="p-6 max-w-6xl mx-auto font-ui">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold">🛡 Heraldika</h1>
        {data?.stav && <span className="chip text-[11px]">{data.stav}</span>}
        <input className="inp !w-56 !py-1.5 ml-auto" placeholder="Filtrovat…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1">
          <button className={"btn sm" + (tab === "zeme" ? " chip-accent" : "")} onClick={() => setTab("zeme")}>Země ({data?.zeme?.length ?? "…"})</button>
          <button className={"btn sm" + (tab === "mesta" ? " chip-accent" : "")} onClick={() => setTab("mesta")}>Města ({data?.mesta?.length ?? "…"})</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((it) => (
          <button key={it.id} onClick={() => open(it)}
            className="card p-4 text-left hover:border-[var(--accent)] flex gap-3 items-start">
            <img src={imgPath(it, "znak", ver)} alt="" className="w-14 h-auto shrink-0" loading="lazy"
              onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
            <div className="min-w-0">
              <div className="font-bold leading-tight">{it.nazev}</div>
              {it.znak && <div className="text-xs text-[var(--ink-3)] mt-1 line-clamp-3">{it.znak}</div>}
            </div>
          </button>
        ))}
        {!items.length && <div className="col-span-full text-[var(--ink-3)] py-8 text-center">Nic nenalezeno.</div>}
      </div>

      {sel && (
        <div className="fixed inset-0 z-[700] bg-black/60 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div className="card p-6 w-[560px] max-w-full font-ui max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button className="float-right text-[var(--ink-3)]" onClick={() => setSel(null)}>✕</button>
            <h2 className="text-xl font-bold mb-3">{sel.nazev}</h2>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <div className="flex gap-4 mb-4">
              <figure className="text-center">
                <img src={imgPath(sel, "znak", ver)} alt="znak" className="w-28 h-auto mx-auto"
                  onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
                <figcaption className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mt-1">Znak</figcaption>
                {editable && <button className="btn sm mt-1" disabled={busy} onClick={() => replaceImage("znak")}>Nahradit</button>}
              </figure>
              <figure className="text-center flex-1">
                <img src={imgPath(sel, "vlajka", ver)} alt="vlajka" className="w-full max-w-[260px] h-auto mx-auto"
                  onError={(e) => ((e.target as HTMLElement).style.display = "none")} />
                <figcaption className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mt-1">Vlajka</figcaption>
                {editable && <button className="btn sm mt-1" disabled={busy} onClick={() => replaceImage("vlajka")}>Nahradit</button>}
              </figure>
            </div>
            {editable ? (
              <div className="space-y-2 mb-4">
                {([["znak", "Blason (znak)"], ["znak_en", "Blason EN"], ["vlajka", "Vlajka"],
                   ["vlajka_en", "Vlajka EN"], ["proc", "Proč"]] as const).map(([k, label]) => (
                  <label key={k} className="block text-xs">
                    <span className="font-bold">{label}</span>
                    <textarea className="inp w-full mt-0.5" rows={k === "proc" ? 2 : 1}
                      value={fields[k] || ""} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
                  </label>
                ))}
                {err && <div className="text-red-700 text-xs">{err}</div>}
                <div className="flex gap-2">
                  <button className="btn sm" disabled={busy} onClick={saveFields}>💾 Uložit texty</button>
                  <Link to={pageUrl(sel.soubor)} className="btn sm" onClick={() => setSel(null)}>Otevřít stránku →</Link>
                </div>
              </div>
            ) : (
              <>
                {sel.znak && <p className="text-sm mb-2"><b>Blason:</b> {sel.znak}</p>}
                {sel.znak_en && <p className="text-xs text-[var(--ink-3)] italic mb-3">EN: {sel.znak_en}</p>}
                {sel.vlajka && <p className="text-sm mb-2"><b>Vlajka:</b> {sel.vlajka}</p>}
                {sel.vlajka_en && <p className="text-xs text-[var(--ink-3)] italic mb-3">EN: {sel.vlajka_en}</p>}
                {sel.proc && <p className="text-sm mb-4"><b>Proč:</b> {sel.proc}</p>}
                <Link to={pageUrl(sel.soubor)} className="btn sm" onClick={() => setSel(null)}>Otevřít stránku →</Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

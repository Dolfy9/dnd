import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { post } from "../api";
import { useQueryClient } from "@tanstack/react-query";

const TYPE_DIRS: Record<string, string> = {
  svet: "01_Svet", misto: "01_Svet/Mista", zeme: "02_Zeme", mesto: "03_Mesta",
  postava: "04_Postavy", frakce: "05_Frakce", kniha: "06_Knihy_a_Dokumenty",
  kampan: "07_Kampane", quest: "08_Questy", hadanka: "09_Hadanky",
  sezeni: "10_Sezeni", obchod: "12_Obchody", druh: "13_Druhy",
  povolani: "14_Povolani", podtrida: "15_Podtridy",
};
const TYPE_TEMPLATES: Record<string, string> = {
  postava: "_Sablony/Sablona_Postava.md", obchod: "_Sablony/Sablona_Obchod.md",
  druh: "_Sablony/Sablona_Druh.md", mesto: "_Sablony/Sablona_Mesto.md",
  zeme: "_Sablony/Sablona_Zeme.md", kampan: "_Sablony/Sablona_Kampan.md",
  quest: "_Sablony/Sablona_Quest.md", hadanka: "_Sablony/Sablona_Hadanka.md",
  sezeni: "_Sablony/Sablona_Sezeni.md", povolani: "_Sablony/Sablona_Povolani.md",
};
const TYPE_LABELS: Record<string, string> = {
  postava: "Postava", mesto: "Město", zeme: "Země", frakce: "Frakce",
  obchod: "Obchod", misto: "Místo", kniha: "Kniha / dokument", kampan: "Kampaň",
  quest: "Quest", hadanka: "Hádanka", sezeni: "Sezení", druh: "Druh",
  povolani: "Povolání", podtrida: "Podtřída", svet: "Stránka světa",
};

export default function NewEntityDialog({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState("postava");
  const [name, setName] = useState("");
  const [dir, setDir] = useState(TYPE_DIRS.postava);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();

  const pick = (t: string) => { setType(t); setDir(TYPE_DIRS[t] || ""); };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const r = await post<{ ok: boolean; path: string; url: string }>("/api/entities", {
        type, dir, name: name.trim(),
        template: TYPE_TEMPLATES[type] || "",
      });
      qc.invalidateQueries({ queryKey: ["nav"] });
      qc.invalidateQueries({ queryKey: ["entity-index"] });
      onClose();
      nav(r.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Vytvoření selhalo");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center" onMouseDown={onClose}>
      <div className="card w-full max-w-md p-5 fade-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Nová entita</h2>
          <button className="btn btn-ghost !px-2" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="font-ui space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">Typ</label>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(TYPE_LABELS).map(([t, l]) => (
                <button key={t} type="button"
                  className={`btn !text-xs !py-1.5 ${type === t ? "!border-[var(--accent)] !text-[var(--accent-2)]" : ""}`}
                  onClick={() => pick(t)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">Název</label>
            <input className="input !py-1.5" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()} autoFocus />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">Složka</label>
            <input className="input !py-1 !text-xs" value={dir} onChange={(e) => setDir(e.target.value)} />
          </div>
          {TYPE_TEMPLATES[type] && (
            <div className="text-[11px] text-[var(--ink-3)]">
              Použije se šablona <code>{TYPE_TEMPLATES[type].split("/").pop()}</code>.
            </div>
          )}
          {err && <div className="text-red-400 text-xs">{err}</div>}
          <button className="btn btn-primary w-full justify-center" disabled={busy || !name.trim()}
            onClick={create}>
            {busy ? "Vytvářím…" : "Vytvořit"}
          </button>
        </div>
      </div>
    </div>
  );
}

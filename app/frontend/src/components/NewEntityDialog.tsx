import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "../api";
import { Modal, toast } from "./ui";

const TYPE_DIRS: Record<string, string> = {
  svet: "01_Svet", misto: "01_Svet/Mista", zeme: "02_Zeme", mesto: "03_Mesta",
  postava: "04_Postavy", frakce: "05_Frakce", kniha: "06_Knihy_a_Dokumenty",
  kampan: "07_Kampane", quest: "08_Questy", hadanka: "09_Hadanky",
  sezeni: "10_Sezeni", obchod: "12_Obchody", druh: "13_Druhy",
  povolani: "14_Povolani", podtrida: "15_Podtridy",
  feat: "16_Featy", kouzlo: "17_Kouzla", predmet: "18_Predmety", pozadi: "19_Pozadi",
};

// složka → typ entity (předvyplnění z adresářového výpisu; klíče = plné cesty)
export const DIR_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_DIRS).map(([t, d]) => [d, t]));

const TYPE_TEMPLATES: Record<string, string> = {
  postava: "_Sablony/Sablona_Postava.md", obchod: "_Sablony/Sablona_Obchod.md",
  druh: "_Sablony/Sablona_Druh.md", mesto: "_Sablony/Sablona_Mesto.md",
  zeme: "_Sablony/Sablona_Zeme.md", kampan: "_Sablony/Sablona_Kampan.md",
  quest: "_Sablony/Sablona_Quest.md", hadanka: "_Sablony/Sablona_Hadanka.md",
  sezeni: "_Sablony/Sablona_Sezeni.md", povolani: "_Sablony/Sablona_Povolani.md",
  podtrida: "_Sablony/Sablona_Podtrida.md",
  feat: "_Sablony/Sablona_Feat.md", kouzlo: "_Sablony/Sablona_Kouzlo.md",
  predmet: "_Sablony/Sablona_Predmet.md", pozadi: "_Sablony/Sablona_Pozadi.md",
};
const TYPE_PREFIX: Record<string, string> = {
  postava: "Postava_", obchod: "Obchod_", druh: "Druh_", mesto: "Mesto_",
  quest: "Quest_", hadanka: "Hadanka_", sezeni: "Sezeni_", kniha: "Kniha_",
  povolani: "Povolani_", podtrida: "Podtrida_",
  feat: "Feat_", kouzlo: "Kouzlo_", predmet: "Predmet_", pozadi: "Pozadi_",
};
const TYPE_LABELS: Record<string, string> = {
  postava: "Postava", mesto: "Město", zeme: "Země", frakce: "Frakce",
  obchod: "Obchod", misto: "Místo", kniha: "Kniha / dokument", kampan: "Kampaň",
  quest: "Quest", hadanka: "Hádanka", sezeni: "Sezení", druh: "Druh",
  povolani: "Povolání", podtrida: "Podtřída", svet: "Stránka světa",
  feat: "Feat", kouzlo: "Kouzlo", predmet: "Předmět", pozadi: "Pozadí",
  stranka: "Prostá stránka",
};

// stejná logika jako backend (ascii stem, bez diakritiky)
function stemOf(name: string) {
  const ascii = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ascii.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Nova_stranka";
}

interface Props {
  onClose: () => void;
  initialType?: string;
  initialDir?: string;
}

export default function NewEntityDialog({ onClose, initialType, initialDir }: Props) {
  const [type, setType] = useState(initialType && TYPE_LABELS[initialType] ? initialType : "postava");
  const [name, setName] = useState("");
  const [dir, setDir] = useState(initialDir || TYPE_DIRS[initialType || "postava"] || TYPE_DIRS.postava);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();

  const tree = useQuery({
    queryKey: ["tree"],
    queryFn: () => get<{ files: string[]; dirs: string[] }>("/api/tree"),
    staleTime: 60_000,
  });

  const pick = (t: string) => { setType(t); setDir(TYPE_DIRS[t] || dir || ""); };

  const previewPath = () => {
    const stem = stemOf(name.trim());
    if (!name.trim() || !dir.trim()) return "";
    const prefix = type === "stranka" ? "" : (TYPE_PREFIX[type] || "");
    return `${dir.replace(/^\/+|\/+$/g, "")}/${prefix}${stem}.md`;
  };

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await post<{ ok: boolean; path: string; url: string }>(
        type === "stranka" ? "/api/page" : "/api/entities",
        type === "stranka"
          ? { dir, name: name.trim() }
          : { type, dir, name: name.trim(), template: TYPE_TEMPLATES[type] || "" });
      qc.invalidateQueries({ queryKey: ["nav"] });
      qc.invalidateQueries({ queryKey: ["entity-index"] });
      toast("Stránka vytvořena.", "ok");
      onClose();
      nav(r.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Vytvoření selhalo");
      setBusy(false);
    }
  };

  return (
    <Modal title="Nová entita" onClose={onClose} width={460}
      footer={
        <>
          <button className="btn" onClick={onClose}>Zrušit</button>
          <button className="btn btn-primary" disabled={busy || !name.trim() || !dir.trim()}
            onClick={create}>
            {busy ? "Vytvářím…" : "Vytvořit"}
          </button>
        </>
      }>
      <div className="space-y-3">
        {type === "postava" && (
          <button type="button" className="btn w-full" onClick={() => { onClose(); nav("/postava/nova"); }}>
            🧝 Otevřít průvodce vytvořením postavy →
          </button>
        )}
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
          <input className="input !py-1 !text-xs" value={dir} onChange={(e) => setDir(e.target.value)}
            list="mont-dirs" />
          <datalist id="mont-dirs">
            {(tree.data?.dirs || []).map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
        {previewPath() && (
          <div className="text-[11px] text-[var(--ink-3)]">
            Vznikne soubor <code>{previewPath()}</code>
          </div>
        )}
        {type !== "stranka" && TYPE_TEMPLATES[type] && (
          <div className="text-[11px] text-[var(--ink-3)]">
            Použije se šablona <code>{TYPE_TEMPLATES[type].split("/").pop()}</code>.
          </div>
        )}
        {err && <div className="text-red-400 text-xs">{err}</div>}
      </div>
    </Modal>
  );
}

/* Knihovna presetů efektů/zón: hledání, kategorie, auto-návrhy. */
import { useMemo, useState } from "react";
import type { EffectPreset, Token } from "../types";
import { EFFECT_PRESETS, PRESET_CATS, suggestPresets } from "../rules/presets";
import { Search, MousePointer2, MapPin } from "lucide-react";

export default function PresetPicker({ forTok, onPick, onZone }: {
  forTok?: Token | null;
  onPick: (p: EffectPreset) => void;
  onZone?: (p: EffectPreset) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const suggested = useMemo(() => {
    if (!forTok) return [];
    const names = [
      ...(forTok.rysy || []).map((r) => r.nazev),
      ...(forTok.kouzla || []).map((k) => k.kouzlo || k.nazev),
      ...(forTok.zdroje || []).map((z) => z.nazev),
      ...(forTok.atk || []).map((a) => a.nazev),
    ];
    return suggestPresets(names);
  }, [forTok?.id]);
  const list = useMemo(() => {
    let l = EFFECT_PRESETS;
    if (cat) l = l.filter((p) => p.cat === cat);
    if (q) { const s = q.toLowerCase(); l = l.filter((p) => p.nazev.toLowerCase().includes(s) || p.desc.toLowerCase().includes(s)); }
    return l;
  }, [q, cat]);
  const sugSet = new Set(suggested.map((p) => p.id));
  const rows = q || cat ? list : [...suggested, ...list.filter((p) => !sugSet.has(p.id))];

  const Row = ({ p, sug }: { p: EffectPreset; sug?: boolean }) => (
    <div className={`boj-preset ${sug ? "sug" : ""}`} title={p.desc}>
      <span className="boj-preset-ico" style={{ background: (p.color || "#64748b") + "33", color: p.color || "#94a3b8" }}>{p.icon}</span>
      <span className="boj-preset-name"><b>{p.nazev}</b>{p.conc && <i>Conc</i>}{sug && <em>doporučeno</em>}</span>
      <span className="boj-preset-btns">
        <button title="Aplikovat na vybrané" onClick={() => onPick(p)}><MousePointer2 size={12} /></button>
        {p.zone && onZone && <button title="Umístit jako zónu" onClick={() => onZone(p)}><MapPin size={12} /></button>}
      </span>
    </div>
  );

  return (
    <div className="boj-picker">
      <div className="boj-picker-search"><Search size={13} /><input placeholder="Hledat efekt/zónu…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="boj-picker-cats">
        <button className={!cat ? "on" : ""} onClick={() => setCat(null)}>Vše</button>
        {PRESET_CATS.map((c) => <button key={c.id} className={cat === c.id ? "on" : ""} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.icon} {c.nazev}</button>)}
      </div>
      <div className="boj-picker-list">
        {!q && !cat && !!suggested.length && <h5>Návrhy pro {forTok?.nazev}</h5>}
        {rows.map((p) => <Row key={p.id} p={p} sug={sugSet.has(p.id) && !q && !cat} />)}
        {!rows.length && <i className="boj-none">Nic nenalezeno</i>}
      </div>
    </div>
  );
}

/* Panel Efekty: knihovna presetů + aktivní efekty/zóny v boji se zbytkem kol. */
import type { StavBoje, Token, EffectPreset } from "../types";
import PresetPicker from "./PresetPicker";
import { byId } from "../rules/turn";
import { Trash2 } from "lucide-react";

export default function EffectsPanel({ S, sel, selSet, dm, onPickPreset, onZonePreset, onRemoveEffect, onRemoveZone, onDropConc }: {
  S: StavBoje;
  sel: Token | null;
  selSet: Set<string>;
  dm: boolean;
  onPickPreset: (p: EffectPreset) => void;
  onZonePreset: (p: EffectPreset) => void;
  onRemoveEffect: (tokId: string, effId: string) => void;
  onRemoveZone: (id: string) => void;
  onDropConc: (srcId: string) => void;
}) {
  return (
    <div className="boj-effpanel">
      {dm && <PresetPicker forTok={sel} onPick={onPickPreset} onZone={onZonePreset} />}
      <div className="boj-sec">
        <h4>Aktivní efekty</h4>
        {S.tok.filter((t) => (t.effects || []).length || t.conc).map((t) => (
          <div key={t.id} className="boj-eff-tok">
            <b>{t.nazev}</b>{t.conc && <i className="boj-conc-tag" onClick={() => dm && onDropConc(t.id)} title="Klik = zrušit Concentration">⛁ {t.conc}</i>}
            {t.effects.map((e) => (
              <span key={e.id} className="boj-eff-chip" title={`${e.nazev}${e.src ? ` od ${byId(S, e.src)?.nazev || "?"}` : ""}`}>
                {e.icon} {e.nazev}
                {e.duration?.rounds != null && <em>{e.duration.rounds}k</em>}
                {dm && <i onClick={() => onRemoveEffect(t.id, e.id)}><Trash2 size={10} /></i>}
              </span>
            ))}
          </div>
        ))}
        {!S.tok.some((t) => (t.effects || []).length || t.conc) && <i className="boj-none">Žádné aktivní efekty</i>}
      </div>
      {!!S.zones.length && (
        <div className="boj-sec">
          <h4>Zóny ({S.zones.length})</h4>
          {S.zones.map((z) => (
            <div key={z.id} className="boj-zone-row">
              <b>{z.nazev}</b><span>{z.style} {z.duration?.rounds != null ? `· ${z.duration.rounds}k` : ""}{z.conc ? " ⛁" : ""}</span>
              {dm && <button onClick={() => onRemoveZone(z.id)}>✕</button>}
            </div>
          ))}
        </div>
      )}
      {!!selSet.size && <i className="boj-hint">Vybráno {selSet.size} žetonů — preset se aplikuje na všechny</i>}
    </div>
  );
}

/* Klávesové zkratky — nápověda na "?". */
import { X } from "lucide-react";

const SHORTCUTS: [string, string][] = [
  ["Space / N", "Další tah"],
  ["Ctrl+Z / Ctrl+Shift+Z", "Zpět / vpřed"],
  ["Esc", "Zrušit režim"],
  ["M", "Metr"],
  ["T", "Cílení útoku"],
  ["1–9", "Akce aktivního žetonu"],
  ["Šipky", "Posun žetonu o buňku"],
  ["Delete", "Odebrat žeton (potvrdit)"],
  ["H / D", "Léčit / poškodit (inspektor)"],
  ["F", "Fit mapa"],
  ["Shift+klik / táhni", "Multi-select žetonů"],
  ["Pravý klik / long-press", "Kontextové menu"],
  ["Dvojklik", "Inspektor žetonu"],
  ["?", "Tato nápověda"],
];

export default function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="boj-modal" onClick={onClose}>
      <div className="boj-modal-in boj-help" onClick={(e) => e.stopPropagation()}>
        <div className="boj-modal-head"><b>Klávesové zkratky</b><button className="boj-x" onClick={onClose}><X size={14} /></button></div>
        <div className="boj-help-grid">
          {SHORTCUTS.map(([k, d]) => <div key={k}><kbd>{k}</kbd><span>{d}</span></div>)}
        </div>
      </div>
    </div>
  );
}

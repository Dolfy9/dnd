import { useState } from "react";

/* Popisek derivované hodnoty: klik = rozpad na zdroje (rozpis), ✎ = ruční přepis. */
export default function Rozpis({ stat, label, value, rozpis, canEdit, onOverride, overridden }: {
  stat: string; label?: string; value: React.ReactNode;
  rozpis?: { zdroj: string; hodnota: any }[];
  canEdit?: boolean; overridden?: boolean;
  onOverride?: (stat: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className={"cs-rozpis" + (overridden ? " cs-over" : "")}>
      <span role="button" className="cs-rozpis-v" title={overridden ? "Hodnota přepsána ručně — klik = rozpad" : "Klik = rozpad hodnoty"}
        onClick={() => setOpen(!open)}>{value}</span>
      {open && (
        <span className="cs-rozpis-pop">
          <span className="cs-rozpis-h">
            <b>{label || stat}</b>
            <button type="button" onClick={() => setOpen(false)}>✕</button>
          </span>
          {rozpis?.length ? (
            <ul>
              {rozpis.map((r, i) => (
                <li key={i}><span>{r.zdroj}</span><b>{typeof r.hodnota === "number" && r.hodnota >= 0 ? "+" + r.hodnota : r.hodnota}</b></li>
              ))}
            </ul>
          ) : <span className="cs-rozpis-empty">Bez rozpadu — hodnota je základní nebo ruční.</span>}
          {canEdit && onOverride && (
            <button type="button" className="btn sm" onClick={() => { setOpen(false); onOverride(stat); }}>
              ✎ Přepsat ručně{overridden ? " (zrušit přepis)" : ""}
            </button>
          )}
        </span>
      )}
    </span>
  );
}

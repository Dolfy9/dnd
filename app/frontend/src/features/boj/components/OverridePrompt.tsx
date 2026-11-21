/* Sdílený override popover: žádné window.confirm/prompt — inline dialog s volbami
   (včetně explicitního "⚙ DM" override). Na mobilu bottom sheet. */
import { useEffect, type ReactNode } from "react";

export interface OverrideOption {
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  dm?: boolean;              // ⚙ DM volba (zvýrazněná)
  onPick: () => void;
}

export default function OverridePrompt({ title, reason, children, options, onClose, anchor }: {
  title: string;
  reason?: string;
  children?: ReactNode;
  options: OverrideOption[];
  onClose: () => void;
  anchor?: { x: number; y: number }; // souřadnice na obrazovce pro popover
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  const style: React.CSSProperties = anchor
    ? { position: "fixed", left: Math.min(anchor.x, window.innerWidth - 290), top: Math.min(anchor.y, window.innerHeight - 260), zIndex: 60 }
    : {};
  return (
    <div className={`boj-op ${anchor ? "anchored" : ""}`} style={style} onClick={(e) => e.stopPropagation()}>
      {anchor == null && <div className="boj-op-back" onClick={onClose} />}
      <div className="boj-op-in">
        <div className="boj-op-head"><b>{title}</b><button className="boj-x" onClick={onClose}>✕</button></div>
        {reason && <div className="boj-op-reason">{reason}</div>}
        {children}
        <div className="boj-op-opts">
          {options.map((o, i) => (
            <button key={i} className={`boj-op-btn ${o.dm ? "dm" : ""} ${o.danger ? "danger" : ""}`}
                    disabled={o.disabled} title={o.disabled ? o.hint : undefined}
                    onClick={() => { o.onPick(); }}>
              {o.dm ? `⚙ ${o.label}` : o.label}
              {o.hint && <em>{o.hint}</em>}
            </button>
          ))}
          <button className="boj-op-btn" onClick={onClose}>Zrušit</button>
        </div>
      </div>
    </div>
  );
}

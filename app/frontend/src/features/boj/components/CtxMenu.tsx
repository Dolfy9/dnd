/* Kontextové menu žetonu (right-click / long-press). */
import { useEffect, useRef } from "react";
import type { Token } from "../types";
import { Swords, HeartPulse, Bandage, Sparkles, EyeOff, Trash2, Droplets } from "lucide-react";

export interface CtxAction { id: string; nazev: string; icon: React.ReactNode }

export default function CtxMenu({ t, x, y, dm, onClose, onAction }: {
  t: Token; x: number; y: number; dm: boolean;
  onClose: () => void;
  onAction: (a: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("mousedown", h); window.removeEventListener("keydown", k); };
  }, [onClose]);
  const items: CtxAction[] = [
    { id: "attack", nazev: "Zaútočit na…", icon: <Swords size={13} /> },
    { id: "dmg", nazev: "Poškodit", icon: <Droplets size={13} /> },
    { id: "heal", nazev: "Léčit", icon: <Bandage size={13} /> },
    { id: "cond", nazev: "Stav", icon: <HeartPulse size={13} /> },
    { id: "effect", nazev: "Efekt", icon: <Sparkles size={13} /> },
    { id: "hide", nazev: t.skryty ? "Odkrýt" : "Skrýt", icon: <EyeOff size={13} /> },
    { id: "remove", nazev: "Odebrat", icon: <Trash2 size={13} /> },
  ];
  const st = { left: Math.min(x, window.innerWidth - 190), top: Math.min(y, window.innerHeight - 250) };
  return (
    <div ref={ref} className="boj-ctx" style={st}>
      <b>{t.nazev}</b>
      <div className="boj-ctx-hp">
        <span>HP {t.hp}/{t.max}{t.tmp ? ` (+${t.tmp})` : ""}</span>
        <button onClick={() => { onAction("hp:-5"); onClose(); }}>−5</button>
        <button onClick={() => { onAction("hp:-1"); onClose(); }}>−1</button>
        <button onClick={() => { onAction("hp:+1"); onClose(); }}>+1</button>
        <button onClick={() => { onAction("hp:+5"); onClose(); }}>+5</button>
        <button title="+5 temp HP" onClick={() => { onAction("tmp:+5"); onClose(); }}>⛨+5</button>
      </div>
      {items.filter((i) => dm || ["attack", "cond", "effect"].includes(i.id)).map((i) => (
        <button key={i.id} onClick={() => { onAction(i.id); onClose(); }}>{i.icon} {i.nazev}</button>
      ))}
    </div>
  );
}

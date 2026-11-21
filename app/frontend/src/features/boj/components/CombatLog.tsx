/* Bitevní log: filtr podle typu, rozbalitelný rozpad hodů, export Markdown. */
import { useMemo, useState } from "react";
import type { LogEntry } from "../types";
import { Download } from "lucide-react";

const TYPES: { id: string; n: string }[] = [
  { id: "vse", n: "Vše" }, { id: "attack", n: "Útoky" }, { id: "damage", n: "Zranění" },
  { id: "heal", n: "Léčení" }, { id: "save", n: "Záchrany" }, { id: "cond", n: "Stavy" },
  { id: "effect", n: "Efekty" }, { id: "move", n: "Pohyb" }, { id: "turn", n: "Tahy" }, { id: "system", n: "Systém" },
];

export function logToMd(log: LogEntry[]): string {
  return [...log].reverse().map((l) => {
    let d = "";
    try { if (l.detail) { const o = JSON.parse(l.detail); d = ` _(${Object.entries(o).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : v}`).join(", ")})_`; } } catch { /* noop */ }
    return `- **k${l.k}** ${l.c} ${l.kdo ? `*${l.kdo}*: ` : ""}${l.t}${d}`;
  }).join("\n");
}

export default function CombatLog({ log, pj }: { log: LogEntry[]; pj: boolean }) {
  const [f, setF] = useState("vse");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const items = useMemo(
    () => log.filter((l) => (f === "vse" || l.typ === f) && (pj || !l.pj)),
    [log, f, pj],
  );
  const exportMd = () => {
    const blob = new Blob([logToMd(items)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "boj-log.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="boj-log">
      <div className="boj-log-head">
        <div className="boj-log-filter">
          {TYPES.map((t) => <button key={t.id} className={f === t.id ? "on" : ""} onClick={() => setF(t.id)}>{t.n}</button>)}
        </div>
        <button className="boj-btn2" onClick={exportMd} title="Export Markdown"><Download size={13} /></button>
      </div>
      <div className="boj-log-items">
        {items.map((l, i) => {
          const has = !!l.detail;
          const isOpen = open.has(i);
          return (
            <div key={i} className={`boj-log-item t-${l.typ} ${l.pj ? "pj" : ""}`} onClick={() => has && setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}>
              <span className="k">k{l.k}</span>
              <span className="txt"><b>{l.kdo}</b>{l.kdo ? " — " : ""}{l.t}{l.pj ? " 🕶" : ""}</span>
              {has && <em>{isOpen ? "▾" : "▸"}</em>}
              {has && isOpen && <pre>{(() => { try { return JSON.stringify(JSON.parse(l.detail!), null, 1); } catch { return l.detail; } })()}</pre>}
            </div>
          );
        })}
        {!items.length && <i className="boj-none">zatím prázdné — hod iničiati a bojuj</i>}
      </div>
    </div>
  );
}

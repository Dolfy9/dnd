/* Ikona stavu — malý smaltovaný disk (badge na minci i v seznamech). */
import { CONDITIONS } from "../rules/conditions";

export default function ConditionIcon({ n, lvl, size = 16, title }: { n: string; lvl?: number; size?: number; title?: string }) {
  const c = CONDITIONS[n];
  return (
    <span
      className="boj-cond"
      title={title || `${n}${lvl ? ` ${lvl}` : ""}${c ? ` — ${c.desc}` : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.62 }}
    >
      {c?.icon || "•"}
      {lvl ? <i>{lvl}</i> : null}
    </span>
  );
}

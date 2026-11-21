/* Banner začátku tahu: připomínky (Concentration, končící efekty, death save,
   recharge, legendary actions). */
import type { StavBoje } from "../types";
import { cur } from "../rules/turn";
import { Bell } from "lucide-react";

export default function TurnBanner({ S }: { S: StavBoje }) {
  const t = cur(S);
  if (!t) return null;
  const items: string[] = [];
  const msgs = (S.turnMsgs as string[] | undefined) || [];
  if (msgs.length) items.push(...msgs.slice(0, 6));
  if (t.conc) items.push(`${t.nazev}: Concentration na ${t.conc}`);
  if (t.dying && !t.dead) items.push(`${t.nazev}: umírá — death save`);
  if (t.legendary && t.legendary.max - t.legendary.used > 0)
    items.push(`${t.nazev}: legendary actions ${t.legendary.max - t.legendary.used}/${t.legendary.max}`);
  const expiring = t.effects.filter((e) => e.duration?.kind === "rounds" && (e.duration.rounds ?? 9) <= 1);
  for (const e of expiring) items.push(`${t.nazev}: ${e.nazev} končí příští kolo`);
  if (!items.length) return null;
  return (
    <div className="boj-turnbanner">
      <Bell size={13} />
      <div>{items.slice(0, 4).map((m, i) => <span key={i}>{m}</span>)}</div>
    </div>
  );
}

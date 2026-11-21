/* Obtížnost střetnutí podle DMG 2024 XP budget (Low/Moderate/High na úroveň). */
import type { Token } from "../types";

/** DMG 2024: [low, moderate, high] XP na postavu podle úrovně. */
export const BUDGET: [number, number, number][] = [
  [0, 0, 0],
  [50, 75, 100], [100, 150, 200], [150, 225, 300], [250, 400, 500],
  [350, 550, 750], [450, 700, 950], [550, 850, 1150], [650, 1000, 1350],
  [850, 1300, 1750], [1050, 1650, 2150], [1150, 1800, 2400], [1350, 2100, 2750],
  [1650, 2550, 3350], [1750, 2700, 3550], [2100, 3250, 4250], [2350, 3650, 4750],
  [2850, 4400, 5750], [3150, 4900, 6400], [3450, 5400, 7050], [4000, 6200, 8100],
];

export interface EncounterReport {
  xp: number;
  partyXp: { low: number; moderate: number; high: number };
  label: string;
  cls: "trivial" | "low" | "moderate" | "high" | "deadly";
  per: string;
}

/** XP za souboj + obtížnost vs družina (party = tokeny strany druzina). */
export function difficulty(tokens: Token[], partyLevels: number[] = []): EncounterReport {
  const xp = tokens.filter((t) => t.side === "nepratele").reduce((a, t) => a + (t.xp || 0), 0);
  const lvls = partyLevels.length ? partyLevels : tokens.filter((t) => t.side === "druzina").map((t) => t.lvl || 1);
  const budget = [0, 0, 0] as [number, number, number];
  for (const l of lvls) {
    const row = BUDGET[Math.min(20, Math.max(1, Math.round(l)))];
    budget[0] += row[0]; budget[1] += row[1]; budget[2] += row[2];
  }
  let cls: EncounterReport["cls"] = "trivial", label = "Triviální";
  if (xp >= budget[2]) { cls = "deadly"; label = "Smrtelné"; }
  else if (xp >= budget[1]) { cls = "high"; label = "Vysoké"; }
  else if (xp >= budget[0]) { cls = "moderate"; label = "Střední"; }
  else if (xp > 0) { cls = "low"; label = "Nízké"; }
  return {
    xp, partyXp: { low: budget[0], moderate: budget[1], high: budget[2] },
    label, cls, per: `${xp} XP / rozpočet ${budget.join(" / ")}`,
  };
}

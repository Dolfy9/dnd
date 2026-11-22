/* Chování class resources (zdrojů): co se stane po kliknutí. Čistá logika,
   konkrétní aplikace dělá commands.ts (kvůli logu/fx). */
import type { StavBoje, Token } from "../types";

export interface ResourceAction {
  kind: "heal" | "extraAction" | "preset" | "area" | "generic";
  healDice?: string;            // "1d10" (Second Wind)
  healAdd?: number;             // + Fighter level
  presetId?: string;            // aplikovat preset (Rage…)
  needsAmount?: boolean;        // Lay on Hands — pool místo jednotek
  eco?: "a" | "b" | "r" | "free";
  desc?: string;
}

/** Návrat akce pro daný resource dle názvu. */
export function resourceAction(nazev: string, t: Token): ResourceAction {
  const n = nazev.toLowerCase();
  if (/second wind/.test(n))
    return { kind: "heal", healDice: "1d10", healAdd: t.lvl || 1, eco: "b", desc: "1d10 + Fighter level (Bonus Action)" };
  if (/action surge/.test(n))
    return { kind: "extraAction", eco: "free", desc: "+1 Action tento tah" };
  if (/rage|běsněn/.test(n))
    return { kind: "preset", presetId: "rage", eco: "b", desc: "aplikuje Rage preset" };
  if (/lay on hands/.test(n))
    return { kind: "heal", needsAmount: true, eco: "b", desc: "léčí z poolu HP (Bonus Action)" };
  if (/breath weapon/.test(n))
    return { kind: "area", eco: "a", desc: "otevře oblast podle druhu dechu" };
  if (/channel divinity|ki |focus|bardic|sorcery|superiority|psionic/.test(n))
    return { kind: "generic", eco: "b", desc: "spotřebuje 1 použití" };
  return { kind: "generic", eco: "free", desc: "spotřebuje 1 použití" };
}

/** Obnova zdrojů při krátkém/dlouhém odpočinku (`obnova` z sheetu). */
export function restResources(S: StavBoje, ids: string[], kind: "short" | "long"): string[] {
  const msgs: string[] = [];
  for (const id of ids) {
    const t = S.tok.find((x) => x.id === id);
    if (!t) continue;
    for (const z of t.zdroje || []) {
      const ob = (z.obnova || "").toLowerCase();
      const back = kind === "long" || /short|krát|sr|šr/.test(ob) || !ob;
      if (back && z.used > 0) {
        z.used = 0;
        msgs.push(`${t.nazev}: ${z.nazev} obnoveno`);
      }
    }
    if (kind === "long") {
      // sloty se vrací (1/2 za long? 2024: všechny), pact slots se vrací i za short
      for (const sl of t.slots || []) sl.used = 0;
      if (t.pact) t.pact.used = 0;
      t.exhaustion = Math.max(0, (t.exhaustion || 0) - 1);
      if (t.speedOverride != null) { delete t.speedOverride; msgs.push(`${t.nazev}: ⚙ speed override zrušen`); }
      msgs.push(`${t.nazev}: Long Rest — sloty a Exhaustion −1`);
    } else if (t.pact) {
      t.pact.used = 0;
      msgs.push(`${t.nazev}: Pact sloty obnoveny (Short Rest)`);
    }
  }
  return msgs;
}

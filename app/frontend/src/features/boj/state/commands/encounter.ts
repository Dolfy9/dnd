import type { StavBoje } from "../../types";
import * as C from "./index";
import { cur, log, rollInitiative, legendaryActionError } from "../../rules/turn";
import { defaultRng, type Rng } from "../../rules/dice";
import { creatureType } from "../../components/encounterModel";

export type BulkAction = { kind: "damage" | "heal"; amount: number; type: string } | { kind: "condition"; name: string; on: boolean } | { kind: "hidden" | "remove" | "kill" } | { kind: "initiative"; value?: number; grouped?: boolean };
export function bulkEncounter(S: StavBoje, ids: string[], action: BulkAction, rng: Rng = defaultRng) {
  const tokens = S.tok.filter(t => ids.includes(t.id));
  const active = cur(S)?.id;
  const following = S.ord.slice(S.turn + 1);
  if (action.kind === "initiative") {
    const rolled = new Map<string, number>();
    for (const t of tokens) {
      let value = action.value;
      const key = `${t.side}:${creatureType(t)}`;
      if (value == null && action.grouped && t.kind === "mon") value = rolled.get(key);
      if (value == null) {
        const temp = { ...S, tok: [t], ord: [t.id], log: [] };
        rollInitiative(temp, rng); value = t.init!;
        if (action.grouped && t.kind === "mon") rolled.set(key, value);
      }
      if (!Number.isFinite(value)) continue;
      C.setInit(S, t.id, value); log(S, "turn", `${t.nazev}: iniciativa ${value}`, "PJ");
    }
  } else {
    if ((action.kind === "damage" || action.kind === "heal") && (!Number.isFinite(action.amount) || action.amount <= 0)) return;
    for (const t of tokens) {
      if (action.kind === "damage") C.cmdDamage(S, t.id, action.amount, action.type);
      if (action.kind === "heal") C.cmdHeal(S, t.id, action.amount);
      if (action.kind === "condition") C.toggleCond(S, t.id, action.name, action.on);
      if (action.kind === "hidden") { C.patchToken(S, t.id, { skryty: !t.skryty }); log(S, "system", `${t.nazev}: ${t.skryty ? "skrytý" : "viditelný"}`, "PJ"); }
      if (action.kind === "kill") { C.dropConc(S, t.id); C.patchToken(S, t.id, { hp: 0, dead: true, dying: false }); log(S, "system", `${t.nazev}: označen jako mrtvý (PJ)`, "PJ"); }
      if (action.kind === "remove") { C.dropConc(S, t.id); C.removeToken(S, t.id); }
    }
  }
  const next = active && S.ord.includes(active) ? active : following.find(id => S.ord.includes(id)) || S.ord[0];
  S.turn = next ? S.ord.indexOf(next) : -1;
}
export function reorderEncounter(S: StavBoje, id: string, before?: string) {
  if (!S.ord.includes(id) || id === before || (before && !S.ord.includes(before))) return;
  const active = cur(S)?.id;
  S.ord = S.ord.filter(x => x !== id);
  S.ord.splice(before ? S.ord.indexOf(before) : S.ord.length, 0, id);
  S.turn = active ? S.ord.indexOf(active) : -1;
  log(S, "turn", `Pořadí PJ: ${S.tok.find(t => t.id === id)?.nazev} ${before ? "před " + S.tok.find(t => t.id === before)?.nazev : "na konec"}`, "PJ");
}
export function delayError(S: StavBoje, id: string) {
  const ending = { ...S, legendaryWindow: { actorId: id, usedBy: [] } };
  return cur(S)?.id === id && !S.legendaryWindow && S.tok.some(t => t.atk.some(a => a.legendaryCost != null && !legendaryActionError(ending, t, a.legendaryCost))) ? "Nejprve ukonči tah a vyřeš legendární okno." : "";
}
export function delayEncounter(S: StavBoje, id: string) {
  if (!S.ord.includes(id) || delayError(S, id)) return;
  if (cur(S)?.id === id) C.nextTurn(S);
  reorderEncounter(S, id);
}

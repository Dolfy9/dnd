import { describe, expect, it } from "vitest";
import { custom } from "./combatants";
import { defaultSettings } from "./settings";
import { applyBattleDamage } from "./battleDamage";
import { enqueueDecision, orderedDecisions, pendingOf, type PendingKind } from "./pending";
import { endOfTurnProcess } from "./turn";
import { planMovement } from "./movement";
import { queueOpportunityMove, resolvePending } from "../state/commands/pending";
import type { BattleMapData, StavBoje } from "../types";

const map: BattleMapData = { id: "t", nazev: "t", podklad: "mesto", mrizka: Array(10).fill("....................") };
const setup = () => {
  const a = { ...custom("Hero", "druzina", 100, 15), id: "a", x: 2, y: 3 };
  const b = { ...custom("Monster", "nepratele", 100, 12), id: "b", x: 3, y: 3 };
  b.atk = [{ nazev: "Claw", kind: "weapon", melee: true, bonus: 100, dmg: "1", typ: "Slashing" }];
  const S: StavBoje = { tok: [a, b], ord: [a.id, b.id], round: 2, turn: 0, log: [], eco: {}, zones: [], fx: [], nastaveni: defaultSettings() };
  return { S, a, b };
};
describe("ordered nonblocking pending decisions", () => {
  it("orders OA, concentration, reactions, legendary, end saves, FIFO within each kind", () => {
    expect(orderedDecisions<{kind: PendingKind; id: string}>([{ kind: "saveEnd", id: "s" }, { kind: "reaction", id: "r1" }, { kind: "oa", id: "oa" }, { kind: "legendary", id: "l" }, { kind: "concentration", id: "c" }, { kind: "reaction", id: "r2" }]).map(x => x.id)).toEqual(["oa", "c", "r1", "r2", "l", "s"]);
    expect(orderedDecisions([])).toEqual([]);
  });
  it("queues concentration ask without rolling and resolves failure with linked cleanup", () => {
    const { S, a, b } = setup(); a.conc = "Bless"; S.nastaveni!.automatizace.concentration = "zeptat";
    b.effects.push({ id: "linked", nazev: "Bless", src: a.id, conc: "Bless", mods: {} });
    applyBattleDamage(S, a, [{ amount: 25, type: "Fire" }]); expect(a.conc).toBe("Bless");
    const item = pendingOf(S)[0]; expect(item).toMatchObject({ kind: "concentration", dc: 12 });
    expect(resolvePending(S, item.id, false, map, () => 0)).toBe(true);
    expect(a.conc).toBe(false); expect(b.effects).toEqual([]); expect(pendingOf(S)).toEqual([]);
    expect(resolvePending(S, item.id, false, map)).toBe(false);
  });
  it("skips without spending a resource or re-rolling, and ignores stale concentration", () => {
    const { S, a } = setup(); a.conc = "Bless";
    enqueueDecision(S, { kind: "concentration", tokenId: a.id, spell: "Bless", dc: 30, label: "CON" });
    resolvePending(S, pendingOf(S)[0].id, true, map, () => 0); expect(a.conc).toBe("Bless");
    enqueueDecision(S, { kind: "concentration", tokenId: a.id, spell: "Old spell", dc: 30, label: "stale" });
    resolvePending(S, pendingOf(S)[0].id, false, map, () => 0); expect(a.conc).toBe("Bless");
  });
  it("defers repeated end saves, then removes the linked condition through existing logic", () => {
    const { S, a } = setup(); a.effects.push({ id: "hold", nazev: "Hold", mods: { grantsCond: "Restrained" }, saveEnd: { ab: "STR", dc: 10 } }); a.cond.push({ n: "Restrained" });
    endOfTurnProcess(S, a); endOfTurnProcess(S, a); expect(pendingOf(S)).toHaveLength(1); expect(a.effects).toHaveLength(1);
    resolvePending(S, pendingOf(S)[0].id, false, map, () => .99); expect(a.effects).toEqual([]); expect(a.cond).toEqual([]);
  });
  it("offers OA before moving, uses Reaction not Action, and moves only after the decision", () => {
    const { S, a, b } = setup(); const plan = planMovement(S, map, a, [], [0, 3], "pravidla", S.nastaveni!);
    queueOpportunityMove(S, a, plan, [0, 3]); expect(a.x).toBe(2); expect(pendingOf(S)[0].kind).toBe("oa");
    resolvePending(S, pendingOf(S)[0].id, false, map, () => .6);
    expect(a.x).toBe(0); expect(a.hp).toBeLessThan(100); expect(S.eco[b.id]).toMatchObject({ r: 1, a: 0 });
  });
  it("OA skip preserves Reaction; changed mover invalidates the deferred move", () => {
    const { S, a, b } = setup(); const plan = planMovement(S, map, a, [], [0, 3], "pravidla", S.nastaveni!);
    queueOpportunityMove(S, a, plan, [0, 3]); resolvePending(S, pendingOf(S)[0].id, true, map);
    expect(a.x).toBe(0); expect(S.eco[b.id]?.r || 0).toBe(0);
    a.x = 2; queueOpportunityMove(S, a, plan, [0, 3]); a.x = 7;
    resolvePending(S, pendingOf(S)[0].id, false, map); expect(a.x).toBe(7); expect(pendingOf(S)).toEqual([]);
  });
});

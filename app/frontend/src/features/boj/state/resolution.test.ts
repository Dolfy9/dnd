import { describe, expect, it } from "vitest";
import { custom } from "../rules/combatants";
import { defaultSettings } from "../rules/settings";
import type { AttackDef, BattleMapData, StavBoje, Token } from "../types";
import { applyResolution, previewResolution } from "./resolution";
import type { Resolve } from "../components/ResolveDialog";

const map: BattleMapData = { id: "t", nazev: "t", podklad: "mesto", mrizka: Array(15).fill("..............................") };
const sword: AttackDef = { nazev: "Sword", kind: "weapon", melee: true, reach: 5, bonus: 5, dmg: "1d8+3", typ: "Slashing" };
const tok = (id: string, x: number): Token => ({ ...custom(id, id === "a" ? "druzina" : "nepratele", 100, 12), id, x, y: 3 });
const setup = () => {
  const a = tok("a", 2), b = tok("b", 3);
  const S: StavBoje = { tok: [a, b], ord: [a.id, b.id], turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], nastaveni: defaultSettings() };
  const r: Resolve = { kind: "attack", srcId: a.id, tgtId: b.id, atk: sword };
  return { a, b, S, r };
};
describe("staged authoritative command results", () => {
  it("does not spend HP/economy until apply, then applies the exact typed result once", () => {
    const { S, r, b } = setup(); b.odolnosti = ["Slashing"]; const before = JSON.stringify(S);
    const draft = previewResolution(S, map, r, { manualD20: 20, manualDmg: 17 });
    expect(JSON.stringify(S)).toBe(before); expect(draft.error).toBeUndefined();
    expect(draft.results[0]).toMatchObject({ outcome: "crit", applied: 8, parts: [{ type: "Slashing", in: 17, out: 8 }] });
    expect(draft.results[0].breakdown).toContain("damage ručně 17");
    expect(applyResolution(S, draft)).toBe(true); expect(S.tok[1].hp).toBe(92); expect(S.eco.a.a).toBe(1);
    expect(applyResolution(S, draft)).toBe(false); expect(S.tok[1].hp).toBe(92);
  });
  it("shows miss without damage and rejects stale, illegal and invalid overrides", () => {
    const { S, r } = setup(); const draft = previewResolution(S, map, r, { manualD20: 1 });
    expect(draft.results[0]).toMatchObject({ outcome: "miss", applied: 0 });
    S.tok[1].x = 25; expect(applyResolution(S, draft)).toBe(false);
    expect(previewResolution(S, map, r, {}).error).toMatch(/dostřel/);
    expect(previewResolution(S, map, r, { manualD20: 21 }).error).toMatch(/1–20/);
    expect(previewResolution(S, map, r, { manualDmg: -1 }).error).toBeTruthy();
  });
  it("stages AoE saves separately per target and allows per-target corrections", () => {
    const { S, a } = setup(); S.tok.push(tok("c", 4), tok("d", 5)); a.slots = [{ max: 1, used: 0 }, { max: 1, used: 0 }, { max: 2, used: 0 }];
    const r: Resolve = { kind: "area", srcId: a.id, atk: { nazev: "Fireball", kind: "spell", lvl: 3, range: 150, save: "DEX", dc: 15, half: true, dmg: "8d6", typ: "Fire" }, spec: { shape: "sphere", size: 10, anchor: [4, 3] }, tgtIds: ["b", "c", "d"] };
    const draft = previewResolution(S, map, r, { manualDmg: 30, manualSaves: { a: 20, b: 20, c: 1, d: 1 }, targetDamage: { d: 7 } });
    expect(draft.results.filter(x => x.tokenId !== "a").map(x => x.applied)).toEqual([15, 30, 7]);
    expect(a.slots[2].used).toBe(0); expect(applyResolution(S, draft)).toBe(true); expect(S.tok[0].slots[2].used).toBe(1);
    expect(S.tok.slice(1).map(t => t.hp)).toEqual([85, 70, 93]);
  });
  it("supports empty areas without inventing targets", () => {
    const { S, a } = setup();
    const r: Resolve = { kind: "area", srcId: a.id, atk: { nazev: "Burst", kind: "feature", dmg: "1d6" }, spec: { shape: "sphere", size: 5, anchor: [25, 10] }, tgtIds: [] };
    const draft = previewResolution(S, map, r, {}); expect(draft.results).toEqual([]); expect(draft.error).toBeUndefined();
  });
  it("stages Shield through the existing reaction logic without a second attack roll", () => {
    const { S, r, b } = setup(); b.kouzla = [{ nazev: "Shield", kouzlo: "Shield", kind: "spell", lvl: 1 }]; b.slots = [{ max: 2, used: 0 }];
    const draft = previewResolution(S, map, r, { manualD20: 9, manualDmg: 10 });
    const shield = draft.reactions.find(o => o.option.nazev === "Shield")!; expect(shield).toBeTruthy();
    const protectedDraft = previewResolution(S, map, r, draft.options, draft, [shield.key]);
    expect(protectedDraft.results[0]).toMatchObject({ outcome: "miss", applied: 0 });
    expect(b.slots[0].used).toBe(0); expect(applyResolution(S, protectedDraft)).toBe(true);
    expect(S.tok[1].slots[0].used).toBe(1); expect(S.eco.b.r).toBe(1); expect(S.tok[1].hp).toBe(100);
  });
});

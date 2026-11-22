import { describe, expect, it } from "vitest";
import { custom } from "../rules/combatants";
import type { AttackDef, BattleMapData, StavBoje, Token } from "../types";
import { tokensInArea } from "../rules/areas";
import { targetStatus, targetingArea } from "./targetingModel";

const bow: AttackDef = { nazev: "Bow", kind: "weapon", range: 30, long: 90, bonus: 5, dmg: "1d6", typ: "Piercing" };
const map: BattleMapData = { id: "test", nazev: "Test", podklad: "mesto", mrizka: Array(12).fill(".............................."), osvetleni: "den" };
const token = (id: string, x: number, y = 3): Token => ({ ...custom(id, "nepratele", 100, 12), id, x, y });
const state = (...tok: Token[]): StavBoje => ({ tok, ord: tok.map(t => t.id), round: 1, turn: 0, log: [], eco: {}, zones: [], fx: [] });

describe("target legality uses the attack evaluator", () => {
  it("distinguishes normal, long/disadvantage and beyond range", () => {
    const a = token("a", 1); const b = token("b", 5); const S = state(a, b);
    expect(targetStatus(S, map, a, b, bow)).toMatchObject({ canTarget: true, longRange: false, highlighted: true });
    b.x = 10;
    expect(targetStatus(S, map, a, b, bow)).toMatchObject({ canTarget: true, longRange: true, net: -1 });
    b.x = 25;
    expect(targetStatus(S, map, a, b, bow)).toMatchObject({ canTarget: false, reason: "Mimo dostřel", highlighted: false });
  });
  it("dims a blocked line of sight and exposes half cover", () => {
    const a = token("a", 1); const b = token("b", 5); const S = state(a, b);
    const walls = Array.from({ length: 12 }, (_, y) => ({ id: `w${y}`, a: [3, y], b: [3, y + 1], typ: "wall" }));
    expect(targetStatus(S, { ...map, steny: walls } as BattleMapData, a, b, bow)).toMatchObject({ canTarget: false, cover: 9, highlighted: false });
    expect(targetStatus(S, { ...map, steny: walls.map(w => ({ ...w, typ: "half" })) } as BattleMapData, a, b, bow)).toMatchObject({ canTarget: true, cover: 2, targetAC: 14 });
  });
  it("does not highlight dead targets or creatures hidden by darkness", () => {
    const a = token("a", 1); const b = token("b", 5); const S = state(a, b);
    b.dead = true; expect(targetStatus(S, map, a, b, bow).highlighted).toBe(false);
    b.dead = false; S.lightLevel = "dark";
    expect(targetStatus(S, map, a, b, bow).highlighted).toBe(false);
  });
});

describe("cursor AoE and committed geometry match", () => {
  it("includes three monsters, footprint edges, but not dead/off-map creatures", () => {
    const source = token("source", 0, 0);
    const atk: AttackDef = { nazev: "Fireball", kind: "spell", area: { shape: "sphere", size: 20 } };
    const spec = targetingArea(source, atk, [10, 5]);
    const targets = [token("one", 9, 5), token("two", 11, 5), token("three", 10, 8), token("outside", 20, 10), { ...token("dead", 10, 5), dead: true }];
    expect(tokensInArea(spec, targets, source).map(t => t.id)).toEqual(["one", "two", "three"]);
    expect(tokensInArea(spec, [], source)).toEqual([]);
    expect(tokensInArea(spec, [{ ...token("large", 14, 5), s: 2 }], source)).toHaveLength(1);
  });
  it("rotates a line around the source, retaining the same inclusion engine", () => {
    const source = token("source", 2, 2); const east = token("east", 5, 2); const south = token("south", 2, 5);
    const atk: AttackDef = { nazev: "Line", kind: "spell", area: { shape: "line", size: 30 } };
    expect(tokensInArea(targetingArea(source, atk, [8, 2]), [east, south], source).map(t => t.id)).toEqual(["east"]);
    expect(tokensInArea(targetingArea(source, atk, [8, 2], 90), [east, south], source).map(t => t.id)).toEqual(["south"]);
  });
});

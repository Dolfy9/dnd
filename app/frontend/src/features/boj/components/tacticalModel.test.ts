import { describe, expect, it } from "vitest";
import { custom } from "../rules/combatants";
import { movementCosts, planMovement } from "../rules/movement";
import { defaultSettings } from "../rules/settings";
import type { BattleMapData, StavBoje } from "../types";
import { labelsOverlap, layoutLabels, movementOverlay, overlayState, provokingPathCells, reachCells, threatCells } from "./tacticalModel";

const map: BattleMapData = { id: "t", nazev: "t", podklad: "mesto", mrizka: Array(10).fill("............") };
function fixture() {
  const a = { ...custom("Hero", "druzina", 100, 14), id: "a", x: 2, y: 3, speed: 15 };
  const b = { ...custom("Monster", "nepratele", 100, 14), id: "b", x: 4, y: 3 };
  b.atk = [{ nazev: "Glaive", kind: "weapon" as const, melee: true, reach: 10 }];
  const S: StavBoje = { tok: [a, b], ord: [a.id, b.id], turn: 0, round: 2, eco: {}, log: [], fx: [], zones: [], nastaveni: defaultSettings() };
  return { S, a, b };
}
describe("Dijkstra tactical movement sets", () => {
  it("matches planner costs for difficult terrain, walls, diagonals and occupied endpoints", () => {
    const { S, a } = fixture(); S.teren = { "3,3": "," }; const settings = defaultSettings(); settings.pohyb.uhlopricky = "5-10";
    const walls = { ...map, steny: [{ id: "w", typ: "wall", a: [2, 3], b: [2, 4] }] } as BattleMapData;
    const costs = movementCosts(S, walls, a, 30, settings);
    expect(costs["3,3"]).toBe(10); expect(costs["4,3"]).toBeUndefined(); expect(costs["1,3"]).toBeGreaterThan(5);
    for (const [key, cost] of Object.entries(costs)) {
      const [x, y] = key.split(",").map(Number);
      expect(planMovement(S, walls, a, [], [x, y], "pravidla", settings).ft).toBe(cost);
    }
    const blocked = { ...map, mrizka: Array(10).fill("...#........") };
    expect(movementCosts({ ...S, teren: {} }, blocked, a, 60, settings)["5,3"]).toBeUndefined();
  });
  it("splits remaining movement and Dash, suppresses Dash when Action spent, without mutating state", () => {
    const { S, a } = fixture(); const before = JSON.stringify(S);
    expect(movementOverlay(S, map, a.id, true).some(c => c.dash)).toBe(true); expect(JSON.stringify(S)).toBe(before);
    planMovement(S, map, a, [], [2, 4], "pravidla", defaultSettings()); S.eco.a.moved = 10;
    const cells = movementOverlay(S, map, a.id, true);
    expect(cells.filter(c => !c.dash).every(c => c.cost <= 5)).toBe(true);
    S.eco.a.a = 1; expect(movementOverlay(S, map, a.id, true).some(c => c.dash)).toBe(false);
    a.x = null!; expect(movementOverlay(S, map, a.id, true)).toEqual([]);
  });
});
describe("reach and OA boundary/path cells", () => {
  it("uses footprint reach and marks the departure cell rather than every path cell", () => {
    const { S, a, b } = fixture();
    const cells = threatCells(S, map, a.id, true).map(p => p.join(","));
    expect(cells).toContain("2,3"); expect(cells).not.toContain("3,3");
    expect(provokingPathCells(S, a, [[3, 3], [2, 3], [1, 3]])).toEqual([1]);
    expect(reachCells(S, map, b, true).map(p => p.join(","))).toContain("2,3");
    S.eco.b = { a: 0, b: 0, r: 1 } as any;
    expect(threatCells(S, map, a.id, true)).toEqual([]); expect(provokingPathCells(S, a, [[2, 3], [1, 3]])).toEqual([]);
  });
  it("ignores dead/incapacitated reactors and Disengage", () => {
    const { S, a, b } = fixture(); b.dead = true; expect(threatCells(S, map, a.id, true)).toEqual([]);
    b.dead = false; b.cond = [{ n: "Incapacitated" }]; expect(threatCells(S, map, a.id, true)).toEqual([]);
    b.cond = []; a.effects.push({ id: "safe", nazev: "Safe", mods: { noOA: true } }); expect(threatCells(S, map, a.id, true)).toEqual([]);
  });
});
describe("player-safe overlays", () => {
  it("filters hidden/fog-covered sources and threats before computing costs; clips cells to live fog", () => {
    const { S, a, b } = fixture();
    const visible = Object.fromEntries(Array.from({ length: 10 }, (_, y) => Array.from({ length: 4 }, (_, x) => [`${x},${y}`, 1])).flat()) as Record<string, 1>;
    S.fog = { on: true, visible, revealed: { ...visible, "4,3": 1 } };
    expect(overlayState(S, false).tok.map(t => t.id)).toEqual(["a"]);
    expect(threatCells(S, map, a.id, false)).toEqual([]); expect(reachCells(S, map, b, false)).toEqual([]);
    expect(movementOverlay(S, map, b.id, false)).toEqual([]);
    expect(movementOverlay(S, map, a.id, false).every(c => visible[`${c.x},${c.y}`])).toBe(true);
    expect(movementOverlay(S, map, a.id, false).find(c => c.x === 3 && c.y === 3)?.cost).toBe(5);
    b.x = 3; b.skryty = true; expect(threatCells(S, map, a.id, false)).toEqual([]);
    expect(threatCells(S, map, a.id, true).length).toBeGreaterThan(0);
  });
});
describe("screen-space label decluttering", () => {
  it("prioritizes full hovered labels, keeps visible boxes non-overlapping at low zoom and inside mobile bounds", () => {
    const input = Array.from({ length: 20 }, (_, i) => ({ id: String(i), x: 20 + i * 4, y: 80, width: 140, height: 34, priority: i === 15 ? 3 : 0 }));
    const boxes = layoutLabels(input, 4, { left: 0, right: 390, top: 0, bottom: 500 });
    expect(boxes[0].id).toBe("15"); expect(boxes.length).toBeGreaterThan(1);
    for (const [i, a] of boxes.entries()) { expect(a.x).toBeGreaterThanOrEqual(0); expect(a.x + a.width).toBeLessThanOrEqual(390); for (const b of boxes.slice(i + 1)) expect(labelsOverlap(a, b)).toBe(false); }
    expect(layoutLabels([], 4)).toEqual([]);
    expect(layoutLabels(input, 4, { left: 0, right: 50, top: 0, bottom: 10 })).toEqual([]);
  });
});

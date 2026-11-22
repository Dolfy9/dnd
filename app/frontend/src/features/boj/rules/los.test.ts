import { expect, it } from "vitest";
import { coverOf } from "./los";
import { custom } from "./combatants";
import type { MapV2 } from "../model/mapV2";

it("terminates vertical and diagonal cover rays on maps with walls in either direction", () => {
  const map: MapV2 = { id: "rays", nazev: "Rays", podklad: "mesto", mrizka: Array(8).fill("........"), steny: [{ id: "far", a: [7, 6], b: [7, 7], typ: "wall" }] };
  const source = { ...custom("Source", "druzina", 20, 12), x: 2, y: 2 };
  for (const [x, y] of [[2, 3], [2, 1], [3, 3], [1, 1], [2, 2]]) {
    const target = { ...custom("Target", "nepratele", 20, 12), x, y };
    expect(coverOf(source, target, map, [source, target])).toBe(0);
    expect(coverOf(target, source, map, [source, target])).toBe(0);
  }
  const target = { ...custom("Target", "nepratele", 20, 12), x: 2, y: 3 };
  map.steny = [{ id: "between", a: [0, 3], b: [8, 3], typ: "door" }];
  expect(coverOf(source, target, map, [source, target], undefined, undefined, undefined, { between: false })).toBe(9);
  expect(coverOf(source, target, map, [source, target], undefined, undefined, undefined, { between: true })).toBe(0);
});

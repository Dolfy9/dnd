import { expect, it } from "vitest";
import { migrate } from "./migrate";
import { lightAt } from "./lighting";
import type { MapV2 } from "../model/mapV2";

it("lights the facing side of an angled wall from a point source on the wall, not the back", () => {
  const map: MapV2 = { id: "m", nazev: "M", podklad: "jine", mrizka: Array(7).fill("......."),
    steny: [{ id: "wall", a: [1, 1], b: [5, 5], typ: "wall" }],
    svetla: [{ id: "lamp", x: 3, y: 3, bright: 20, dim: 0, smer: 0 }] };
  const S = migrate({ lightLevel: "dark" });
  expect(lightAt(S, map, 4, 2)).toBe("bright");
  expect(lightAt(S, map, 2, 4)).toBe("dark");
  const reversedWall = { ...map, steny: map.steny!.map(w => ({ ...w, a: w.b, b: w.a })) };
  expect(lightAt(S, reversedWall, 4, 2)).toBe("bright");
  expect(lightAt(S, reversedWall, 2, 4)).toBe("dark");
  const reversed = { ...map, svetla: map.svetla!.map(l => ({ ...l, smer: 180 })) };
  expect(lightAt(S, reversed, 2, 4)).toBe("bright");
  expect(lightAt(S, reversed, 4, 2)).toBe("dark");
  expect(lightAt(S, { ...map, steny: [] }, 2, 4)).toBe("bright");
  expect(lightAt(S, { ...map, svetla: [] }, 4, 2)).toBe("dark");
  for (const typ of ["window", "half"] as const) {
    expect(lightAt(S, { ...map, steny: map.steny!.map(w => ({ ...w, typ })) }, 2, 4)).toBe("bright");
  }
  const doorMap = { ...map, steny: map.steny!.map(w => ({ ...w, typ: "door" as const })) };
  expect(lightAt({ ...S, dvere: { wall: true } }, doorMap, 2, 4)).toBe("bright");
  expect(lightAt({ ...S, dvere: { wall: false } }, doorMap, 2, 4)).toBe("dark");
});

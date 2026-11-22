import { expect, it } from "vitest";
import { migrate } from "../rules/migrate";
import { lightAt } from "../rules/lighting";
import type { MapV2 } from "./mapV2";

it("casts object point light from its exact position on the correct side of a wall", () => {
  const S = migrate({ lightLevel: "dark" });
  const map: MapV2 = { id: "m", nazev: "M", podklad: "jine", mrizka: Array(5).fill("....."),
    steny: [{ id: "wall", a: [3, 0], b: [3, 5], typ: "wall" }],
    objekty: [{ id: "torch", asset: "custom", x: 2.8, y: 2.5, w: 1, h: 1, light: { bright: 10, dim: 0 } }] };
  expect(lightAt(S, map, 2, 2)).toBe("bright");
  expect(lightAt(S, map, 3, 2)).toBe("dark");
  const clear = { ...map, steny: [] };
  expect(lightAt(S, clear, 3, 2)).toBe("bright");
  expect(lightAt(S, { ...clear, objekty: [] }, 2, 2)).toBe("dark");
  const right = { ...map, objekty: map.objekty!.map(o => ({ ...o, x: 3.2 })) };
  expect(lightAt(S, right, 3, 2)).toBe("bright");
  expect(lightAt(S, right, 2, 2)).toBe("dark");
});

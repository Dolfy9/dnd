import { expect, it } from "vitest";
import { migrate } from "../rules/migrate";
import { cmdRemoveLight } from "../state/commands/tools";
import { lightAt } from "../rules/lighting";
import { mechanicalLights, sourceMap } from "./sourceState";
import type { MapV2 } from "./mapV2";

it("removing a seeded map light suppresses mechanical and visual light after reload", () => {
  const map: MapV2 = { id: "m", nazev: "M", podklad: "jine", mrizka: ["...."],
    svetla: [{ id: "map-light", x: 1, y: 0, bright: 10, dim: 0 }] };
  const S = migrate({ lightLevel: "dark", lights: [{ id: "map-light", anchor: [1, 0], bright: 10, dim: 0 }] });
  expect(lightAt(S, map, 1, 0)).toBe("bright");
  cmdRemoveLight(S, "map-light");
  expect(S.lights).toEqual([]);
  expect(mechanicalLights(S, map)).toEqual([]);
  expect(lightAt(S, map, 1, 0)).toBe("dark");
  const saved = migrate(JSON.parse(JSON.stringify(S)));
  expect(lightAt(saved, map, 1, 0)).toBe("dark");
  expect(sourceMap(map, saved.zdroje).svetla![0].zap).toBe(false);
  cmdRemoveLight(saved, "missing");
  expect(lightAt(saved, { ...map, svetla: [] }, 1, 0)).toBe("dark");
});

import { expect, it } from "vitest";
import { updateLightState } from "./lightState";
import { lightAt } from "../rules/lighting";
import { migrate } from "../rules/migrate";
import type { MapV2 } from "./mapV2";

it("preserves anonymous cell illumination through a secret light toggle and door changes", () => {
  const map: MapV2 = { id: "m", nazev: "M", podklad: "jine", mrizka: ["...."],
    steny: [{ id: "door", a: [2, 0], b: [2, 1], typ: "door" }],
    svetla: [{ id: "secret", x: .5, y: .5, bright: 20, dim: 0, dmOnly: true }] };
  const S = migrate({ lightLevel: "dark" });
  updateLightState(S, map);
  expect(S.lightCells).toEqual({ "0,0": "bright", "1,0": "bright", "2,0": "dark", "3,0": "dark" });
  const player = { ...S, lights: [], playerLightCells: S.lightCells };
  expect(lightAt(player, { ...map, svetla: [] }, 0, 0)).toBe("bright");
  S.dvere = { door: true }; updateLightState(S, map);
  expect(S.lightCells!["3,0"]).toBe("bright");
  S.zdroje = { secret: false }; updateLightState(S, map);
  expect(Object.values(S.lightCells!)).toEqual(["dark", "dark", "dark", "dark"]);
  updateLightState(S, { ...map, svetla: [] });
  expect(S.lightCells).toBeUndefined();
  expect(S.privateSourceIds).toEqual([]);
  expect(lightAt({ ...S, playerLightCells: { "0,0": "invalid" as any } }, { ...map, svetla: [] }, 0, 0)).toBe("dark");
});

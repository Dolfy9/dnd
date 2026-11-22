import { afterEach, expect, it, vi } from "vitest";
import { fogMemoryMap, fogPlayerState, fogState, mapCells, normalizeFog, updateFog } from "./fog";
import { FogRaster } from "./fogRaster";
import { migrate } from "../rules/migrate";
import { cmdFogAll, cmdFogCells, cmdFogReset, cmdFogToggle } from "../state/commands/tools";
import { toggleSource } from "../state/commands/sources";
import type { MapV2 } from "./mapV2";

const map: MapV2 = { id: "m", nazev: "M", podklad: "jine", mrizka: Array(5).fill("........"),
  steny: [{ id: "door", a: [3, 0], b: [3, 5], typ: "door" }],
  interiery: [{ id: "room", poly: [[3, 0], [8, 0], [8, 5], [3, 5]] }] };
const state = () => migrate({ lightLevel: "bright", fog: { on: true, revealed: {} }, tok: [
  { id: "hero", side: "druzina", x: 1, y: 2, s: 1 }, { id: "enemy", side: "nepratele", x: 6, y: 2, s: 1 }] });

it("accumulates exploration through doors without revealing an entire room, then preserves only memory", () => {
  const S = state(); updateFog(S, map);
  expect(fogState(S.fog, 2, 2)).toBe("visible");
  expect(fogState(S.fog, 4, 2)).toBe("unknown");
  S.dvere = { door: true }; updateFog(S, map);
  expect(fogState(S.fog, 6, 2)).toBe("visible");
  S.dvere.door = false; updateFog(S, map);
  expect(fogState(S.fog, 6, 2)).toBe("memory");
  expect(fogPlayerState(S).tok.map(t => t.id)).toEqual(["hero"]);
  const partial: MapV2 = { ...map, steny: [{ id: "divider", a: [5, 0], b: [5, 5], typ: "wall" }] };
  const T = state(); T.tok[0].x = 3; updateFog(T, partial);
  expect(fogState(T.fog, 4, 2)).toBe("visible");
  expect(fogState(T.fog, 6, 2)).toBe("unknown");
  T.tok[0].x = 6; updateFog(T, partial);
  expect(fogState(T.fog, 4, 2)).toBe("memory");
  expect(fogState(T.fog, 6, 2)).toBe("visible");
  expect(migrate(JSON.parse(JSON.stringify(T))).fog).toEqual(T.fog);
});

it("uses light, source toggles, darkvision, opaque terrain and hedge walls", () => {
  const S = state(); S.lightLevel = "dark";
  const lit = { ...map, steny: [], svetla: [{ id: "light", x: 1.5, y: 2.5, bright: 30, dim: 0 }] };
  updateFog(S, lit); expect(fogState(S.fog, 4, 2)).toBe("visible");
  toggleSource(S, lit, "light", true); updateFog(S, lit);
  expect(fogState(S.fog, 4, 2)).toBe("memory");
  S.tok[0].smysly = ["Darkvision 60 ft"]; updateFog(S, lit);
  expect(fogState(S.fog, 4, 2)).toBe("visible");
  const blocked = { ...map, steny: [], mrizka: Array(5).fill("...#....") };
  updateFog(S, blocked); expect(fogState(S.fog, 5, 2)).toBe("memory");
  const hedge = { ...map, steny: [], trasy: [{ id: "hedge", druh: "plot" as const, pts: [[3, 0], [3, 5]] as [number, number][], sirka: 1, hladke: false }] };
  const T = state(); updateFog(T, hedge);
  expect(fogState(T.fog, 5, 2)).toBe("unknown");
});

it("supports persistent GM room/cell overrides, reveal-all, reset and legacy fog defaults", () => {
  const S = state(); const room = mapCells(map, map.interiery![0].poly);
  cmdFogCells(S, room, true); updateFog(S, map);
  expect(fogState(S.fog, 6, 2)).toBe("visible");
  cmdFogCells(S, room, false); S.dvere = { door: true }; updateFog(S, map);
  expect(fogState(S.fog, 6, 2)).toBe("unknown");
  cmdFogCells(S, [[-1, 0], [NaN, 0], [1.1, 1]], true);
  expect(Object.keys(S.fog!.manual!)).toEqual([]);
  cmdFogAll(S, map); expect(Object.keys(S.fog!.visible!)).toHaveLength(40);
  S.dvere.door = false; cmdFogReset(S, map);
  expect(fogState(S.fog, 6, 2)).toBe("unknown");
  cmdFogToggle(S, false); expect(fogState(S.fog, 6, 2)).toBe("visible");
  expect(migrate({}).fog).toBeUndefined(); expect(normalizeFog(null)).toBeUndefined();
  expect(normalizeFog({ on: true, revealed: { "1,2": true, "-1,0": 1, nope: 1 } })?.revealed).toEqual({ "1,2": 1 });
  const empty = migrate({ fog: { on: true, revealed: {} } }); updateFog(empty, { ...map, mrizka: [] });
  expect(empty.fog?.visible).toEqual({});
});

afterEach(() => vi.unstubAllGlobals());
it("updates raster cells only when their visibility changes and removes live sources from memory", () => {
  const draw = vi.fn(), encode = vi.fn(() => "data:image/png;base64,AA==");
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ clearRect: draw, fillRect: draw }), toDataURL: encode }) });
  const raster = new FogRaster(2, 1), fog = { on: true, revealed: { "0,0": 1 as const }, visible: {} };
  expect(raster.update(fog).changed).toBe(2);
  expect(raster.update(fog).changed).toBe(0); expect(encode).toHaveBeenCalledTimes(4);
  fog.visible = { "0,0": 1 }; expect(raster.update(fog).changed).toBe(1);
  const memory = fogMemoryMap({ ...map, svetla: [{ id: "l", x: 1, y: 1, bright: 10, dim: 0 }],
    objekty: [{ id: "effect", asset: "e-svetlusky", x: 1, y: 1, w: 1, h: 1 }, { id: "crate", asset: "bedna", x: 1, y: 1, w: 1, h: 1 }] });
  expect(memory.svetla).toEqual([]); expect(memory.objekty?.every(o => o.anim === false)).toBe(true);
});

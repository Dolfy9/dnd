import { expect, it } from "vitest";
import { roomPolygon, rectanglePoints } from "./ops";
import type { MapV2 } from "../../boj/model/mapV2";

it("makes only polygon-floor cell centers walkable, including rotated rectangles", () => {
  const map: MapV2 = { id:"r", nazev:"R", podklad:"mesto", mrizka:Array(6).fill("######") };
  roomPolygon(map, [[1,1],[5,1],[1,5]], "drevo");
  expect(map.mrizka[1]).toBe("#...##");
  expect(map.mrizka[2]).toBe("#..###");
  expect(map.mrizka[0]).toBe("######");
  expect(map.malba).toHaveLength(1);
  const rotated = { ...map, mrizka:Array(6).fill("######") };
  roomPolygon(rotated, rectanglePoints([1,2],[5,4],45), "drevo");
  expect(rotated.mrizka[2][2]).toBe(".");
  expect(rotated.mrizka[0][0]).toBe("#");
  const wallsOnly = { ...map, mrizka:Array(6).fill("######") };
  roomPolygon(wallsOnly, [[1,1],[5,1],[1,5]]);
  roomPolygon(wallsOnly, [], "drevo");
  expect(wallsOnly.mrizka).toEqual(Array(6).fill("######"));
});

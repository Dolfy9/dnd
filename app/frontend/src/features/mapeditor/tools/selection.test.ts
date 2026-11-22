import { expect, it } from "vitest";
import { rotateSel } from "./ops";
import type { MapV2 } from "../../boj/model/mapV2";

it("ignores an undone insertion on keyboard and wheel rotation", () => {
  const map: MapV2 = { id:"s", nazev:"S", podklad:"mesto", mrizka:[".."] };
  const selection = [{ kind:"objekt", id:"undone" }];
  rotateSel(map, selection, -15);
  map.objekty = [];
  rotateSel(map, selection, 15);
  expect(map.objekty).toEqual([]);
  map.objekty.push({ id:"undone", asset:"stul", x:1, y:1, w:1, h:1 });
  rotateSel(map, selection, 15);
  rotateSel(map, selection, -1);
  expect(map.objekty[0].rot).toBe(14);
  rotateSel(map, [{ kind:"stena", id:"undone" }], 15);
  expect(map.objekty[0].rot).toBe(14);
});

import { expect, it } from "vitest";
import { importUvtt, type UvttDoc } from "./uvtt";
import { migrateMap, wallBlocksMove, wallBlocksSight } from "../../boj/model/mapV2";

it("keeps every imported door segment open through migration", () => {
  const base: UvttDoc = { resolution:{map_size:{x:6,y:6},pixels_per_grid:150},
    line_of_sight:[[{x:0,y:0},{x:0,y:4}]] };
  for (const closed of [false,true,undefined]) {
    const imported = importUvtt({...base,portals:[{position:{x:2,y:2},
      bounds:[{x:1,y:1},{x:3,y:3},{x:4,y:3}],closed}]});
    const map = migrateMap({id:"u",nazev:"U",podklad:"mesto",...imported});
    const doors = map.steny!.filter(w => w.typ === "door");
    expect(doors.length).toBeGreaterThan(1);
    for (const door of doors) {
      expect(door.open).toBe(closed === false);
      expect(door.locked).toBe(!!closed);
      expect(wallBlocksMove(door,undefined)).toBe(closed !== false);
      expect(wallBlocksSight(door,undefined)).toBe(closed !== false);
    }
    const emptyPortal = importUvtt({...base,portals:[{position:{x:0,y:0},bounds:[],closed:false}]});
    expect(emptyPortal.steny!.every(w => w.open === undefined)).toBe(true);
  }
  expect(importUvtt({resolution:base.resolution}).steny).toEqual([]);
});

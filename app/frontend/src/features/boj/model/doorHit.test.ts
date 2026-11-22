import { expect, it } from "vitest";
import { doorAt } from "./doorHit";
import type { MapWall } from "./mapV2";

it("hits the far end of visible straight and angled open leaves using battle overrides", () => {
  for (const b of [[5, 2], [5, 5], [2, 5], [-1, 2]] as [number, number][]) {
    const w: MapWall = { id: "door", a: [2, 2], b, typ: "door" };
    const angle = Math.atan2(b[1] - 2, b[0] - 2) - 85 * Math.PI / 180;
    const length = Math.hypot(b[0] - 2, b[1] - 2), x = 2 + Math.cos(angle) * length * .9, y = 2 + Math.sin(angle) * length * .9;
    expect(doorAt([w], x, y, { door: true })?.id).toBe("door");
    expect(doorAt([{ ...w, open: true }], x, y)?.id).toBe("door");
    expect(doorAt([{ ...w, open: true }], x, y, { door: false })).toBeUndefined();
    expect(doorAt([w], (2 + b[0]) / 2, (2 + b[1]) / 2)?.id).toBe("door");
  }
  expect(doorAt([], 0, 0)).toBeUndefined();
  expect(doorAt([{ id: "wall", a: [0, 0], b: [3, 0], typ: "wall" }], 1, 0)).toBeUndefined();
});

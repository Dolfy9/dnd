import { expect, it } from "vitest";
import { migrate } from "../rules/migrate";
import { cmdFogCells } from "../state/commands/tools";

it("removes manually hidden cells from both exploration and current visibility", () => {
  const S = migrate({ fog: { on: true, revealed: { "0,0": 1 }, visible: { "0,0": 1 } } });
  cmdFogCells(S, [[0, 0]], false);
  expect(S.fog?.revealed["0,0"]).toBeUndefined();
  expect(S.fog?.visible?.["0,0"]).toBeUndefined();
});

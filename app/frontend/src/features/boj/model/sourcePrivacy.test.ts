import { expect, it } from "vitest";
import { migrate } from "../rules/migrate";
import { toggleSource } from "../state/commands/sources";
import type { MapV2 } from "./mapV2";

it("keeps hidden object and standalone-light toggle logs GM-only", () => {
  for (const dmOnly of [true, false]) {
    const light = { id: "light", x: 1, y: 1, bright: 10, dim: 0, dmOnly };
    const map: MapV2 = { id: "m", nazev: "M", podklad: "jine", mrizka: ["..."],
      objekty: [{ id: "torch", asset: "gen2-pochoden", x: 1, y: 1, w: 1, h: 1, dmOnly }], svetla: [light] };
    for (const id of ["torch", "light"]) {
      const S = migrate({}); toggleSource(S, map, id, true);
      expect(S.log).toHaveLength(1);
      expect(!!S.log[0].pj).toBe(dmOnly);
      const count = S.log.length;
      toggleSource(S, map, id, false); toggleSource(S, map, "missing", true);
      expect(S.log).toHaveLength(count);
    }
  }
});

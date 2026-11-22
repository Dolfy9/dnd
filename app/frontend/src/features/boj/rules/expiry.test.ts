import { describe, expect, it } from "vitest";
import type { ActiveEffect, StavBoje } from "../types";
import { custom } from "./combatants";
import { advanceTurn, endOfTurnProcess, startOfTurnProcess } from "./turn";
import { defaultSettings } from "./settings";
import { migrate } from "./migrate";
import { untilNextTurn } from "./effects";
import { cmdAttack } from "../state/commands/combat";

const setup = () => {
  const source = { ...custom("Source", "druzina", 100, 10), id: "source" };
  const target = { ...custom("Target", "druzina", 100, 10), id: "target" };
  const other = { ...custom("Other", "druzina", 100, 10), id: "other" };
  const s: StavBoje = { tok: [source, target, other], ord: [source.id, target.id, other.id], turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], nastaveni: defaultSettings() };
  return { source, target, other, s };
};
const effect = (kind: "startOf" | "endOf", rounds = 1): ActiveEffect => ({
  id: "e", nazev: "Bound", src: "source", duration: { kind, who: "source", rounds }, mods: {},
});

describe("source-turn effect expiry", () => {
  it.each(["sap", "slow"])("keeps %s until the source's next turn, not the target's start", mastery => {
    const { source, target, s } = setup(); source.x = 0; source.y = 0; target.x = 1; target.y = 0;
    const result = cmdAttack(s, { atkId: source.id, tgtId: target.id, atk: { ...source.atk[0], bonus: 20, mastery }, manualD20: 15, manualDmg: 1 },
      { map: { id: "m", nazev: "M", podklad: "mesto", mrizka: [".....", "....."] } });
    expect(result.ok).toBe(true); expect(target.effects).toHaveLength(1);
    startOfTurnProcess(s, target); expect(target.effects).toHaveLength(1);
    startOfTurnProcess(s, source); expect(target.effects).toHaveLength(0);
  });
  it.each(["startOf", "endOf"] as const)("expires %s effects across actors, never on the target or a different source", kind => {
    const { source, target, other, s } = setup();
    target.effects = [effect(kind), { ...effect(kind), id: "other", duration: { kind, who: other.id } }];
    startOfTurnProcess(s, target); endOfTurnProcess(s, target);
    expect(target.effects).toHaveLength(2);
    const process = kind === "startOf" ? startOfTurnProcess : endOfTurnProcess;
    const wrongPhase = kind === "startOf" ? endOfTurnProcess : startOfTurnProcess;
    wrongPhase(s, source); expect(target.effects).toHaveLength(2);
    const messages = process(s, source);
    expect(target.effects.map(e => e.id)).toEqual(["other"]);
    expect(messages.join(" ")).toContain("Target: efekt Bound skončil");
  });
  it("keeps 'until end of your next turn' through the current end and intervening actors", () => {
    const { target, s } = setup(); target.effects = [{ ...effect("endOf"), duration: untilNextTurn(s, "source", "end") }];
    advanceTurn(s); expect(target.effects).toHaveLength(1);
    advanceTurn(s); advanceTurn(s); expect(target.effects).toHaveLength(1);
    advanceTurn(s); expect(target.effects).toHaveLength(0);
  });
  it("expires at the next boundary when applied outside the source's turn", () => {
    const { source, target, s } = setup(); s.turn = 1;
    target.effects = [{ ...effect("endOf"), duration: untilNextTurn(s, source.id, "end") }];
    endOfTurnProcess(s, target); expect(target.effects).toHaveLength(1);
    endOfTurnProcess(s, source); expect(target.effects).toHaveLength(0);
  });
  it("does not age round durations on someone else's turn and cleans source-tagged conditions", () => {
    const { source, target, s } = setup();
    target.effects = [{ ...effect("startOf"), mods: { grantsCond: "Restrained" } },
      { id: "rounds", nazev: "Rounds", duration: { kind: "rounds", rounds: 2 }, mods: {} }];
    target.cond = [{ n: "Restrained", src: source.id }, { n: "Restrained", src: "other" }];
    startOfTurnProcess(s, source);
    expect(target.effects).toHaveLength(1); expect(target.effects[0].duration?.rounds).toBe(2);
    expect(target.cond).toEqual([{ n: "Restrained", src: "other" }]);
    startOfTurnProcess(s, target); expect(target.effects[0].duration?.rounds).toBe(1);
  });
  it("expires source-bound zones and preserves their duration through migration", () => {
    const { source, target, s } = setup();
    s.zones = [{ id: "z", nazev: "Zone", style: "fire", shape: { kind: "sphere", size: 5 }, anchor: [0, 0], src: source.id, duration: { kind: "endOf", who: source.id } }];
    const restored = migrate(JSON.parse(JSON.stringify(s)));
    expect(restored.zones[0].duration).toEqual(s.zones[0].duration);
    endOfTurnProcess(restored, restored.tok.find(t => t.id === target.id)!); expect(restored.zones).toHaveLength(1);
    endOfTurnProcess(restored, restored.tok.find(t => t.id === source.id)!); expect(restored.zones).toHaveLength(0);
  });
  it("accepts empty effect and zone collections", () => {
    const { source, s } = setup();
    expect(startOfTurnProcess(s, source)).toEqual([]); expect(endOfTurnProcess(s, source)).toEqual([]);
  });
});

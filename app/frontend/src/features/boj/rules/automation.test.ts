import { afterEach, describe, expect, it, vi } from "vitest";
import type { StavBoje, Token } from "../types";
import { custom } from "./combatants";
import { defaultSettings } from "./settings";
import { cmdAttack, cmdArea, cmdDamage } from "../state/commands/combat";
import { triggerZone } from "../state/commands/move";

let nextId = 0;
const token = (o: Partial<Token> = {}): Token => ({ ...custom("T", "druzina", 2000, 10), id: `t${nextId++}`, ...o });
const state = (...tok: Token[]): StavBoje => ({
  tok, ord: tok.map(t => t.id), turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], nastaveni: defaultSettings(),
});
afterEach(() => vi.restoreAllMocks());

describe("automatic concentration", () => {
  it("fails the CON save and removes linked effects and zones, but not another caster's", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const a = token({ id: "a", conc: "Bless" });
    const b = token({ cond: [{ n: "Restrained", src: a.id }, { n: "Restrained", src: "other" }], effects: [
      { id: "linked", nazev: "Bless", src: a.id, conc: "Bless", mods: { grantsCond: "Restrained" } },
      { id: "other", nazev: "Bless", src: "other", conc: "Bless", mods: {} },
    ] });
    const s = state(a, b);
    s.zones = [{ id: "z", nazev: "Bless", src: a.id, conc: "Bless", shape: { kind: "sphere", size: 5 }, anchor: [0, 0] }];
    cmdDamage(s, a.id, 8, "Fire");
    expect(a.conc).toBe(false);
    expect(b.effects.map(e => e.id)).toEqual(["other"]);
    expect(b.cond).toEqual([{ n: "Restrained", src: "other" }]);
    expect(s.zones).toEqual([]);
    expect(s.log.some(l => l.typ === "save" && /CON.*DC 10.*neúspěch/.test(l.t))).toBe(true);
  });
  it.each([[8, 10], [45, 22], [100, 30]])("logs successful CON save for %i damage at DC %i", (damage, dc) => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const a = token({ conc: "Bless", saves: { CON: 15 } });
    const s = state(a);
    cmdDamage(s, a.id, damage, "Fire");
    expect(a.conc).toBe("Bless");
    expect(s.log.some(l => l.typ === "save" && l.t.includes(`DC ${dc}`) && /úspěch/.test(l.t))).toBe(true);
  });
  it.each(["vypnuto", "zeptat"] as const)("only logs DC when concentration is %s", mode => {
    const a = token({ conc: "Bless" }); const s = state(a);
    s.nastaveni!.automatizace.concentration = mode;
    cmdDamage(s, a.id, 25, "Fire");
    expect(a.conc).toBe("Bless");
    expect(s.log.some(l => l.t.includes("Concentration DC 12"))).toBe(true);
    expect(s.log.some(l => l.typ === "save")).toBe(false);
  });
  it("does not roll for zero damage or immunity", () => {
    const a = token({ conc: "Bless", imunity: ["Fire"] }); const s = state(a);
    cmdDamage(s, a.id, 0, "Cold"); cmdDamage(s, a.id, 50, "Fire");
    expect(a.conc).toBe("Bless"); expect(s.log.some(l => /Concentration/.test(l.t))).toBe(false);
  });
  it("checks concentration even when temp HP absorbs zone damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const a = token({ conc: "Bless", tmp: 50 }); const s = state(a);
    triggerZone(s, a, { id: "z", nazev: "Fire", shape: { kind: "sphere", size: 5 }, anchor: [0, 0], trigger: { on: "enter", dmg: { dice: "10", typ: "Fire" } } }, "enter");
    expect(a.hp).toBe(2000); expect(a.conc).toBe(false);
  });
  it.each([false, true])("handles concentration through attack/area commands (area=%s)", area => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const a = token({ x: 0, y: 0 }); const b = token({ x: 1, y: 0, conc: "Bless" }); const s = state(a, b);
    const ctx = { map: { id: "m", nazev: "M", podklad: "mesto", mrizka: [".....", "....."] } };
    const atk = { nazev: "Fire", range: 30, bonus: 10, dmg: "8", typ: "Fire" };
    const result = area
      ? cmdArea(s, { srcId: a.id, atk, spec: { shape: "sphere", size: 5, anchor: [1, 0] } }, ctx)
      : cmdAttack(s, { atkId: a.id, tgtId: b.id, atk, manualD20: 15, manualDmg: 8 }, ctx);
    expect(result.ok).toBe(true); expect(b.conc).toBe(false);
  });
});

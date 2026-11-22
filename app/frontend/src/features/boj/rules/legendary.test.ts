import { describe, expect, it } from "vitest";
import type { AttackDef, StavBoje, Token } from "../types";
import { custom } from "./combatants";
import { monsterAttacks, parseMonsterAction } from "./parse";
import { advanceTurn, ecoOf, startOfTurnProcess } from "./turn";
import { cmdAttack, cmdArea } from "../state/commands/combat";
import { defaultSettings } from "./settings";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ActorPanel from "../components/ActorPanel";
import InitiativeBar from "../components/InitiativeBar";

const ctx = { map: { id: "m", nazev: "M", podklad: "mesto", mrizka: [".....", "....."] } };
const text = "Melee Attack Roll: +10, reach 5 ft. Hit: 4 (1d6) Slashing damage.";
const setup = () => {
  const a = { ...custom("A", "druzina", 100, 10), id: "a", x: 0, y: 0 };
  const b = { ...custom("B", "nepratele", 100, 10), id: "b", x: 1, y: 0, legendary: { max: 3, used: 0, resist: { max: 2, used: 1 } } };
  b.atk = [parseMonsterAction("Claw (Costs 2 Actions)", text, "legendary")];
  const c = { ...custom("C", "druzina", 100, 10), id: "c", x: 2, y: 0 };
  const s: StavBoje = { tok: [a, c, b], ord: [a.id, c.id, b.id], turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], nastaveni: defaultSettings() };
  const attack = (atk: AttackDef = b.atk[0]) => cmdAttack(s, { atkId: b.id, tgtId: a.id, atk, manualD20: 15, manualDmg: 4 }, ctx);
  return { a, b, c, s, attack };
};

describe("legendary actions", () => {
  it("imports a separate legendary cost, not a reaction", () => {
    const attacks = monsterAttacks({ nazev: "M", cr: "10", typ: "Dragon", velikost: "Large", ac: 10, hp: 100,
      reakce: [{ nazev: "Parry", text }], legendarni: [{ nazev: "Claw (Costs 2 Actions)", text }, { nazev: "Tail", text }] });
    expect(attacks[0].rea).toBe(true);
    expect(attacks[1]).toMatchObject({ legendaryCost: 2 }); expect(attacks[1].rea).not.toBe(true);
    expect(attacks[2]).toMatchObject({ legendaryCost: 1 });
  });
  it("only opens a window at another creature's turn end, before the next turn starts", () => {
    const { a, b, c, s, attack } = setup();
    expect(attack().ok).toBe(false);
    advanceTurn(s);
    expect(s.turn).toBe(0); expect(s.legendaryWindow).toMatchObject({ actorId: a.id });
    expect(s.eco[c.id]).toBeUndefined();
    expect(attack().ok).toBe(true); expect(b.legendary.used).toBe(2);
    expect(b.react).toBe(true); expect(s.eco[b.id]?.r ?? 0).toBe(0); expect(s.eco[b.id]?.a ?? 0).toBe(0);
    expect(attack().ok).toBe(false);
    advanceTurn(s); expect(s.turn).toBe(1); expect(s.legendaryWindow).toBeUndefined();
    expect(attack().ok).toBe(false);
  });
  it("rejects insufficient pool, incapacitated/dead owners and own-turn use", () => {
    const { b, s, attack } = setup();
    advanceTurn(s);
    b.legendary.used = 2; expect(attack().ok).toBe(false);
    b.legendary.used = 0; b.cond = [{ n: "Incapacitated" }]; expect(attack().ok).toBe(false);
    b.cond = []; b.dead = true; expect(attack().ok).toBe(false);
    b.dead = false; s.turn = 2; expect(attack().ok).toBe(false);
    expect(b.legendary.used).toBe(0);
  });
  it("resets N uses only at the owner's start, not round rollover or lazy economy initialization", () => {
    const { b, s } = setup(); b.legendary.used = 2;
    ecoOf(s, b); expect(b.legendary.used).toBe(2);
    startOfTurnProcess(s, s.tok[0]); expect(b.legendary.used).toBe(2);
    startOfTurnProcess(s, b); expect(b.legendary.used).toBe(0);
    expect(b.legendary.resist.used).toBe(1);
  });
  it("does not pause encounters without available legendary actions", () => {
    const { b, s } = setup(); b.legendary.used = 3;
    advanceTurn(s); expect(s.turn).toBe(1); expect(s.legendaryWindow).toBeUndefined();
    const empty: StavBoje = { ...s, tok: [], ord: [], turn: 0 };
    expect(() => advanceTurn(empty)).not.toThrow();
  });
  it("does not skip the next actor when a legendary action kills the ending actor", () => {
    const { a, s, attack } = setup(); a.kind = "mon"; a.hp = 1;
    advanceTurn(s); expect(attack().ok).toBe(true); expect(a.dead).toBe(true);
    advanceTurn(s); expect(s.ord[s.turn]).toBe("c"); expect(s.round).toBe(1);
  });
  it("spends legendary pool for area actions, never action/reaction", () => {
    const { b, s } = setup(); advanceTurn(s);
    const atk = { ...b.atk[0], save: "DEX" as const, dc: 30 };
    const result = cmdArea(s, { srcId: b.id, atk, spec: { shape: "sphere", size: 5, anchor: [0, 0] }, manualDmg: 4 }, ctx);
    expect(result.ok).toBe(true); expect(b.legendary.used).toBe(2);
    expect(s.eco[b.id]?.a ?? 0).toBe(0); expect(s.eco[b.id]?.r ?? 0).toBe(0);
  });
  it("allows the window immediately before the owner's turn, despite a spent reaction", () => {
    const { b, s, attack } = setup(); s.turn = 1; b.react = false;
    b.atk[0] = { ...b.atk[0], legendaryCost: 1 };
    advanceTurn(s); expect(s.turn).toBe(1);
    expect(attack().ok).toBe(true); expect(b.legendary.used).toBe(1); expect(b.react).toBe(false);
    advanceTurn(s); expect(s.turn).toBe(2); expect(b.legendary.used).toBe(0);
    b.legendary.used = 2;
    advanceTurn(s); expect(s.round).toBe(2); expect(b.legendary.used).toBe(2);
  });
  it("renders a separate pool, unavailable outside the window, and a continue control", () => {
    const { b, s } = setup();
    const panel = () => renderToStaticMarkup(createElement(ActorPanel, {
      S: s, t: b, dm: true, targeting: null, onAttack: () => {}, onStdAction: () => {}, onResource: () => {},
    }));
    expect(panel()).toMatch(/Legendární · 3\/3/);
    expect(panel()).toMatch(/class="boj-atk off[^>]*disabled=""/);
    advanceTurn(s);
    expect(panel()).not.toMatch(/class="boj-atk off[^>]*disabled=""/);
    const bar = renderToStaticMarkup(createElement(InitiativeBar, {
      S: s, sel: b.id, dm: true, onSelect: () => {}, onNext: () => {}, onRoll: () => {}, onUndo: () => {}, onRedo: () => {},
      canUndo: false, canRedo: false, saving: false,
    }));
    expect(bar).toContain("Pokračovat");
  });
});

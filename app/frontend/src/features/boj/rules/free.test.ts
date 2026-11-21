/* Volný režim — jediná brána isFree(S); žádné OA, ekonomika, sloty, triggery. */
import { describe, it, expect } from "vitest";
import { isFree } from "./free";
import { useEco } from "./turn";
import { moveToken } from "../state/commands/move";
import { cmdAttack } from "../state/commands/combat";
import { advanceTurn } from "./turn";
import { mkTok } from "./rules.test";
import type { StavBoje, BattleMapData, Token } from "../types";

const mkMap = (rows: string[]): BattleMapData =>
  ({ id: "t", nazev: "t", podklad: "mesto", mrizka: rows });
const FLAT = mkMap(Array.from({ length: 8 }, () => ".........."));
const CTX = { map: FLAT };
const mkS = (tok: Token[], extra: Partial<StavBoje> = {}): StavBoje =>
  ({ tok, ord: tok.map((t) => t.id), turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], ...extra });
const FREE = { rezim: "volny" } as any;

describe("isFree", () => {
  it("pozná volný režim z nastavení", () => {
    expect(isFree(mkS([]))).toBe(false);
    expect(isFree(mkS([], { nastaveni: FREE }))).toBe(true);
  });
});

describe("volný pohyb", () => {
  it("táhne kamkoliv bez nákladu a bez zónových triggerů", () => {
    const t = mkTok({ id: "a", x: 0, y: 0 });
    const S = mkS([t], { nastaveni: FREE, zones: [{ id: "z", shape: { kind: "rect", x: 2, y: 0, w: 2, h: 2 }, trigger: { on: "enter", eff: { nazev: "Z", dur: "turn" } } } as any] });
    moveToken(S, "a", 2, 0);
    expect(t.x).toBe(2);
    expect(t.effects.length).toBe(0);          // žádný enter trigger
    expect(S.eco["a"]?.moved ?? 0).toBe(0);      // žádný náklad pohybu
    expect(S.log.some((l) => l.t.includes("voln"))).toBe(true);
  });
});

describe("volná ekonomika", () => {
  it("useEco je v režimu no-op", () => {
    const t = mkTok({ id: "a" });
    const S = mkS([t], { nastaveni: FREE });
    useEco(S, t, "a"); useEco(S, t, "b"); useEco(S, t, "r");
    expect(S.eco["a"]?.a ?? 0).toBe(0);        // nic se nespotřebovalo
    expect(S.eco["a"]?.r ?? 0).toBe(0);
  });
});

describe("volný útok", () => {
  it("bez slotů, bez range cover gate, bez automatické concentration", () => {
    const A = mkTok({ id: "a", x: 0, y: 0, atk: [{ nazev: "Fireball", kind: "spell", bonus: 5, dmg: "8d6", typ: "Fire", range: 150, kouzlo: "Fireball", conc: true, n: 1 } as any] });
    const B = mkTok({ id: "b", x: 5, y: 0 });
    const S = mkS([A, B], { nastaveni: FREE });
    const res = cmdAttack(S, { atkId: "a", tgtId: "b", atk: A.atk[0], manualD20: 19, manualDmg: 20 }, CTX);
    expect(res.ok).toBe(true);
    expect(A.conc).toBeFalsy();                // žádná conc linka ve volném režimu
    expect(S.eco["a"]?.a ?? 0).toBe(0);              // ve volném režimu se akce nespotřebuje
  });
  it("útok bez volného slotu projde", () => {
    const A = mkTok({ id: "a", x: 0, y: 0, slots: [{ max: 1, used: 1 }], atk: [{ nazev: "Magic Missile", kind: "spell", lvl: 1, bonus: 5, dmg: "3d4+3", typ: "Force", range: 120, n: 1 } as any] });
    const B = mkTok({ id: "b", x: 1, y: 0 });
    const S = mkS([A, B], { nastaveni: FREE });
    const res = cmdAttack(S, { atkId: "a", tgtId: "b", atk: A.atk[0], manualD20: 15, manualDmg: 8, slot: 1 }, CTX);
    expect(res.ok).toBe(true);
    expect(A.slots[0].used).toBe(1);           // slot se neodečte
  });
});

describe("volný tah", () => {
  it("advanceTurn nespouští triggery ani recharge", () => {
    const A = mkTok({ id: "a", spent: { "Breath": true }, effects: [{ nazev: "E", dur: "turn", mods: {} } as any] });
    const B = mkTok({ id: "b" });
    const S = mkS([A, B], { nastaveni: FREE });
    advanceTurn(S);
    expect(S.turn).toBe(1);
    expect(A.spent["Breath"]).toBe(true);      // recharge se nerolluje/neresetuje
  });
});

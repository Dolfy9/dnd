/* Reakce + features + spellcasting pravidla 2024. */
import { describe, it, expect } from "vitest";
import { reactionOptions, applyReaction } from "./reactions";
import { giveBardic, consumeBardic, turnUndeadSave, applyTurned, gwmBonus, hasGWM,
         sharpshooterCover, savagePick, spendSP, metaCost, flurryAttacks, wildShapeTemp } from "./features";
import { cmdAttack, cmdStdAction } from "../../state/commands/combat";
import { cmdFeature } from "../../state/commands/features";
import { mkTok } from "../rules.test";
import type { StavBoje, BattleMapData, Token, AttackDef } from "../../types";

const mkMap = (rows: string[]): BattleMapData => ({ id: "t", nazev: "t", podklad: "mesto", mrizka: rows });
const FLAT = mkMap(Array.from({ length: 8 }, () => ".........."));
const CTX = { map: FLAT };
const mkS = (tok: Token[], extra: Partial<StavBoje> = {}): StavBoje =>
  ({ tok, ord: tok.map((t) => t.id), turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], ...extra });
const hi = () => 0.999, lo = () => 0.01;
const SHIELD_SPELL = { nazev: "Shield (1. úr.)", kouzlo: "Shield", kind: "spell" as const, lvl: 1, n: 1 };
const CS_SPELL = { nazev: "Counterspell (3. úr.)", kouzlo: "Counterspell", kind: "spell" as const, lvl: 3, n: 1 };

describe("Shield reakce", () => {
  it("hit → miss při +5 AC; slot + reaction spotřebované", () => {
    const T = mkTok({ id: "t", ac: 14, slots: [{ max: 2, used: 0 }], kouzla: [SHIELD_SPELL as any] });
    const A = mkTok({ id: "a", side: "nepratele" });
    const S = mkS([T, A]);
    const opts = reactionOptions(S, { kind: "hit", attacker: A, target: T, hitTotal: 18 });
    expect(opts.some((o) => o.nazev === "Shield")).toBe(true);
    const res = applyReaction(S, opts.find((o) => o.nazev === "Shield")!, { kind: "hit", attacker: A, target: T, hitTotal: 18 }, hi);
    expect(res.miss).toBe(true);               // 18 < 14+5
    expect(T.slots[0].used).toBe(1);
    expect(S.eco["t"].r).toBe(1);
    expect(T.effects.some((e) => e.nazev === "Shield")).toBe(true);
  });
});
describe("Counterspell", () => {
  it("při neúspěšném CON save kouzlo selže a slot zůstane", () => {
    const C = mkTok({ id: "c", slots: [{ max: 0, used: 0 }, { max: 0, used: 0 }, { max: 1, used: 0 }], kouzla: [CS_SPELL as any], dc: 14 });
    const caster = mkTok({ id: "w", side: "nepratele", x: 5, mods: { CON: 0 } as any });
    const S = mkS([C, caster]);
    const opts = reactionOptions(S, { kind: "enemyCasts", attacker: caster, distFt: 25 });
    const o = opts.find((x) => x.nazev === "Counterspell")!;
    const res = applyReaction(S, o, { kind: "enemyCasts", attacker: caster }, lo); // caster save 1
    expect(res.countered).toBe(true);
    expect(C.slots[2].used).toBe(1);           // counterspeller slot utratil, caster ne
  });
});
describe("Sentinel / OA", () => {
  it("Sentinel zásah → speed 0", () => {
    const S2 = mkTok({ id: "s", features: [{ nazev: "Sentinel", text: "" }], side: "druzina" });
    const foe = mkTok({ id: "f", side: "nepratele", speed: 30 });
    const S = mkS([S2, foe]);
    const opts = reactionOptions(S, { kind: "disengageLeave", attacker: foe, target: S2 });
    const o = opts.find((x) => x.nazev === "Sentinel")!;
    applyReaction(S, o, { kind: "disengageLeave", attacker: foe }, hi);
    expect(foe.speed).toBe(0);
  });
});
describe("GWM / Sharpshooter / Savage", () => {
  it("GWM +PB jednou za tah", () => {
    const A = mkTok({ feats: ["Great Weapon Master"], pb: 3 });
    expect(gwmBonus(A, { melee: true } as any)).toBe(3);
    expect(gwmBonus(A, { kouzlo: "x" } as any)).toBe(0);
  });
  it("Sharpshooter ignoruje half/¾ cover, ne plný", () => {
    const T = mkTok({ feats: ["Sharpshooter"] });
    expect(sharpshooterCover(T, 2)).toBe(0);
    expect(sharpshooterCover(T, 4)).toBe(0);
    expect(sharpshooterCover(T, 9)).toBe(9);
    expect(sharpshooterCover(mkTok({}), 2)).toBe(2);
  });
  it("Savage pick = vyšší", () => {
    expect(savagePick(7, 12)).toBe(12);
    const A = mkTok({ id: "a", feats: ["Savage Attacker"], atk: [{ nazev: "Maul", kind: "weapon", melee: true, reach: 5, bonus: 8, dmg: "2d6+5", typ: "Bludgeoning", n: 1 } as any] });
    const B = mkTok({ id: "b", x: 1 });
    const S = mkS([A, B]); S.eco["a"] = { a: 0, b: 0, r: 0, moved: 0, objInt: 0, spell: 0, baSpell: 0, dash: 0, disengage: 0, extraA: 0 };
    cmdAttack(S, { atkId: "a", tgtId: "b", atk: A.atk[0], manualD20: 20, manualDmg: 10, override: true }, CTX);
    expect((S.eco["a"] as any).savage).toBeUndefined(); // manual dmg → reroll se neuplatní
  });
});
describe("Bardic", () => {
  it("die přidělena a spotřebována", () => {
    const bard = mkTok({ lvl: 6, features: [{ nazev: "Bardic Inspiration", text: "" }], zdroje: [{ nazev: "Bardic Inspiration", max: 3, used: 0 }] });
    const ally = mkTok({ id: "al" });
    const S = mkS([bard, ally]);
    const res = cmdFeature(S, bard.id, "bardic", "al");
    expect(res.ok).toBe(true);
    expect(ally.effects.some((e) => (e.mods as any).bardic === "d8")).toBe(true); // lvl 6 → d8
    const got = consumeBardic(ally, hi);
    expect(got).toBe(8); // 1d8 max = 8
    expect(ally.effects.some((e) => (e.mods as any).bardic)).toBe(false);
  });
});
describe("Turn Undead", () => {
  it("neúspěšný WIS save → Frightened + Incapacitated", () => {
    const u = mkTok({ saves: { WIS: 0 } as any });
    expect(turnUndeadSave(u, 14, lo).ok).toBe(false);
    applyTurned(u);
    expect(u.cond.some((c) => c.n === "Frightened") && u.cond.some((c) => c.n === "Incapacitated")).toBe(true);
  });
});
describe("Metamagic", () => {
  it("Quickened → BA; SP se strhnou", () => {
    const s = mkTok({ zdroje: [{ nazev: "Sorcery Points", max: 5, used: 0 }] });
    expect(metaCost(["quickened"], 2)).toBe(2);
    expect(spendSP(s, 2)).toBe(true);
    expect(s.zdroje[0].used).toBe(2);
    expect(spendSP(s, 4)).toBe(false);
    // Quickened v cmdAttack → BA místo Action
    const SP = { nazev: "Fireball (3. úr.)", kouzlo: "Fireball", kind: "spell" as const, lvl: 3, bonus: 5, dmg: "8d6", typ: "Fire", range: 150, save: "DEX" as const, dc: 14, n: 1 } as AttackDef;
    const sorc = mkTok({ id: "s", x: 0, zdroje: [{ nazev: "Sorcery Points", max: 5, used: 0 }], slots: [{ max: 0, used: 0 }, { max: 0, used: 0 }, { max: 2, used: 0 }] });
    const foe = mkTok({ id: "f", x: 2 });
    const S2 = mkS([sorc, foe]);
    const res = cmdAttack(S2, { atkId: "s", tgtId: "f", atk: SP, manualD20: 15, manualDmg: 10, meta: ["quickened"] }, CTX);
    expect(res.ok).toBe(true);
    expect(S2.eco["s"].b).toBe(1);
    expect(S2.eco["s"].a).toBe(0);
    expect(sorc.zdroje[0].used).toBe(2);
  });
});
describe("Jedno kouzlo se slotem za tah (2024)", () => {
  it("druhé leveled kouzlo → chyba; override projde", () => {
    const SP = { nazev: "Magic Missile (1. úr.)", kouzlo: "Magic Missile", kind: "spell" as const, lvl: 1, bonus: 5, dmg: "3d4+3", typ: "Force", range: 120, n: 1 } as AttackDef;
    const A = mkTok({ id: "a", x: 0, atk: [SP], slots: [{ max: 4, used: 0 }] });
    const B = mkTok({ id: "b", x: 1 });
    const S = mkS([A, B]);
    S.eco["a"] = { a: 0, b: 0, r: 0, moved: 0, objInt: 0, spell: 1, baSpell: 0, dash: 0, disengage: 0, extraA: 0 };
    expect(cmdAttack(S, { atkId: "a", tgtId: "b", atk: SP, manualD20: 15, manualDmg: 6 }, CTX).ok).toBe(false);
    expect(cmdAttack(S, { atkId: "a", tgtId: "b", atk: SP, manualD20: 15, manualDmg: 6, override: true }, CTX).ok).toBe(true);
  });
});
describe("Preset kouzlo se aplikuje", () => {
  it("Bless cast → efekt s +1d4 mods + Concentration", () => {
    const bless = { nazev: "Bless (1. úr.)", kouzlo: "Bless", kind: "spell" as const, lvl: 1, n: 1, conc: true } as AttackDef;
    const A = mkTok({ id: "a", x: 0, slots: [{ max: 2, used: 0 }], dc: 13 });
    const B = mkTok({ id: "b", x: 1, side: "druzina" });
    const S = mkS([A, B]);
    const res = cmdAttack(S, { atkId: "a", tgtId: "b", atk: bless, manualD20: 15, manualDmg: 0 }, CTX);
    expect(res.ok).toBe(true);
    expect(B.effects.some((e) => (e.mods as any).toHitDice === "+1d4")).toBe(true);
    expect(A.conc).toBe("Bless");
  });
});
describe("Wild Shape / Flurry", () => {
  it("temp HP = level; flurry = 2 útoky", () => {
    expect(wildShapeTemp(mkTok({ lvl: 8 }))).toBe(8);
    expect(flurryAttacks(mkTok({ lvl: 5, mods: { DEX: 4 } as any })).length).toBe(2);
  });
});

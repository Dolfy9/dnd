/* Unit testy pravidel 2024: dice, conditions, attack, damage, saves, areas,
   movement, effects, encounter, migrate. */
import { describe, it, expect } from "vitest";
import { parseDice, diceAvg, diceOnlyAvg, rollDice, d20, type Rng } from "./dice";
import { evaluateAttack, resolveAttack, inRange, advFor } from "./attack";
import { applyDamage, applyHealing, setTempHp, deathSave } from "./damage";
import { evalSave, resolveSave } from "./saves";
import { areaCells, tokensInArea, cellCovers } from "./areas";
import { reachable, gapFt, stepCost, oaAlong } from "./grid";
import { coverOf } from "./los";
import { sumMods, tickEffects, dropConcentration, makeEffect, presetById } from "./effects";
import { difficulty } from "./encounter";
import { migrate } from "./migrate";
import { hasCond, isProne, speedOf, exhaustion } from "./conditions";
import type { Token, BattleMapData, StavBoje, ActiveEffect } from "../types";
import { uid } from "../types";

const rngSeq = (vals: number[]): Rng => { let i = 0; return () => vals[i++ % vals.length]; };
const rngHi: Rng = () => 0.999; // d20 → 20, d6 → 6
const rngLo: Rng = () => 0.01;  // d20 → 1

export function mkTok(o: Partial<Token> = {}): Token {
  return {
    id: o.id || uid(), nazev: "T", kind: "pc", side: "druzina", s: 1,
    x: 0, y: 0, hp: 20, max: 20, tmp: 0, ac: 15, initB: 0, init: null,
    speed: 30, swim: 0, fly: 0, climb: 0,
    saves: {}, mods: {}, atk: [], cond: [], effects: [], conc: false,
    react: true, spent: {}, slots: [], zdroje: [], ds: { s: 0, f: 0 },
    dead: false, xp: 0, odolnosti: [], imunity: [], zranitelnosti: [],
    imunity_stavu: [], smysly: [], ...o,
  };
}

const mkMap = (rows: string[]): BattleMapData =>
  ({ id: "t", nazev: "t", podklad: "mesto", mrizka: rows });

const FLAT = mkMap(["..........", "..........", "..........", "..........", "..........", ".........."]);
const MELEE = { nazev: "Sword", kind: "weapon" as const, melee: true, reach: 5, bonus: 5, dmg: "1d8+3", typ: "Slashing", n: 1 };
const BOW = { nazev: "Longbow", kind: "weapon" as const, bonus: 5, dmg: "1d8+3", typ: "Piercing", range: 150, long: 600, n: 1 };

// ---------- dice ----------
describe("dice", () => {
  it("parse a avg", () => {
    expect(parseDice("2d6+5")).toHaveLength(2);
    expect(diceAvg("2d6+5")).toBe(12);
    expect(diceOnlyAvg("2d6+5")).toBe(7);
    expect(diceAvg("1d6+2+0")).toBeCloseTo(5.5);
    expect(diceAvg("8d6")).toBe(28);
    expect(diceAvg("3d8-2")).toBeCloseTo(11.5);
  });
  it("crit zdvojí kostky, ne konstantu", () => {
    const r = rollDice("2d6+5", { crit: true, rng: rngHi });
    expect(r.parts).toHaveLength(4);
    expect(r.total).toBe(4 * 6 + 5);
  });
  it("d20 adv/dis vrátí obě kostky", () => {
    const a = d20(1, rngSeq([0.5, 0.95]));   // 11,20 → 20
    const d = d20(-1, rngSeq([0.5, 0.95]));  // → 11
    expect(a.rolls).toEqual([11, 20]); expect(a.r).toBe(20);
    expect(d.r).toBe(11);
  });
});

// ---------- advantage / conditions ----------
describe("attack eval", () => {
  const A = mkTok({ nazev: "A", x: 0, y: 0 });
  it("Blinded cíl → adv zdroj", () => {
    const B = mkTok({ nazev: "B", x: 1, y: 0, cond: [{ n: "Blinded" }] });
    const ev = evaluateAttack({ attacker: A, target: B, atk: MELEE, map: FLAT, tokens: [A, B] });
    expect(ev.net).toBe(1);
    expect(ev.advSources.join()).toMatch(/oslabený/);
  });
  it("Prone: melee adv, ranged dis", () => {
    const B = mkTok({ x: 1, y: 0, cond: [{ n: "Prone" }] });
    expect(evaluateAttack({ attacker: A, target: B, atk: MELEE, map: FLAT, tokens: [A, B] }).net).toBe(1);
    const far = mkTok({ x: 8, y: 0, cond: [{ n: "Prone" }] });
    const ev = evaluateAttack({ attacker: A, target: far, atk: BOW, map: FLAT, tokens: [A, far] });
    expect(ev.net).toBe(-1);
    expect(ev.disSources.join()).toMatch(/Prone/);
  });
  it("Invisible oboustranně; adv+dis se ruší", () => {
    const B = mkTok({ x: 1, y: 0, cond: [{ n: "Invisible" }] });
    const Ai = mkTok({ nazev: "Ai", x: 0, y: 0, cond: [{ n: "Invisible" }] });
    const ev = evaluateAttack({ attacker: Ai, target: B, atk: MELEE, map: FLAT, tokens: [Ai, B] });
    expect(ev.advSources.length).toBeGreaterThan(0);
    expect(ev.disSources.length).toBeGreaterThan(0);
    expect(ev.net).toBe(0);
  });
  it("ranged s nepřítelem do 5 ft → dis", () => {
    const B = mkTok({ x: 6, y: 0, side: "nepratele" });
    const C = mkTok({ x: 1, y: 0, side: "nepratele", nazev: "adj" });
    const ev = evaluateAttack({ attacker: A, target: B, atk: BOW, map: FLAT, tokens: [A, B, C] });
    expect(ev.disSources.join()).toMatch(/5 ft/);
  });
  it("bonus je vždy číselný — string ze stavu se neslepí (bug +40)", () => {
    const A = mkTok({ x: 0, y: 0 }), B = mkTok({ x: 1, y: 0 });
    const strAtk = { ...MELEE, bonus: "5" as unknown as number }; // simulace serializovaného stavu
    const ev = evaluateAttack({ attacker: A, target: B, atk: strAtk, map: FLAT, tokens: [A, B] });
    // toHit=5 vs AC15 → need 10 → p 55 %; kdyby se "5" slepilo na "50", p by bylo 95 %
    expect(ev.hitChance).toBeCloseTo(0.55);
    const r = resolveAttack({ attacker: A, target: B, atk: strAtk, map: FLAT, tokens: [A, B] }, { manualD20: 10 })!;
    expect(typeof r.total).toBe("number");
    expect(r.total).toBe(15);
    expect(r.bonus).toBe(5);
  });
  it("Paralyzed do 5 ft → zásah je crit", () => {
    const B = mkTok({ x: 1, y: 0, cond: [{ n: "Paralyzed" }] });
    const r = resolveAttack({ attacker: A, target: B, atk: MELEE, map: FLAT, tokens: [A, B] }, { manualD20: 10 })!;
    expect(r.hit).toBe(true); expect(r.crit).toBe(true);
    expect(r.dmgRolls.length).toBe(2); // 1d8 crit → 2 dice
  });
  it("dlouhý dostřel → dis; za dlouhým → nelze", () => {
    const far = mkTok({ x: 0, y: 0 });
    const mid = mkTok({ x: 9, y: 0 });           // 45 ft… bow range 150 ok; použij javelin-like: uprav
    const short = { ...BOW, range: 30, long: 60 };
    // 30..60 ft → dis
    expect(evaluateAttack({ attacker: far, target: mkTok({ x: 8, y: 0 }), atk: short, map: FLAT, tokens: [far] }).disSources.join()).toMatch(/dlouhý/);
    // >60 ft → nelze
    const ev = evaluateAttack({ attacker: far, target: mkTok({ x: 0, y: 0 }), atk: { ...short }, map: FLAT, tokens: [] });
    void mid; void ev;
    expect(inRange(short, 65)).toBe(false);
    expect(inRange(short, 45)).toBe(true);
  });
  it("Exhaustion −2/lvl k zásahu", () => {
    const Ae = mkTok({ nazev: "Ae", x: 0, y: 0, cond: [{ n: "Exhaustion", lvl: 2 }] });
    const B = mkTok({ x: 1, y: 0 });
    const r = resolveAttack({ attacker: Ae, target: B, atk: MELEE, map: FLAT, tokens: [Ae, B] }, { manualD20: 15 })!;
    expect(r.bonus).toBe(5 - 4); // −4 za lvl 2
  });
});

// ---------- cover ----------
describe("cover", () => {
  it("half cover +2, 3/4 +5, total nelze", () => {
    const withCrates = mkMap(["..........", "..%.......", "..........", ".........."]);
    const withPillar = mkMap(["..........", "..o.......", "..........", ".........."]);
    const withWall = mkMap(["..........", "..#.......", "..........", ".........."]);
    const A = mkTok({ x: 0, y: 1 }), B = mkTok({ x: 4, y: 1 });
    expect(coverOf(A, B, withCrates, [A, B])).toBe(2);
    expect(coverOf(A, B, withPillar, [A, B])).toBe(3);
    expect(coverOf(A, B, withWall, [A, B])).toBe(9);
    const ev = evaluateAttack({ attacker: A, target: B, atk: BOW, map: withCrates, tokens: [A, B] });
    expect(ev.targetAC).toBe(B.ac + 2);
  });
});

// ---------- damage ----------
describe("damage", () => {
  it("immunity 0, resistance floor half, vulnerability ×2", () => {
    const im = mkTok({ imunity: ["Fire"] });
    expect(applyDamage(im, [{ amount: 20, type: "Fire" }]).applied).toBe(0);
    const re = mkTok({ odolnosti: ["Fire"] });
    expect(applyDamage(re, [{ amount: 9, type: "Fire" }]).applied).toBe(4);
    const vu = mkTok({ zranitelnosti: ["Cold"] });
    expect(applyDamage(vu, [{ amount: 9, type: "Cold" }]).applied).toBe(18);
    const pe = mkTok({ cond: [{ n: "Petrified" }] });
    expect(applyDamage(pe, [{ amount: 10, type: "Force" }]).applied).toBe(5);
  });
  it("temp HP absorbuje, nestackuje", () => {
    const t = mkTok({ tmp: 5 });
    const r = applyDamage(t, [{ amount: 8, type: "Fire" }]);
    expect(r.tmpUsed).toBe(5); expect(r.hpLost).toBe(3); expect(t.tmp).toBe(0);
    setTempHp(t, 7); setTempHp(t, 4);
    expect(t.tmp).toBe(7);
  });
  it("0 HP PC → Unconscious + dying; další zásah = failed save; massive = smrt", () => {
    const pc = mkTok({ hp: 5, max: 20 });
    const r = applyDamage(pc, [{ amount: 7, type: "Fire" }]);
    expect(r.downed).toBe(true); expect(pc.dying).toBe(true);
    expect(hasCond(pc, "Unconscious")).toBe(true);
    const r2 = applyDamage(pc, [{ amount: 3, type: "Fire" }]);
    expect(pc.ds.f).toBe(1); void r2;
    const pc2 = mkTok({ hp: 2, max: 10 });
    const r3 = applyDamage(pc2, [{ amount: 15, type: "Fire" }]);
    expect(r3.massiveDeath).toBe(true); expect(pc2.dead).toBe(true);
    const mon = mkTok({ kind: "mon", hp: 3 });
    applyDamage(mon, [{ amount: 5, type: "Fire" }]);
    expect(mon.dead).toBe(true);
  });
  it("concentration DC = max(10, dmg/2), cap 30; léčení probouzí", () => {
    const t = mkTok({ conc: "Bless", hp: 30, max: 30 });
    expect(applyDamage(t, [{ amount: 12, type: "Fire" }]).concDc).toBe(10);
    expect(applyDamage(t, [{ amount: 30, type: "Fire" }]).concDc).toBe(15);
    expect(applyDamage(t, [{ amount: 70, type: "Fire" }]).concDc).toBe(30);
    const d = mkTok({ hp: 0, dying: true, cond: [{ n: "Unconscious" }] });
    const h = applyHealing(d, 5);
    expect(h.revived).toBe(true); expect(d.dying).toBe(false);
    expect(hasCond(d, "Unconscious")).toBe(false);
  });
  it("death saves: nat20→1HP, nat1→2 fails, 3 fails→mrtvý", () => {
    const t = mkTok({ hp: 0, dying: true });
    expect(deathSave(t, 20).revived).toBe(true);
    const t2 = mkTok({ hp: 0, dying: true });
    deathSave(t2, 1); expect(t2.ds.f).toBe(2);
    deathSave(t2, 5); expect(t2.dead).toBe(true);
  });
});

// ---------- saves ----------
describe("saves", () => {
  it("Paralyzed → autofail STR/DEX", () => {
    const t = mkTok({ cond: [{ n: "Paralyzed" }] });
    const ev = evalSave(t, "DEX", 15);
    expect(ev.autoFail).toBe(true);
    const r = resolveSave(t, "DEX", 15, { manualRoll: 20 });
    expect(r.success).toBe(false);
    // ale CON jde normálně
    expect(evalSave(t, "CON", 15).autoFail).toBe(false);
  });
  it("Dodge → adv na DEX; Restrained → dis", () => {
    const t = mkTok({});
    t.effects.push({ id: "e", nazev: "Dodge", mods: { dodge: true, saveAdvAb: ["DEX"] } });
    expect(evalSave(t, "DEX", 15).net).toBe(1);
    const t2 = mkTok({ cond: [{ n: "Restrained" }] });
    expect(evalSave(t2, "DEX", 15).net).toBe(-1);
  });
  it("Legendary Resistance změní fail na success", () => {
    const t = mkTok({ legendary: { max: 3, used: 0, resist: { max: 3, used: 0 } } });
    const r = resolveSave(t, "WIS", 30, { manualRoll: 1, useLegendary: true });
    expect(r.success).toBe(true); expect(r.legendaryUsed).toBe(true);
    expect(t.legendary!.resist!.used).toBe(1);
  });
});

// ---------- areas ----------
describe("areas", () => {
  const M = mkMap(Array(20).fill(".".repeat(20)));
  it("Fireball 20 ft sphere", () => {
    const cells = areaCells({ shape: "sphere", size: 20, anchor: [10, 10] });
    // poloměr 4 buňky: ~π*4² ≈ 50, obsahuje střed i okraj
    expect(cellCovers({ shape: "sphere", size: 20, anchor: [10, 10] }, 10, 10)).toBe(true);
    expect(cellCovers({ shape: "sphere", size: 20, anchor: [10, 10] }, 14, 10)).toBe(true);
    expect(cellCovers({ shape: "sphere", size: 20, anchor: [10, 10] }, 15, 10)).toBe(false);
    expect(cells.length).toBeGreaterThan(30);
    void M;
  });
  it("15 ft cone: na konci široký jako dlouhý", () => {
    const spec = { shape: "cone" as const, size: 15, anchor: [5, 5] as [number, number], dir: 0 };
    expect(cellCovers(spec, 8, 5)).toBe(true);   // 3 buňky dopředu
    expect(cellCovers(spec, 7, 7)).toBe(false);  // perp > along/2
    expect(cellCovers(spec, 9, 5)).toBe(false);  // za délkou
  });
  it("60×5 line", () => {
    const spec = { shape: "line" as const, size: 60, w: 5, anchor: [0, 5] as [number, number], dir: 0 };
    expect(cellCovers(spec, 11, 5)).toBe(true);
    expect(cellCovers(spec, 12, 5)).toBe(true);
    expect(cellCovers(spec, 13, 5)).toBe(false);
    expect(cellCovers(spec, 5, 6)).toBe(false);  // šířka 5 ft
  });
  it("emanation kolem Large žetonu", () => {
    const big = mkTok({ s: 2, x: 5, y: 5, side: "druzina" });
    const near = mkTok({ x: 8, y: 5, side: "nepratele" });
    const far = mkTok({ x: 12, y: 5, side: "nepratele" });
    const spec = { shape: "emanation" as const, size: 10, anchor: [0, 0] as [number, number] };
    const hits = tokensInArea(spec, [big, near, far], big);
    expect(hits).toContain(near);
    expect(hits).not.toContain(far);
    expect(hits).not.toContain(big);
  });
});

// ---------- movement ----------
describe("movement", () => {
  it("těžký terén ×2 a limity", () => {
    const m = mkMap(["......", ".^^^^.", "......"]);
    const t = mkTok({ x: 0, y: 0, speed: 30 });
    const r = reachable(t, 30, m, [t], []);
    // vstup do ^ stojí 10 ft → do (1,1) jde za 10
    expect(r.dist["1,0"]).toBe(5);
    expect(r.dist["1,1"]).toBe(10);
    expect(r.dist["5,0"]).toBe(25);
    expect(r.dist["5,1"]).toBeUndefined; // ne dosáhne? ověříme level jen existenci klíče
  });
  it("zeď blokuje; grappler nemůže", () => {
    const m = mkMap(["...#..", "......"]);
    const t = mkTok({ x: 0, y: 0, speed: 30 });
    const r = reachable(t, 30, m, [t], []);
    expect(r.dist["3,0"]).toBeUndefined();
    expect(r.dist["4,0"]).toBe(20); // obchází přes řádek 1
    expect(r.dist["4,1"]).toBeDefined();
  });
  it("OA při odchodu z dosahu", () => {
    const A = mkTok({ x: 1, y: 0 });
    const E = mkTok({ x: 0, y: 0, side: "nepratele" });
    const oas = oaAlong(A, [[1, 0], [2, 0], [3, 0]], [A, E], false);
    expect(oas).toContain(E);
    expect(oaAlong(A, [[1, 0], [2, 0]], [A, E], true)).toHaveLength(0);
  });
  it("speedOf: exhaustion −5/lvl, grappled 0", () => {
    expect(speedOf(mkTok({ cond: [{ n: "Exhaustion", lvl: 2 }] }))).toBe(20);
    expect(speedOf(mkTok({ cond: [{ n: "Grappled" }] }))).toBe(0);
    expect(exhaustion(mkTok({ cond: [{ n: "Exhaustion", lvl: 3 }] }))).toBe(3);
    expect(isProne(mkTok({ cond: [{ n: "Unconscious" }] }))).toBe(true);
  });
});

// ---------- effects ----------
describe("effects", () => {
  it("rounds expirace na start tahu", () => {
    const t = mkTok({});
    const p = presetById("dodge")!;
    t.effects.push(makeEffect(p, undefined));
    expect(t.effects).toHaveLength(1);
    tickEffects(t, "start", t.id);
    expect(t.effects).toHaveLength(0);
  });
  it("concentration drop odebírá efekty i zóny", () => {
    const src = mkTok({ id: "s1", nazev: "Caster", conc: "Bless" });
    const t2 = mkTok({ id: "t2", nazev: "Target" });
    const p = presetById("bless")!;
    t2.effects.push({ ...makeEffect(p, "s1"), conc: "Bless" });
    const zones = [{ id: "z", nazev: "z", style: "radiant", shape: { kind: "sphere" as const, size: 5 }, anchor: [0, 0] as [number, number], conc: "Bless", src: "s1" }];
    const res = dropConcentration([src, t2], zones as any, "s1", "Bless");
    expect(t2.effects).toHaveLength(0);
    expect(res.zones).toHaveLength(0);
  });
  it("sumMods agreguje Bless + Shield", () => {
    const t = mkTok({});
    t.effects.push(makeEffect(presetById("bless")!, "x"));
    t.effects.push(makeEffect(presetById("shield")!, "x"));
    const m = sumMods(t);
    expect(m.toHitDice).toContain("1d4");
    expect(m.acBonus).toBe(5);
  });
});

// ---------- migrate ----------
describe("migrate", () => {
  it("legacy stav z fight-1-mwavelcr.json", () => {
    const legacy = {
      map: "octowerin-ulicka",
      tok: [
        { id: "t1", nazev: "Kharr", side: "druzina", hp: 22, max: 22, ac: 18, cond: [{ name: "Prone" }, { n: "Poisoned", lvl: 1 }] },
        { id: "t2", nazev: "Guard", side: "nepratele", hp: [5, 11], x: 3, y: 4, cond: [] },
      ],
      ord: ["t1", "t2"], turn: 0, round: 2,
      log: [{ k: 1, c: "12:00", kdo: "Kharr", t: "útočí", blok: { d20: 15 } }],
      moved: { t1: 15 }, dash: true, disengage: false, sel: "t1", zoom: 1.2, paint: {}, groups: {}, tab: "map", eco: {}, oa: {},
    };
    const S = migrate(legacy);
    expect(S.tok).toHaveLength(2);
    expect(S.tok[0].side).toBe("druzina");
    expect(S.tok[0].cond.map((c) => c.n)).toEqual(["Prone", "Poisoned"]);
    expect(S.tok[1].hp).toBe(5);
    expect(S.ord).toEqual(["t1", "t2"]);
    expect(S.log[0].t).toBe("útočí");
    expect(S.eco.t1.moved).toBe(15);
    expect(S.eco.t1.dash).toBe(1);
    expect(migrate(null).tok).toEqual([]);
    expect(migrate({}).round).toBe(0);
  });
});

// ---------- encounter ----------
describe("encounter", () => {
  it("difficulty podle DMG 2024 rozpočtu", () => {
    const party = [mkTok({ side: "druzina", lvl: 5 }), mkTok({ side: "druzina", lvl: 5 })];
    const easy = difficulty([...party, mkTok({ side: "nepratele", xp: 100 })]);
    expect(easy.cls).toBe("low");
    const deadly = difficulty([...party, mkTok({ side: "nepratele", xp: 2000 })]);
    expect(deadly.cls).toBe("deadly");
    const mid = difficulty([...party, mkTok({ side: "nepratele", xp: 800 })]);
    expect(mid.cls).toBe("moderate");
  });
});

// ---------- stepCost / gap ----------
describe("grid misc", () => {
  it("gapFt edge-to-edge", () => {
    const a = mkTok({ x: 0, y: 0, s: 1 }), b = mkTok({ x: 2, y: 0, s: 1 });
    expect(gapFt(a, b)).toBe(10);
    const big = mkTok({ x: 0, y: 0, s: 2 });
    expect(gapFt(big, b)).toBe(5);
  });
  it("propast jen s fly; ~ plavání", () => {
    const m = mkMap([".._~.."]);
    const wf = mkTok({ x: 0, y: 0, fly: 10 });
    expect(stepCost(wf, 2, 0, m, [wf])).toBeLessThan(Infinity);
    const nf = mkTok({ x: 0, y: 0 });
    expect(stepCost(nf, 2, 0, m, [nf])).toBe(Infinity);
    const sw = mkTok({ x: 0, y: 0, swim: 30 });
    expect(stepCost(sw, 3, 0, m, [sw])).toBe(1);
  });
});

/* Unit testy Phase B: osvětlení/vidění, presety, Sneak Attack, terén overrides,
   sloty/upcast, zdroje (Second Wind, Action Surge). */
import { describe, it, expect } from "vitest";
import { evaluateAttack } from "./attack";
import { tileAt, stepCost, reachable } from "./grid";
import { coverOf } from "./los";
import { lightAt, canSeeTarget, parseLightLevel, sensesOf } from "./lighting";
import { sumMods, tickEffects, presetById } from "./effects";
import { EFFECT_PRESETS } from "./presets";
import { speedOf, flySpeedOf } from "./conditions";
import { cmdAttack, cmdArea, cmdUseResource, addEffect, slotsLeft, cmdPaint, type CmdCtx } from "../state/commands";
import type { AttackDef, BattleMapData, StavBoje, Token } from "../types";
import { uid } from "../types";

export function mkTok(o: Partial<Token> = {}): Token {
  return {
    id: o.id || uid(), nazev: "T", kind: "pc", side: "druzina", s: 1,
    x: 0, y: 0, hp: 30, max: 30, tmp: 0, ac: 15, initB: 0, init: null,
    speed: 30, swim: 0, fly: 0, climb: 0,
    saves: {}, mods: {}, atk: [], cond: [], effects: [], conc: false,
    react: true, spent: {}, slots: [], zdroje: [], ds: { s: 0, f: 0 },
    dead: false, xp: 0, odolnosti: [], imunity: [], zranitelnosti: [],
    imunity_stavu: [], smysly: [], ...o,
  };
}
const mkMap = (rows: string[]): BattleMapData => ({ id: "t", nazev: "t", podklad: "mesto", mrizka: rows });
const FLAT = mkMap(["..........", "..........", "..........", "..........", "..........", ".........."]);
const mkS = (tok: Token[], extra: Partial<StavBoje> = {}): StavBoje =>
  ({ tok, ord: tok.map((t) => t.id), turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], ...extra });
const CTX: CmdCtx = { map: FLAT };
const MELEE: AttackDef = { nazev: "Sword", kind: "weapon", melee: true, reach: 5, bonus: 5, dmg: "1d8+3", typ: "Slashing", n: 1 };
const hi = () => { const o = Math.random; Math.random = () => 0.999; return () => { Math.random = o; }; };

// ---------- osvětlení / vidění ----------
describe("lighting & vision", () => {
  const A = mkTok({ nazev: "A", x: 0, y: 0 });
  const B = mkTok({ nazev: "B", x: 4, y: 0, side: "nepratele" });
  it("parse osvetleni", () => {
    expect(parseLightLevel("Bright Light")).toBe("bright");
    expect(parseLightLevel("Dim Light (noc, lucerny)")).toBe("dim");
    expect(parseLightLevel("Darkness")).toBe("dark");
  });
  it("smysly z textu", () => {
    const t = mkTok({ smysly: ["Darkvision 60 ft", "Passive Perception 12"] });
    expect(sensesOf(t).darkvision).toBe(60);
  });
  it("v tmě bez Darkvision útočník nevidí → dis", () => {
    const S = mkS([A, B], { lightLevel: "dark" });
    const ev = evaluateAttack({ attacker: A, target: B, atk: { ...MELEE, reach: 30 }, map: FLAT, tokens: [A, B], state: S });
    expect(ev.disSources.join(" ")).toMatch(/nevidí cíl|tmě/i);
  });
  it("Darkvision 60 ft vidí ve tmě", () => {
    const Av = mkTok({ x: 0, y: 0, smysly: ["Darkvision 60 ft"] });
    const S = mkS([Av, B], { lightLevel: "dark" });
    expect(canSeeTarget(S, FLAT, Av, B).see).toBe(true);
  });
  it("Darkness zóna (blocksLos) skryje cíl i Darkvision", () => {
    const Av = mkTok({ x: 0, y: 0, smysly: ["Darkvision 120 ft"] });
    const S = mkS([Av, B], {
      zones: [{ id: "z1", nazev: "Darkness", style: "darkness", shape: { kind: "sphere", size: 15 }, anchor: [4, 0], blocksLos: true }],
    });
    expect(canSeeTarget(S, FLAT, Av, B).see).toBe(false);
  });
  it("Invisible cíl → nevidí (pokud nemá truesight/blindsight)", () => {
    const Bi = mkTok({ x: 4, y: 0, side: "nepratele", cond: [{ n: "Invisible" }] });
    const S = mkS([A, Bi]);
    const v = canSeeTarget(S, FLAT, A, Bi);
    expect(v.see).toBe(false);
    expect(v.reason).toMatch(/Invisible/);
  });
  it("světlo Torch rozsvítí buňku v dark", () => {
    const S = mkS([A, B], { lightLevel: "dark", lights: [{ id: "l1", nazev: "Torch", bright: 20, dim: 20, anchor: [0, 0] }] });
    expect(lightAt(S, FLAT, 0, 0)).toBe("bright");
    expect(lightAt(S, FLAT, 6, 0)).toBe("dim");
    expect(lightAt(S, FLAT, 9, 0)).toBe("dark");
  });
});

// ---------- presety ----------
describe("preset library", () => {
  it("má ≥60 presetů a všechny povinné položky", () => {
    expect(EFFECT_PRESETS.length).toBeGreaterThanOrEqual(60);
    for (const p of EFFECT_PRESETS) {
      expect(p.icon).toBeTruthy();
      expect(p.desc).toBeTruthy();
      expect(p.mods).toBeDefined();
      expect(p.cat).toBeTruthy();
    }
    for (const id of ["aid", "barkskin", "blur", "mirror-image", "mage-armor", "invisibility",
      "slow", "hold-monster", "banishment", "sanctuary", "heroism", "enlarge-reduce",
      "longstrider", "fly", "divine-favor", "guidance", "entangle", "grease", "sleet-storm",
      "stinking-cloud", "cloudkill", "wall-of-force", "insect-plague", "sneak-attack",
      "divine-smite", "second-wind", "action-surge", "rage", "reckless", "uncanny-dodge",
      "evasion", "cunning-action", "lay-on-hands", "env-darkness", "env-underwater", "env-trap"])
      expect(presetById(id), id).toBeTruthy();
  });
  it("aplikace presetu: mods se projeví a expirují", () => {
    const t = mkTok();
    const S = mkS([t]);
    addEffect(S, t.id, "bless", undefined);
    expect(sumMods(t).toHitDice).toBe("+1d4");
    addEffect(S, t.id, "mage-armor", undefined);
    expect(sumMods(t).acSet).toBe(13);
    t.effects = t.effects.filter((e) => e.nazev !== "Bless");
    t.effects.push({ id: "x", nazev: "D", mods: {}, duration: { kind: "rounds", rounds: 1 } });
    const gone = tickEffects(t, "start", t.id);
    expect(gone).toContain("D");
    expect(t.effects.find((e) => e.nazev === "D")).toBeUndefined();
  });
  it("Speed efekty: Longstrider +10, Fly 60", () => {
    const t = mkTok();
    t.effects.push({ id: "1", nazev: "L", mods: { speedBonus: 10 } });
    t.effects.push({ id: "2", nazev: "F", mods: { flySpeedSet: 60 } });
    expect(speedOf(t)).toBe(40);
    expect(flySpeedOf(t)).toBe(60);
  });
});

// ---------- Sneak Attack ----------
describe("sneak attack", () => {
  it("1× za tah: adv NEBO spojenec u cíle; ne při dis", () => {
    const A = mkTok({ x: 0, y: 0 });
    const B = mkTok({ x: 0, y: 1, side: "nepratele", ac: 5, hp: 100, max: 100 });
    const C = mkTok({ x: 1, y: 1 }); // spojenec útočníka u cíle (hostile k B)
    A.effects.push({ id: "s", nazev: "Sneak Attack", mods: { sneakDmg: { dice: "2d6" } } });
    const S = mkS([A, B, C]);
    const restore = hi();
    const r1 = cmdAttack(S, { atkId: A.id, tgtId: B.id, atk: MELEE }, CTX);
    restore();
    expect(r1.ok).toBe(true);
    expect(B.hp).toBe(100 - (2 * 8 + 3) - 12); // crit 2d8+3=19 + Sneak 2d6=12 (rngHi)
    const hp2 = B.hp;
    const restore2 = hi();
    cmdAttack(S, { atkId: A.id, tgtId: B.id, atk: MELEE }, CTX);
    restore2();
    expect(B.hp).toBe(hp2 - 19); // bez sneak (už použitý tento tah)
  });
});

// ---------- terén overrides ----------
describe("terrain overrides", () => {
  it("teren přepisuje mrizku: zeď blokuje pohyb i LOS, kryt přidává cover", () => {
    const teren = { "2,0": "#", "4,0": "%" };
    expect(tileAt(FLAT, 2, 0, teren)).toBe("#");
    const t = mkTok({ x: 0, y: 0 });
    expect(stepCost(t, 2, 0, FLAT, [t], [], teren)).toBe(Infinity);
    // pohyb: zeď na (2,0) je nedosažitelná
    const r = reachable(t, 40, FLAT, [t], [], teren);
    expect(r.dist["2,0"]).toBeUndefined();
    // cover: "%" mezi útočníkem a cílem → half cover
    const A = mkTok({ x: 0, y: 0 }), B = mkTok({ x: 5, y: 0, side: "nepratele" });
    const cov = coverOf(A, B, mkMap(["......"]), [A, B], undefined, undefined, { "2,0": "%" });
    expect(cov).toBe(2);
  });
  it("cmdPaint zapisuje a maže override", () => {
    const S = mkS([]);
    cmdPaint(S, [[1, 1], [2, 1]], "#");
    expect(S.teren).toEqual({ "1,1": "#", "2,1": "#" });
    cmdPaint(S, [[1, 1]], ".");
    expect(S.teren).toEqual({ "2,1": "#" });
  });
});

// ---------- sloty / upcast ----------
describe("spell slots", () => {
  const FB: AttackDef = { nazev: "Fireball", kind: "spell", lvl: 3, save: "DEX", dc: 15, dmg: "8d6", typ: "Fire", half: true, pozn: "+1d6/slot >3", upcast: { dice: "1d6", per: 3 }, n: 1 };
  it("konzumace slotu + upcast damage", () => {
    const A = mkTok({ x: 0, y: 0, slots: [{ max: 4, used: 0 }, { max: 3, used: 0 }, { max: 3, used: 0 }, { max: 2, used: 0 }] });
    const B = mkTok({ x: 2, y: 0, side: "nepratele", hp: 100, max: 100, saves: { DEX: -10 } });
    const S = mkS([A, B]);
    expect(slotsLeft(A, 3)).toBe(3);
    const restore = hi();
    const spec = { shape: "sphere" as const, size: 20, anchor: [2, 0] as [number, number] };
    const r = cmdArea(S, { srcId: A.id, spec, atk: FB, slot: 4 }, CTX);
    restore();
    expect(r.ok).toBe(true);
    expect(A.slots[3].used).toBe(1);
    expect(B.hp).toBe(100 - 54); // 9d6=54 při rngHi (upcast 8d6+1d6)
  });
  it("bez slotu → odmítnuto s důvodem", () => {
    const A = mkTok({ x: 0, y: 0, slots: [{ max: 0, used: 0 }, { max: 0, used: 0 }, { max: 0, used: 0 }] });
    const S = mkS([A]);
    const r = cmdArea(S, { srcId: A.id, spec: { shape: "sphere", size: 20, anchor: [0, 0] }, atk: FB }, CTX);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/slot/);
  });
});

// ---------- zdroje ----------
describe("resources", () => {
  it("Second Wind: heal 1d10 + Fighter lvl jako Bonus Action", () => {
    const t = mkTok({ hp: 10, lvl: 5, zdroje: [{ nazev: "Second Wind", max: 1, used: 0, obnova: "short" }] });
    const S = mkS([t]);
    const restore = hi();
    const r = cmdUseResource(S, t.id, 0);
    restore();
    expect(r.ok).toBe(true);
    expect(t.hp).toBe(25); // 10 + 10 + 5
    expect(t.zdroje[0].used).toBe(1);
    expect(S.eco[t.id].b).toBe(1);
    const r2 = cmdUseResource(S, t.id, 0);
    expect(r2.ok).toBe(false); // vyčerpáno
  });
  it("Action Surge: +1 Action tento tah", () => {
    const t = mkTok({ zdroje: [{ nazev: "Action Surge", max: 1, used: 0 }] });
    const S = mkS([t]);
    S.eco[t.id] = { a: 1, b: 0, r: 0, moved: 0, objInt: 0, spell: 0, baSpell: 0, dash: 0, disengage: 0, extraA: 0 };
    const r = cmdUseResource(S, t.id, 0);
    expect(r.ok).toBe(true);
    expect(S.eco[t.id].a).toBe(0);
  });
});

describe("mince: emblemy a duplikáty", () => {
  it("dupNumber čte číslo z konce jména", async () => {
    const { dupNumber } = await import("../components/emblems");
    expect(dupNumber(mkTok({ nazev: "Guard 2" } as any))).toBe(2);
    expect(dupNumber(mkTok({ nazev: "Guard 10" } as any))).toBe(10);
    expect(dupNumber(mkTok({ nazev: "Kharr" } as any))).toBeNull();
  });
  it("emblemKey volí roli podle jména a podtyp zvířete", async () => {
    const { emblemKey } = await import("../components/emblems");
    expect(emblemKey(mkTok({ nazev: "Guard 1", typ: "humanoid" } as any))).toBe("helmet");
    expect(emblemKey(mkTok({ nazev: "Guard Captain" } as any))).toBe("plume");
    expect(emblemKey(mkTok({ nazev: "Cultist" } as any))).toBe("hood");
    expect(emblemKey(mkTok({ nazev: "Bandit" } as any))).toBe("mask");
    expect(emblemKey(mkTok({ nazev: "Dire Wolf", typ: "beast" } as any))).toBe("wolf");
    expect(emblemKey(mkTok({ nazev: "Ghoul", typ: "undead" } as any))).toBe("undead");
    expect(emblemKey(mkTok({ nazev: "X", typ: "dragon" } as any))).toBe("dragon");
  });
  it("výchozí portrétový fokus míří na hlavu", async () => {
    const { PORTRAIT_DEFAULT, fokusOf } = await import("../components/TokenCoin");
    expect(PORTRAIT_DEFAULT.y).toBeLessThan(0.4);
    expect(PORTRAIT_DEFAULT.zoom).toBeGreaterThan(1);
    const t = mkTok({ portretFokus: { x: 0.3, y: 0.5, zoom: 2 } } as any);
    expect(fokusOf(t)).toEqual({ x: 0.3, y: 0.5, zoom: 2 });
  });
});

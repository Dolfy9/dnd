/* Unit testy movement planneru + DM override: planMovement (over-limit, dash,
   nucený přesun, teleport, waypointy, úhlopříčky 5-10, průchod nepřáteli),
   undoTurnMovement, nastavení (migrace, hlidat/varovat/vypnuto). */
import { describe, it, expect } from "vitest";
import { planMovement, cumFt } from "./movement";
import { defaultSettings, mergeSettings } from "./settings";
import { resetEconomy, ecoOf } from "./turn";
import { moveToken, undoTurnMovement, cmdAttack, cmdStdAction, cmdUseResource, type CmdCtx } from "../state/commands";
import type { Token, BattleMapData, StavBoje, AttackDef, BattleSettings } from "../types";
import { uid } from "../types";

const mkTok = (o: Partial<Token> = {}): Token => ({
  id: o.id || uid(), nazev: "T", kind: "pc", side: "druzina", s: 1,
  x: 0, y: 0, hp: 20, max: 20, tmp: 0, ac: 15, initB: 0, init: null,
  speed: 30, swim: 0, fly: 0, climb: 0,
  saves: {}, mods: {}, atk: [], cond: [], effects: [], conc: false,
  react: true, spent: {}, slots: [], zdroje: [], ds: { s: 0, f: 0 },
  dead: false, xp: 0, odolnosti: [], imunity: [], zranitelnosti: [],
  imunity_stavu: [], smysly: [], ...o,
});
const mkMap = (rows: string[]): BattleMapData => ({ id: "t", nazev: "t", podklad: "mesto", mrizka: rows });
const FLAT = mkMap(["..........", "..........", "..........", "..........", "..........", ".........."]);
const mkS = (tok: Token[], extra: Partial<StavBoje> = {}): StavBoje =>
  ({ tok, ord: tok.map((t) => t.id), turn: 0, round: 1, log: [], eco: {}, zones: [], fx: [], ...extra });
const CTX: CmdCtx = { map: FLAT };
const st = (o: Partial<BattleSettings["pohyb"]> = {}, a: Partial<BattleSettings["automatizace"]> = {}): BattleSettings =>
  mergeSettings({ pohyb: { ...defaultSettings().pohyb, ...o }, automatizace: { ...defaultSettings().automatizace, ...a } });
const plan = (S: StavBoje, t: Token, to: [number, number], mode: import("../types").MoveMode = "pravidla", s = st(), wps: [number, number][] = []) =>
  planMovement(S, FLAT, t, wps, to, mode, s);

describe("planMovement", () => {
  it("over-limit cesta: existuje a hlásí overFt", () => {
    const A = mkTok({ x: 0, y: 0 });
    const S = mkS([A]);
    const p = plan(S, A, [8, 0]);
    expect(p.blocked).toBeNull();
    expect(p.ft).toBe(40);
    expect(p.limitFt).toBe(30);
    expect(p.overFt).toBe(10);
    expect(p.withinLimit).toBe(false);
    const c = cumFt(A, p.path, FLAT, S, st());
    expect(c[c.length - 1]).toBe(40);
    expect(c.filter((v) => v <= 30).length).toBeGreaterThan(1); // zelená část
  });
  it("dashFits: true když Action volná a sedí do 2× speed, false když použitá", () => {
    const A = mkTok({ x: 0, y: 0 });
    const S = mkS([A]);
    const p1 = plan(S, A, [9, 0]); // 45 ft ≤ 60
    expect(p1.dashFits).toBe(true);
    ecoOf(S, A).a = 1;
    expect(plan(S, A, [9, 0]).dashFits).toBe(false);
    const A2 = mkTok({ x: 0, y: 0 });
    const S2 = mkS([A2]);
    expect(plan(S2, A2, [9, 0], "pravidla", st(), [[0, 5], [9, 5]]).dashFits).toBe(false); // > 60 ft
  });
  it("nucený přesun: bez OA, bez utrácení pohybu, zastaví před zdí", () => {
    const enemy = mkTok({ id: "e", nazev: "E", x: 0, y: 1, side: "nepratele" });
    const A = mkTok({ x: 0, y: 0 });
    const S = mkS([A, enemy]);
    const p = plan(S, A, [2, 0], "nuceny");
    expect(p.provokesOA).toBe(false);
    expect(p.spendsMovement).toBe(false);
    expect(p.oas).toHaveLength(0);
    // plná zeď na x=2
    const WALL = mkMap(["..#..", "..#..", "..#..", "..#.."]);
    const p2 = planMovement(mkS([A]), WALL, A, [], [4, 0], "nuceny", st());
    expect(p2.blocked).toBe("zed");
    expect(p2.farthest).toEqual([1, 0]);
  });
  it("teleport: přes zeď, obsazený cíl zamítnut i u velkého žetonu", () => {
    const WALL = mkMap(["..#.......", "..#.......", ".........."]);
    const A = mkTok({ x: 0, y: 0 });
    const p = planMovement(mkS([A]), WALL, A, [], [4, 0], "teleport", st());
    expect(p.blocked).toBeNull();
    const B = mkTok({ x: 1, y: 1 });
    const L = mkTok({ x: 5, y: 0, s: 2 });
    const S2 = mkS([L, B]);
    const p2 = planMovement(S2, FLAT, L, [], [0, 0], "teleport", st());
    expect(p2.blocked).toBe("obsazeno"); // (0,0)+(1,0)+(0,1)+(1,1) — B na (1,1)
  });
  it("waypointy mění trasu/cenu i OA", () => {
    const enemy = mkTok({ id: "e", nazev: "E", x: 4, y: 0, side: "nepratele" });
    const A = mkTok({ x: 0, y: 0 });
    const S = mkS([A, enemy]);
    const direct = plan(S, A, [8, 0]);
    expect(direct.oas.length).toBeGreaterThan(0); // projde kolem nepřítele
    const around = plan(S, A, [8, 0], "pravidla", st(), [[0, 5], [8, 5]]);
    expect(around.path).not.toEqual(direct.path); // waypoint mění trasu
    expect(around.ft).toBeGreaterThan(direct.ft);
  });
  it("úhlopříčky 5-10: 3 diagonály = 20 ft (5+10+5)", () => {
    const A = mkTok({ x: 0, y: 0 });
    const S = mkS([A]);
    expect(plan(S, A, [3, 3], "pravidla", st({ uhlopricky: "5-10" })).ft).toBe(20);
    expect(plan(S, A, [3, 3], "pravidla", st({ uhlopricky: "5" })).ft).toBe(15);
  });
  it("průchod nepřáteli: blokovat zamítne, povolit projde (za obtížný terén)", () => {
    // jediná cesta vede buňkou (1,0) — pod ní zed
    const CORRIDOR = mkMap(["....", "###.", "...."]);
    const enemy = mkTok({ id: "e", x: 1, y: 0, side: "nepratele" });
    const A = mkTok({ x: 0, y: 0 });
    const S = mkS([A, enemy]);
    const bl = planMovement(S, CORRIDOR, A, [], [2, 0], "pravidla", st({ pruchodNepratel: "blokovat" }));
    const po = planMovement(S, CORRIDOR, A, [], [2, 0], "pravidla", st({ pruchodNepratel: "povolit" }));
    expect(bl.blocked).not.toBeNull();
    expect(po.blocked).toBeNull();
    expect(po.path.some(([x, y]) => x === 1 && y === 0)).toBe(true);
  });
  it("zóny: zonesEntered hlásí vstup, nucený respektuje zonyPriPresunuDM", () => {
    const A = mkTok({ x: 0, y: 0 });
    const S = mkS([A], { zones: [{ id: "z1", nazev: "Web", style: "web", shape: { kind: "sphere", size: 10 }, anchor: [5, 0] }] });
    expect(plan(S, A, [8, 0]).zonesEntered).toContain("z1");
    expect(plan(S, A, [8, 0], "nuceny", st({ zonyPriPresunuDM: false })).zonesEntered).toHaveLength(0);
  });
});

describe("moveToken & undoTurnMovement", () => {
  it("módy účtují správně + log ⚙ DM", () => {
    const A = mkTok({ x: 0, y: 0 });
    const S = mkS([A]);
    resetEconomy(S, A);
    moveToken(S, A.id, 8, 0, { ft: 40, mode: "prekrocit", override: true });
    expect(ecoOf(S, A).moved).toBe(40);
    expect(S.log.some((l) => l.t.includes("⚙ DM"))).toBe(true);
    undoTurnMovement(S, A.id);
    expect(A.x).toBe(0); expect(ecoOf(S, A).moved).toBe(0);
    moveToken(S, A.id, 5, 5, { mode: "nuceny", zones: false });
    expect(ecoOf(S, A).moved).toBe(0); // nucený neutrácí
    moveToken(S, A.id, 3, 3, { ft: 30, mode: "dash" });
    expect(ecoOf(S, A).a).toBe(1); // Dash spotřebuje Action
  });
});

describe("nastavení & override", () => {
  it("migrace: mergeSettings doplní výchozí", () => {
    const m = mergeSettings({ pohyb: { limit: "volne" } as any });
    expect(m.pohyb.limit).toBe("volne");
    expect(m.pohyb.uhlopricky).toBe("5");
    expect(m.automatizace.zraneni).toBe("potvrdit");
    expect(m.automatizace.ekonomika).toBe("hlidat");
  });
  const SPELL: AttackDef = { nazev: "Fire Bolt+", kind: "spell", lvl: 2, range: 120, bonus: 5, dmg: "2d6", typ: "Fire", save: "DEX", dc: 13 };
  it("sloty: hlidat blokuje bez override, override projde a log ⚙ DM", () => {
    const A = mkTok({ nazev: "A" }); const B = mkTok({ nazev: "B", x: 1, y: 0, side: "nepratele" });
    const S = mkS([A, B]);
    expect(cmdAttack(S, { atkId: A.id, tgtId: B.id, atk: SPELL }, CTX).ok).toBe(false);
    expect(cmdAttack(S, { atkId: A.id, tgtId: B.id, atk: SPELL, override: true }, CTX).ok).toBe(true);
    expect(S.log.some((l) => l.t.includes("⚙ DM"))).toBe(true);
  });
  it("sloty varovat: provede + varování; vypnuto: provede tiše", () => {
    const A = mkTok(); const B = mkTok({ x: 1, y: 0, side: "nepratele" });
    const S = mkS([A, B], { nastaveni: st({}, { sloty: "varovat" }) });
    expect(cmdAttack(S, { atkId: A.id, tgtId: B.id, atk: SPELL }, CTX).ok).toBe(true);
    expect(S.log.some((l) => l.t.includes("⚠"))).toBe(true);
    const S2 = mkS([mkTok(), mkTok({ x: 1, y: 0, side: "nepratele" })], { nastaveni: st({}, { sloty: "vypnuto" }) });
    const n0 = S2.log.length;
    expect(cmdAttack(S2, { atkId: S2.tok[0].id, tgtId: S2.tok[1].id, atk: SPELL }, CTX).ok).toBe(true);
    expect(S2.log.slice(n0).some((l) => l.t.includes("⚠"))).toBe(false);
  });
  it("ekonomika: hlidat blokuje druhou Action, override povolí + ⚙ DM", () => {
    const A = mkTok({ nazev: "A" });
    const S = mkS([A]);
    resetEconomy(S, A);
    ecoOf(S, A).a = 1;
    cmdStdAction(S, A.id, "dash");
    expect(ecoOf(S, A).dash).toBe(0); // zablokováno
    cmdStdAction(S, A.id, "dash", undefined, true);
    expect(ecoOf(S, A).dash).toBe(1);
    expect(S.log.some((l) => l.t.includes("⚙ DM"))).toBe(true);
  });
  it("zdroj vyčerpán: hlidat blokuje, override povolí", () => {
    const A = mkTok({ zdroje: [{ nazev: "Second Wind", max: 1, used: 1 }] });
    const S = mkS([A]);
    expect(cmdUseResource(S, A.id, 0).ok).toBe(false);
    expect(cmdUseResource(S, A.id, 0, undefined, true).ok).toBe(true);
  });
});

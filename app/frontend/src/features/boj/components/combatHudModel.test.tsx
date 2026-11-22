import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { custom } from "../rules/combatants";
import { defaultSettings } from "../rules/settings";
import { migrate } from "../rules/migrate";
import { ecoOf } from "../rules/turn";
import type { AttackDef, StavBoje } from "../types";
import { attackGroup, hpDescription, pipState, publicHpFraction, unusableReason } from "./combatHudModel";
import { Health, TargetHud, TurnHud } from "./CombatHud";

const setup = () => {
  const t = { ...custom("Monster", "nepratele", 80, 17), id: "m", x: 2, y: 0 };
  const hero = { ...custom("Hero", "druzina", 40, 16), id: "h", x: 0, y: 0 };
  const S: StavBoje = { tok: [hero, t], ord: [hero.id, t.id], turn: 0, round: 3, log: [], eco: {}, zones: [], fx: [], nastaveni: defaultSettings() };
  const a: AttackDef = { nazev: "Claw", kind: "weapon", bonus: 5, dmg: "1d6+3", melee: true };
  return { t, hero, S, a };
};

describe("combat HUD model", () => {
  it("shows available and spent economy, including a separate legendary pool", () => {
    const { S, t } = setup();
    expect(pipState(S, t, "a")).toEqual({ max: 1, used: 0, left: 1 });
    expect(pipState(S, t, "legendary")).toEqual({ max: 0, used: 0, left: 0 });
    Object.assign(ecoOf(S, t), { a: 1, b: 0, r: 1 });
    expect(pipState(S, t, "a").left).toBe(0);
    expect(pipState(S, t, "b").left).toBe(1);
    expect(pipState(S, t, "r").left).toBe(0);
    t.legendary = { max: 3, used: 2 };
    expect(pipState(S, t, "legendary")).toEqual({ max: 3, used: 2, left: 1 });
    t.legendary.used = 9;
    expect(pipState(S, t, "legendary")).toEqual({ max: 3, used: 3, left: 0 });
  });
  it("groups attacks by cost", () => {
    const { a } = setup();
    expect([attackGroup(a), attackGroup({ ...a, ba: true }), attackGroup({ ...a, rea: true }), attackGroup({ ...a, legendaryCost: 2 })]).toEqual(["a", "b", "r", "legendary"]);
  });
  it("explains permissions, incapacitation, recharge, economy and exhausted slots", () => {
    const { S, t, a } = setup();
    expect(unusableReason(S, t, a, true)).toBeUndefined();
    expect(unusableReason(S, t, a, false)).toBe("Ovládá PJ");
    t.cond = [{ n: "Incapacitated" }];
    expect(unusableReason(S, t, a, true)).toBe("Tvor nemůže jednat");
    t.cond = []; t.spent = { Claw: true };
    expect(unusableReason(S, t, { ...a, rc: 5 }, true)).toBe("Čeká na recharge");
    expect(unusableReason(S, t, { ...a, kouzlo: "Spell", lvl: 1 }, true)).toBe("Došly sloty");
    S.nastaveni!.automatizace.sloty = "vypnuto";
    expect(unusableReason(S, t, { ...a, kouzlo: "Spell", lvl: 1 }, true)).toBeUndefined();
    S.nastaveni!.automatizace.sloty = "hlidat";
    t.pact = { lvl: 2, max: 1, used: 0 };
    expect(unusableReason(S, t, { ...a, kouzlo: "Spell", lvl: 1 }, true)).toBeUndefined();
    Object.assign(ecoOf(S, t), { a: 1, b: 0, r: 0 });
    expect(unusableReason(S, t, a, true)).toBe("Action použita");
    S.eco[t.id].atkLeft = 1;
    expect(unusableReason(S, t, a, true)).toBeUndefined();
    S.nastaveni!.rezim = "volny";
    expect(unusableReason(S, t, { ...a, rc: 5 }, true)).toBeUndefined();
  });
  it("reuses the legendary window rule", () => {
    const { S, t, a, hero } = setup(); t.legendary = { max: 3, used: 1 };
    expect(unusableReason(S, t, { ...a, legendaryCost: 1 }, true)).toBeTruthy();
    S.legendaryWindow = { actorId: hero.id, usedBy: [] };
    expect(unusableReason(S, t, { ...a, legendaryCost: 1 }, true)).toBeUndefined();
  });
  it("describes HP buckets and preserves server-filtered descriptions through loading", () => {
    const { t } = setup();
    expect([80, 60, 40, 20, 0].map(hp => hpDescription({ ...t, hp }))).toEqual(["Nezraněný", "Lehce zraněný", "Těžce zraněný", "Na pokraji", "Vyřazený"]);
    expect(hpDescription({ ...t, dead: true })).toBe("Mrtvý");
    expect(hpDescription({ ...t, hp: NaN })).toBe("Stav neznámý");
    const filtered = migrate({ tok: [{ id: "m", side: "nepratele", hp_stav: "Těžce zraněný" }] }).tok[0];
    expect(hpDescription(filtered)).toBe("Těžce zraněný");
    expect(publicHpFraction(filtered)).toBe(.4);
    expect(publicHpFraction({ ...t, hp: 21 })).toBe(publicHpFraction({ ...t, hp: 39 }));
  });
  it("renders GM details but never exact enemy HP, temp HP or AC for players", () => {
    const { S, t } = setup(); t.hp = 37; t.tmp = 11;
    const map = { id: "map", nazev: "Map", podklad: "mesto", mrizka: ["....."] };
    const gm = renderToStaticMarkup(<TargetHud S={S} t={t} map={map} dm />);
    expect(gm).toContain("37"); expect(gm).toContain("+11"); expect(gm).toContain("combat-target-ac"); expect(gm).toContain("10 ft");
    const player = renderToStaticMarkup(<TargetHud S={S} t={t} map={map} dm={false} />);
    expect(player).toContain("Těžce zraněný"); expect(player).not.toContain("combat-health-track"); expect(player).not.toContain("combat-target-ac"); expect(player).not.toContain("+11");
    expect(renderToStaticMarkup(<Health t={t} exact={false} />)).not.toContain("37");
    expect(renderToStaticMarkup(<TargetHud S={S} map={map} dm />)).toBe("");
    S.ord = [];
    expect(renderToStaticMarkup(<TurnHud S={S} dm onEnd={() => {}} onGroup={() => {}} />)).toBe("");
  });
});

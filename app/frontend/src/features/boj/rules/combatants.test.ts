import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import engine from "./fixtures/warlock-engine.json";
import bestiary from "../../../../../../web/assets/srd/bestiar.json";
import catalog from "../../../../../../web/assets/kouzla2024.json";
import { fromCharacter, fromMonster, custom } from "./combatants";
import { refreshedStats, loadCombatant } from "./reimport";
import { restResources } from "./resources";
import { migrate } from "./migrate";
import { defaultSettings } from "./settings";
import type { MonsterEntry, StavBoje } from "../types";
import { cmdArea, reimportToken } from "../state/commands";
import { unusableReason } from "../components/combatHudModel";
import TokenInspector from "../components/TokenInspector";
import { reactionOptions, applyReaction } from "./actions/reactions";

const monster = (name: string) => bestiary.find(m => m.nazev === name)! as unknown as MonsterEntry;
const pc = () => fromCharacter("fixture.md", "Pact caster", engine.sheet, "druzina", undefined, catalog);
const state = (...tok: ReturnType<typeof pc>[]): StavBoje => ({ tok, ord: tok.map(t => t.id), turn: 0, round: 1, eco: {}, log: [], zones: [], fx: [], nastaveni: defaultSettings() });

describe("canonical import adapters", () => {
  it("copies normalized engine attacks, casting contexts and separate pact slots without recalculating", () => {
    const t = pc(), b = engine.sheet.boj;
    expect(t.atk[0]).toMatchObject({ bonus: b.utoky[0].atk, dmg: b.utoky[0].dmg, range: 150, long: 600, melee: false });
    expect(t.extraAtk).toBe(b.utoky_za_akci); expect(t.s).toBe(2); expect(t.src).toMatchObject({ id: "fixture.md", edition: "2024" });
    expect(t.slots.map(s => s.max)).toEqual(engine.sheet.slots); expect(t.pact).toEqual({ lvl: 3, max: 2, used: 0 });
    expect(t.kouzla?.find(s => s.kouzlo === "Fireball")).toMatchObject({ range: 150, lvl: 3, dc: 15, area: { shape: "sphere", size: 20 }, dmg: "8d6", upcast: { dice: "1d6", per: 3 } });
    expect(t.kouzla?.find(s => s.kouzlo === "Cure Wounds")).toMatchObject({ range: 5, lvl: 1, heal: { dice: "2d8" } });
    t.pact!.used = 2; t.slots[0].used = 1; t.zdroje.push({ nazev: "Daily", max: 1, used: 1, obnova: "long" });
    restResources(state(t), [t.id], "short"); expect(t.pact!.used).toBe(0); expect(t.slots[0].used).toBe(1); expect(t.zdroje.find(z => z.nazev === "Daily")!.used).toBe(1);
  });
  it("honors structured zero speeds, senses, defenses, class uses and Extra Attack over name guesses", () => {
    const sheet = structuredClone(engine.sheet) as any;
    Object.assign(sheet.boj, { rychlosti: { walk: 0, fly: 60, swim: 30, climb: 20 }, smysly: ["darkvision 120 ft"], odolnosti: ["Fire"], imunity_stavu: ["Poisoned"], utoky_za_akci: 3, zdroje: [{ nazev: "Action Surge", max: 2, obnova: "short" }] });
    sheet.boj.utoky[0] = { nazev: "Longbow", melee: true, reach: 15, atk: 99, dmg: "7d4+9", typ: "Force" };
    const t = fromCharacter("x", "x", sheet, "druzina", undefined, catalog);
    expect(t).toMatchObject({ speed: 0, fly: 60, swim: 30, climb: 20, smysly: ["darkvision 120 ft"], odolnosti: ["Fire"], imunity_stavu: ["Poisoned"], extraAtk: 3, zdroje: [{ max: 2, used: 0, obnova: "short" }] });
    expect(t.atk[0]).toMatchObject({ melee: true, reach: 15, bonus: 99, dmg: "7d4+9" });
  });
  it("imports caster lists with catalog ranges and shared daily pools, not invented slots", () => {
    const t = fromMonster(monster("Mage"), "nepratele", catalog);
    expect(t.casting).toMatchObject({ ab: "INT", dc: 14, atk: 6 }); expect(t.slots).toEqual([]);
    expect(t.kouzla?.find(s => s.kouzlo === "Fireball")).toMatchObject({ lvl: 3, dc: 14, dmg: "8d6", innate: true, uses: "Fireball", xd: 2 });
    expect(t.kouzla?.find(s => s.kouzlo === "Misty Step")).toMatchObject({ ba: true, xd: 3 });
    const shield = t.kouzla!.find(s => s.kouzlo === "Shield")!, counter = t.kouzla!.find(s => s.kouzlo === "Counterspell")!;
    expect(shield.rea).toBe(true); expect(shield.uses).toBe(counter.uses);
    const S = state(t); expect(unusableReason(S, t, t.kouzla!.find(s => s.kouzlo === "Fireball")!, true)).toBeUndefined();
    const pool = t.zdroje.find(z => z.nazev === shield.uses)!;
    const trigger = { kind: "hit" as const, target: t, hitTotal: 16 };
    const reaction = reactionOptions(S, trigger).find(r => r.nazev === "Shield")!; expect(reaction).toBeDefined(); expect(reaction.desc).not.toContain("slot");
    applyReaction(S, reaction, trigger, () => 0.5); expect(pool.used).toBe(1); expect(t.slots).toEqual([]);
    S.eco = {}; pool.used = pool.max; expect(unusableReason(S, t, counter, true)).toBe("Došla použití"); expect(reactionOptions(S, trigger).some(r => r.nazev === "Shield")).toBe(false);
  });
  it("consumes an imported monster spell daily use once for an AoE, preserving spell level", () => {
    const t = fromMonster(monster("Mage"), "nepratele", catalog), target = custom("Target", "druzina", 100, 10, 30);
    t.x = t.y = 0; target.x = 2; target.y = 0;
    const S = state(t, target); const spell = t.kouzla!.find(s => s.kouzlo === "Fireball")!;
    const map = { mrizka: ["..........", "..........", ".........."] } as any;
    const result = cmdArea(S, { srcId: t.id, atk: spell, spec: { shape: "sphere", size: 20, anchor: [2, 0] }, targetIds: [target.id], manualDmg: 8, manualSaves: { [target.id]: 1 } }, { map });
    expect(result.ok).toBe(true); expect(target.hp).toBeLessThan(100); expect(t.zdroje.find(z => z.nazev === "Fireball")?.used).toBe(1); expect(spell.lvl).toBe(3);
  });
  it("imports adult dragon legendary pool, resistance, recharge, and exact multiattack composition", () => {
    const t = fromMonster(monster("Adult Red Dragon"), "nepratele", catalog);
    expect(t.legendary).toMatchObject({ max: 3, resist: { max: 3 } }); expect(t.src).toMatchObject({ srd: "Adult Red Dragon", edition: "2024", source: "SRD 5.2.1" });
    expect(t.multiattack?.attacks).toEqual([{ name: "Rend", count: 3 }]); expect(t.multiattack?.text).toContain("replace one attack");
    expect(t.atk.find(a => a.nazev === "Rend")).toMatchObject({ n: 1, bonus: 14, dmg: "1d10+8", dmg2: "2d4" });
    expect(t.atk.find(a => a.nazev.startsWith("Fire Breath"))).toMatchObject({ rc: 5, dc: 21, area: { shape: "cone", size: 60 } });
    expect(t.atk.filter(a => a.legendaryCost != null)).toHaveLength(3); expect(t.atk.filter(a => a.legendaryCost != null).every(a => !a.rea)).toBe(true);
    const cost = structuredClone(monster("Adult Red Dragon")); cost.legendarni![0].nazev += " (Costs 2 Actions)"; expect(fromMonster(cost).atk.find(a => a.legendaryCost === 2)).toBeDefined();
  });
  it("maps Large/Huge/Gargantuan, zero walk, senses, and mixed condition/damage immunities", () => {
    for (const [name, size] of [["Aboleth", 2], ["Adult Red Dragon", 3], ["Tarrasque", 4]] as const) expect(fromMonster(monster(name)).s).toBe(size);
    const t = fromMonster(monster("Tarrasque")); expect(t.imunity).toEqual(["Fire", "Poison"]); expect(t.imunity_stavu).toContain("Poisoned"); expect(t.imunity).not.toContain("poisoned"); expect(t.burrow).toBe(40);
    expect(t.multiattack?.attacks).toContainEqual({ name: "Claw / Tail", count: 3, alternatives: ["Claw", "Tail"] });
    const m = structuredClone(monster("Aboleth")); m.rychlost = { walk: 0, fly: 60 }; expect(fromMonster(m).speed).toBe(0);
    expect(fromMonster(monster("Adult Red Dragon")).smysly).toContain("blindsight 60 ft");
  });
  it("keeps unsupported spells visible, and handles empty legacy sheets", () => {
    expect(fromCharacter("x", "x", {}).atk).toHaveLength(1);
    expect(fromCharacter("x", "x", { kouzla: ["Unknown spell"] }).kouzla?.[0]).toMatchObject({ kouzlo: "Unknown spell", utility: true });
  });
});

describe("stat-block refresh", () => {
  it("updates source statistics without healing, teleporting, clearing conditions or restoring uses, and survives migration", () => {
    const t = pc(); t.hp = 7; t.tmp = 4; t.x = 8; t.y = 9; t.cond = [{ n: "Prone" }]; t.pact!.used = 1; t.slots[0].used = 2; t.conc = "Hex";
    const fresh = pc(); fresh.ac = 22; fresh.max = 101; const S = state(t); reimportToken(S, t.id, fresh);
    expect(t).toMatchObject({ hp: 7, tmp: 4, x: 8, y: 9, cond: [{ n: "Prone" }], ac: 22, max: 101, pact: { used: 1 }, conc: "Hex" }); expect(t.slots[0].used).toBe(2); expect(S.log[0].pj).toBe(true);
    const loaded = migrate(S); expect(loaded.tok[0]).toMatchObject({ skills: t.skills, extraAtk: t.extraAtk, src: t.src });
    const m = fromMonster(monster("Adult Red Dragon")); expect(migrate(state(m)).tok[0].multiattack).toEqual(m.multiattack);
    expect(refreshedStats(t, fresh).hp).toBeUndefined();
  });
  it("loads canonical sources and reports missing source/data errors without mutation", async () => {
    const t = pc(), old = JSON.stringify(t);
    const get = async <T,>(url: string): Promise<T> => (url.startsWith("/api/page") ? { sheet: engine.sheet } : url.includes("bestiar") ? bestiary : catalog) as T;
    expect((await loadCombatant(t, get)).pact?.max).toBe(2);
    expect((await loadCombatant(fromMonster(monster("Mage")), get)).kouzla?.length).toBeGreaterThan(3);
    await expect(loadCombatant(custom("x", "neutral", 1, 10, 30), get)).rejects.toThrow("nemá zdroj");
    await expect(loadCombatant(t, async () => { throw Error("offline"); })).rejects.toThrow("offline");
    await expect(loadCombatant(t, async <T,>() => ({}) as T)).rejects.toThrow("normalizovaný"); expect(JSON.stringify(t)).toBe(old);
  });
  it("offers reimport only to the GM and only for sourced tokens", () => {
    const t = pc(), S = state(t), props = { S, t, cmd: () => {}, onClose: () => {} };
    const render = (t: typeof props.t, dm: boolean) => renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(TokenInspector, { ...props, t, dm })));
    expect(render(t, true)).toContain("Obnovit statistiky"); expect(render(t, false)).not.toContain("Obnovit statistiky");
    expect(render(custom("x", "neutral", 1, 10, 30), true)).not.toContain("Obnovit statistiky");
  });
});

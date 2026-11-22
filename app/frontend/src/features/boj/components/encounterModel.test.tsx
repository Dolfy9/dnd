import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { custom } from "../rules/combatants";
import { defaultSettings } from "../rules/settings";
import { cur } from "../rules/turn";
import type { StavBoje } from "../types";
import { bulkEncounter, delayEncounter, delayError, reorderEncounter } from "../state/commands/encounter";
import { encounterEffects, rosterGroups } from "./encounterModel";
import EncounterPanel from "./EncounterPanel";

function fixture(): StavBoje {
  const tok = [custom("Hero", "druzina", 100, 16), custom("Ghoul 1", "nepratele", 100, 12), custom("Ghoul 2", "nepratele", 100, 12), custom("Ghoul 3", "nepratele", 100, 12)];
  tok.forEach((t, i) => { t.id = String(i); t.init = 20 - i; t.x = i; t.y = 2; if (i) t.kind = "mon"; });
  return { tok, ord: tok.map(t => t.id), turn: 0, round: 2, eco: {}, log: [], fx: [], zones: [], nastaveni: defaultSettings() };
}
describe("encounter bulk command adapters", () => {
  it("applies mixed resistance, vulnerability and immunity independently, logs and heals", () => {
    const S = fixture(); S.tok[1].odolnosti = ["Fire"]; S.tok[2].zranitelnosti = ["Fire"]; S.tok[3].imunity = ["Fire"];
    bulkEncounter(S, ["1", "2", "3", "missing", "1"], { kind: "damage", amount: 20, type: "Fire" });
    expect(S.tok.map(t => t.hp)).toEqual([100, 90, 60, 100]); expect(S.log.filter(l => l.typ === "damage")).toHaveLength(3);
    bulkEncounter(S, ["1", "2"], { kind: "heal", amount: 5, type: "Fire" }); expect(S.tok.map(t => t.hp)).toEqual([100, 95, 65, 100]);
    const old = JSON.stringify(S); bulkEncounter(S, ["1"], { kind: "damage", amount: NaN, type: "Fire" }); bulkEncounter(S, [], { kind: "kill" }); expect(JSON.stringify(S)).toBe(old);
  });
  it("toggles conditions and visibility, kills and removes while preserving the active actor", () => {
    const S = fixture(); S.turn = 2;
    bulkEncounter(S, ["1", "2"], { kind: "condition", name: "Prone", on: true }); expect(S.tok[1].cond).toContainEqual({ n: "Prone" });
    bulkEncounter(S, ["1"], { kind: "condition", name: "Prone", on: false }); expect(S.tok[1].cond).toEqual([]);
    bulkEncounter(S, ["1"], { kind: "hidden" }); expect(S.tok[1].skryty).toBe(true);
    bulkEncounter(S, ["1"], { kind: "kill" }); expect(S.tok[1]).toMatchObject({ dead: true, hp: 0 });
    bulkEncounter(S, ["0", "1"], { kind: "remove" }); expect(cur(S)?.id).toBe("2"); expect(S.log.length).toBeGreaterThan(4);
    const next = fixture(); next.turn = 1; bulkEncounter(next, ["0", "1"], { kind: "remove" }); expect(cur(next)?.id).toBe("2");
  });
  it("rolls identical monsters as a group only when enabled, preserving turn and round", () => {
    const S = fixture(); const active = cur(S)?.id;
    let calls = 0; const rng = () => .1 * ++calls;
    bulkEncounter(S, ["1", "2", "3"], { kind: "initiative", grouped: true }, rng);
    expect(calls).toBe(1); expect(new Set(S.tok.slice(1).map(t => t.init)).size).toBe(1); expect(cur(S)?.id).toBe(active); expect(S.round).toBe(2);
    bulkEncounter(S, ["1", "2", "3"], { kind: "initiative" }, rng); expect(calls).toBe(4); expect(new Set(S.tok.slice(1).map(t => t.init)).size).toBe(3);
    bulkEncounter(S, ["1", "2"], { kind: "initiative", value: 30 }); expect(cur(S)?.id).toBe(active); expect(S.tok[1].init).toBe(30);
  });
});
describe("roster, manual order and countdowns", () => {
  it("groups by side and source identity with numbered-name fallback", () => {
    const S = fixture(); expect(rosterGroups(S.tok).map(g => g.tokens.length)).toEqual([1, 3]);
    S.tok[3].side = "neutral"; S.tok[1].src = { srd: "ghoul" }; S.tok[2].src = { srd: "ghoul" }; S.tok[2].nazev = "Renamed";
    expect(rosterGroups(S.tok).map(g => g.tokens.length)).toEqual([1, 2, 1]); expect(rosterGroups([])).toEqual([]);
  });
  it("reorders without changing turns, delays an active turn using existing end/start processing", () => {
    const S = fixture(); reorderEncounter(S, "3", "0"); expect(S.ord).toEqual(["3", "0", "1", "2"]); expect(cur(S)?.id).toBe("0");
    delayEncounter(S, "0"); expect(S.ord).toEqual(["3", "1", "2", "0"]); expect(cur(S)?.id).toBe("1"); expect(S.round).toBe(2);
    const old = JSON.stringify(S); reorderEncounter(S, "missing", "0"); reorderEncounter(S, "1", "missing"); expect(JSON.stringify(S)).toBe(old);
  });
  it("lists rounds, source-turn boundaries, zones, absent sources and unbounded effects", () => {
    const S = fixture(); S.tok[1].effects = [{ id: "a", nazev: "Bless", src: "0", mods: {}, duration: { kind: "endOf", who: "0", rounds: 2 } }, { id: "b", nazev: "Slow", mods: {}, duration: { kind: "rounds", rounds: 3 } }, { id: "c", nazev: "Aura", src: "gone", mods: {} }];
    const list = encounterEffects(S); expect(list[0]).toMatchObject({ source: "Hero", target: "Ghoul 1", countdown: "2× konec tahu: Hero" }); expect(list[1].countdown).toBe("3× začátek tahu: Ghoul 1"); expect(list[2].countdown).toBe("Bez časového limitu"); expect(list[2].source).toBe("gone");
    S.zones.push({ id: "z", nazev: "Fog", style: "fog", shape: { kind: "sphere", size: 10 }, anchor: [0, 0], src: "0", duration: { kind: "startOf", who: "0" } }); expect(encounterEffects(S).slice(-1)[0]?.zone).toBe(true);
    expect(encounterEffects(fixture())).toEqual([]);
  });
  it("does not bypass legendary end-turn windows when delaying", () => {
    const S = fixture(); S.tok[1].legendary = { max: 3, used: 0 }; S.tok[1].atk[0].legendaryCost = 1;
    const before = JSON.stringify(S); expect(delayError(S, "0")).toContain("legendární"); delayEncounter(S, "0"); expect(JSON.stringify(S)).toBe(before);
    S.legendaryWindow = { actorId: "0", usedBy: ["1"] }; delayEncounter(S, "0"); expect(S.legendaryWindow).toBeUndefined(); expect(cur(S)?.id).toBe("1"); expect(S.ord[S.ord.length - 1]).toBe("0");
  });
  it("renders roster details, bulk controls, initiative and empty effects", () => {
    const S = fixture(); const html = renderToStaticMarkup(<EncounterPanel S={S} selected={new Set(["1"])} onSelection={() => {}} onFocus={() => {}} cmd={() => {}} onAdd={() => {}} />);
    expect(html).toContain("Ghoul ×3"); expect(html).toContain("300 HP"); expect(html).toContain("Skupinová iniciativa"); expect(html).toContain("Žádné aktivní efekty");
  });
});

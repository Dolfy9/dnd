/* Parsování akcí netvorů a kouzel 2024. */
import { describe, it, expect } from "vitest";
import { parseMonsterAction, monsterAttacks, parseSpell, spellDurationRounds } from "./parse";

const ABO_TENTACLE = "Melee Attack Roll: +9, reach 15 ft. Hit: 12 (2d6 + 5) Bludgeoning damage. If the target is a creature, it has the Grappled condition (escape DC 14) from the aboleth.";
const ABO_CONSUME = "Intelligence Saving Throw: DC 16, one creature the aboleth can see within 30 feet. Failure: 10 (3d6) Psychic damage. Success: Half damage.";
const RECHARGE = "Cold Breath (Recharge 5–6)";

describe("monster actions", () => {
  it("Aboleth Tentacle: +9, reach 15, 2d6+5 Bludgeoning, Grappled DC 14", () => {
    const a = parseMonsterAction("Tentacle", ABO_TENTACLE);
    expect(a.bonus).toBe(9);
    expect(a.melee).toBe(true);
    expect(a.reach).toBe(15);
    expect(a.dmg).toBe("2d6+5");
    expect(a.typ).toBe("Bludgeoning");
    expect(a.condOnHit?.[0]).toEqual({ n: "Grappled", dc: 14 });
  });
  it("Aboleth Consume Memories: INT DC 16, 3d6 Psychic, half", () => {
    const a = parseMonsterAction("Consume Memories", ABO_CONSUME);
    expect(a.save).toBe("INT");
    expect(a.dc).toBe(16);
    expect(a.dmg).toBe("3d6");
    expect(a.typ).toBe("Psychic");
    expect(a.half).toBe(true);
    expect(a.range).toBe(30);
  });
  it("Recharge X–6 se přečte", () => {
    const a = parseMonsterAction(RECHARGE, "Dexterity Saving Throw: DC 14, each creature in a 30-foot Cone. Failure: 22 (4d8) Cold damage.");
    expect(a.rc).toBe(5);
    expect(a.save).toBe("DEX");
    expect(a.area).toEqual({ shape: "cone", size: 30 });
  });
  it("multiattack count na útocích", () => {
    const m = {
      nazev: "X", cr: "1", typ: "beast", velikost: "Large", ac: 10, hp: 10,
      akce: [
        { nazev: "Multiattack", text: "The X makes two attacks." },
        { nazev: "Bite", text: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage." },
      ],
    } as any;
    const atks = monsterAttacks(m);
    expect(atks[0].n).toBe(2);
  });
});

const FIREBALL = {
  uroven: 3, cas: "Action", dosah: "150 feet", trvani: "Instantaneous",
  text: "A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one.\nUsing a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 3.",
};
const HOLD = {
  uroven: 2, cas: "Action", dosah: "60 feet", trvani: "Concentration, up to 1 minute",
  text: "Choose a Humanoid that you can see within range. The target must succeed on a Wisdom saving throw or have the Paralyzed condition for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success.",
};

describe("spells", () => {
  const ctx = { dc: 15, atk: 7, smod: 4, lvl: 5 };
  it("Fireball: DEX save, 8d6 Fire, 20 ft sphere, +1d6/slot", () => {
    const a = parseSpell("Fireball", { Fireball: FIREBALL as any }, ctx)!;
    expect(a).not.toBeNull();
    expect(a.save).toBe("DEX");
    expect(a.dc).toBe(15);
    expect(a.dmg).toBe("8d6");
    expect(a.typ).toBe("Fire");
    expect(a.area).toEqual({ shape: "sphere", size: 20 });
    expect(a.half).toBe(true);
    expect(a.pozn).toMatch(/1d6/);
  });
  it("concentration duration 1 min = 10 kol", () => {
    const a = parseSpell("Hold Person", { "Hold Person": HOLD as any }, ctx);
    // Hold Person nemá damage → parseSpell vrací null (utility), duration testujeme přímo
    expect(spellDurationRounds("Concentration, up to 1 minute")).toBe(10);
    expect(spellDurationRounds("Concentration, up to 10 minutes")).toBe(100);
    expect(spellDurationRounds("1 hour")).toBe(600);
    void a;
  });
  it("cantrip scaling podle úrovně", () => {
    const fb = { uroven: 0, cas: "Action", dosah: "120 feet", trvani: "Instantaneous",
      text: "You hurl a bolt of fire. Make a ranged spell attack. On a hit, the target takes 1d10 Fire damage.\nCantrip Upgrade. The damage increases by 1d10 when you reach levels 5, 11, and 17." } as any;
    const a17 = parseSpell("Fire Bolt", { "Fire Bolt": fb }, { ...ctx, lvl: 17 })!;
    const a1 = parseSpell("Fire Bolt", { "Fire Bolt": fb }, { ...ctx, lvl: 1 })!;
    expect(a17.dmg).toMatch(/^4d10/);
    expect(a1.dmg).toMatch(/^1d10/);
  });
});

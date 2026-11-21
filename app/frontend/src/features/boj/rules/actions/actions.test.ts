/* Testy akcí 2024: grapple/shove/escape, hide/search, pohyb, TWF, shield, heal, klasifikace. */
import { describe, it, expect } from "vitest";
import { grappleDc, grappleSizeOk, grappleResolve, escapeResolve, hideResolve, searchResolve,
         standUpCost, crawlMult, climbSwimMult, longJumpFt, highJumpFt, fallingDice, fallingDamage,
         twfDamageMod, shieldTurnsMiss, parseHealing, upcastHeal, classifySpell } from "./actions";
import { mkTok } from "../rules.test";
import type { Rng } from "../dice";
// @ts-ignore vitest node env
import { readFileSync, readdirSync, statSync } from "node:fs";
// @ts-ignore
import { join, dirname } from "node:path";
// @ts-ignore
import { fileURLToPath } from "node:url";

const hi: Rng = () => 0.999;  // d20 → 20
const lo: Rng = () => 0.01;   // d20 → 1

describe("Grapple", () => {
  it("DC = 8 + STR + PB; cíl max o 1 size větší", () => {
    const A = mkTok({ mods: { STR: 4 } as any, pb: 3, s: 1 });
    expect(grappleDc(A)).toBe(15);
    expect(grappleSizeOk(A, mkTok({ s: 2 }))).toBe(true);   // Large ok
    expect(grappleSizeOk(A, mkTok({ s: 3 }))).toBe(false);  // Huge je o 2 kategorie — zamítnuto
  });

  it("save STR/DEX vyšší vs DC", () => {
    const A = mkTok({ mods: { STR: 4 } as any, pb: 2 });
    const B = mkTok({ saves: { STR: 9, DEX: 1 } as any });
    expect(grappleResolve(A, B, hi)!.ok).toBe(false); // 20+9 ≥ 14
    expect(grappleResolve(A, B, lo)!.ok).toBe(true);  // 1+9 < 14
  });
  it("Escape Athletics vs DC", () => {
    const A = mkTok({ mods: { STR: 2 } as any, pb: 2 });   // DC 12
    const B = mkTok({ skills: { Athletics: 8 } });
    expect(escapeResolve(B, A, lo).ok).toBe(false);        // 1+8 < 12
    expect(escapeResolve(B, A, hi).ok).toBe(true);         // 20+8 ≥ 12
  });
});

describe("Hide / Search", () => {
  it("Hide DC 15 Stealth", () => {
    const t = mkTok({ skills: { Stealth: 9 } });
    expect(hideResolve(t, lo).ok).toBe(false);   // 1+9 < 15
    expect(hideResolve(t, hi).ok).toBe(true);    // 20+9 ≥ 15
  });
  it("Search Perception/Investigation vs Stealth total", () => {
    const s = mkTok({ skills: { Perception: 5, Investigation: 12 } });
    expect(searchResolve(s, 17, hi).ok).toBe(true);   // 20+12 ≥ 17
    expect(searchResolve(s, 17, lo).ok).toBe(false);  // 1+12 < 17
  });
});

describe("Pohyb", () => {
  it("Stand Up = ½ speed; Crawl ×2 za Prone; Climb/Swim ×2 bez speedu", () => {
    const t = mkTok({ speed: 30 });
    expect(standUpCost(t)).toBe(15);
    expect(crawlMult(t)).toBe(1);
    expect(crawlMult(mkTok({ cond: [{ n: "Prone" }] }))).toBe(2);
    expect(climbSwimMult(mkTok({ climb: 0, swim: 0 }), "swim")).toBe(2);
    expect(climbSwimMult(mkTok({ swim: 40 }), "swim")).toBe(1);
  });
  it("Long Jump = STR skóre (s rozběhem) / ½ bez; High = 3+mod / ½", () => {
    const t = mkTok({ mods: { STR: 4 } as any }); // STR 18
    expect(longJumpFt(t, true)).toBe(18);
    expect(longJumpFt(t, false)).toBe(9);
    expect(highJumpFt(t, true)).toBe(7);
    expect(highJumpFt(t, false)).toBe(3);
  });
  it("Falling: 1d6/10 ft, max 20d6, <10 ft nic", () => {
    expect(fallingDice(35)).toBe("3d6");
    expect(fallingDice(250)).toBe("20d6");
    expect(fallingDamage(5, hi)).toBe(0);
    expect(fallingDamage(30, hi)).toBe(18); // 3d6 max = 18
  });
});

describe("TWF / Shield", () => {
  it("off-hand bez pozitivního modu, se stylem s ním", () => {
    expect(twfDamageMod(mkTok({ mods: { STR: 3 } as any }))).toBe(0);
    expect(twfDamageMod(mkTok({ mods: { STR: 3 } as any, feats: ["Two-Weapon Fighting"] }))).toBe(3);
  });
  it("Shield +5 AC změní hit na miss", () => {
    expect(shieldTurnsMiss(18, 14)).toBe(true);   // 18 < 19
    expect(shieldTurnsMiss(19, 14)).toBe(false);  // 19 ≥ 19
  });
});

describe("Healing parse + upcast", () => {
  it("Cure Wounds text → 1d8, upcast +1d8/úroveň", () => {
    const h = parseHealing("the target regains 1d8 + your spellcasting ability modifier Hit Points", 1, 3)!;
    expect(h.dice).toBe("1d8");
    expect(upcastHeal(h, 1, 3).dice).toBe("3d8");
  });
  it("flat bonus bez kostek → null", () => {
    expect(parseHealing("regains 10 Hit Points", 1, 3)).toBeNull();
  });
});

describe("Klasifikace kouzel — audit všech postav v repu", () => {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "..", "..");
  const spells = JSON.parse(readFileSync(join(repo, "web/assets/kouzla2024.json"), "utf8")) as Record<string, any>;
  // rekurzivně najdi Postava_*.md s "kouzla:" v YAML
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f);
    if (statSync(p).isDirectory() && !f.startsWith(".") && f !== "node_modules") walk(p);
    else if (/^Postava_.*\.md$/.test(f)) files.push(p); } };
  walk(join(repo, "04_Postavy"));
  const presetNames = new Set(Object.keys(spells).filter((n) => /damage|saving throw/i.test(spells[n]?.text || "")));
  const rows: string[] = [];
  let total = 0, unclassified = 0;
  for (const f of files) {
    const md = readFileSync(f, "utf8");
    const yaml = md.match(/^postava:\s*\n((?:  .+\n?)+)/m)?.[1] || "";
    const ksec = yaml.match(/kouzla:\s*\n([\s\S]*?)(?=\n  [a-z_]+:|$)/)?.[1] || "";
    const names = [...ksec.matchAll(/nazev:\s*"?([^"\n]+?)"?\s*$/gm)].map((m) => m[1].trim());
    for (const n of names) {
      total++;
      const meta = spells[n] || spells[Object.keys(spells).find((x) => x.toLowerCase() === n.toLowerCase()) || ""];
      const kind = meta ? classifySpell({ nazev: n, text: meta.text || "", cas: meta.cas || "" }, presetNames) : "utility";
      if (!kind) unclassified++;
      rows.push(`${f.split(/[\/]/).pop()} | ${n} | ${kind}`);
    }
  }
  it("každé kouzlo každé postavy je klasifikováno (žádné nepadá)", () => {
    // eslint-disable-next-line no-console
    console.log(`\n=== Klasifikace kouzel: ${total} kouzel / ${files.length} postav ===\n` + rows.join("\n"));
    expect(total).toBeGreaterThan(0);
    expect(unclassified).toBe(0);
  });
});

import type { AttackDef, MonsterEntry, SpellEntry, Token, Ability } from "../types";
import { parseSpell } from "./parse";

export type SpellCatalog = Record<string, SpellEntry>;
export function linkedSpell(name: string, catalog: SpellCatalog, token: Token, entry?: Partial<SpellEntry>, casting = token.casting): AttackDef | null {
  const key = Object.keys(catalog).find(k => k.toLowerCase() === name.toLowerCase()) || name;
  const data = { ...catalog[key], ...Object.fromEntries(Object.entries(entry || {}).filter(([, v]) => v != null && v !== "")) } as SpellEntry;
  const result = parseSpell(name, { [name]: data }, { dc: casting?.dc ?? token.dc ?? 10, atk: casting?.atk ?? 0, smod: token.mods[casting?.ab || "INT"] ?? 0, lvl: token.lvl || 1 });
  return result || { nazev: name, kouzlo: name, kind: "spell", lvl: data.uroven, text: data.text, utility: true };
}

export function importMonsterSpells(m: MonsterEntry, token: Token, catalog: SpellCatalog) {
  const blocks = [...(m.akce || []), ...(m.rysy || [])].filter(a => /spellcasting/i.test(a.nazev));
  const text = blocks.map(a => a.text).join("\n");
  const ab = text.match(/using (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) as/i)?.[1];
  const dc = text.match(/spell save DC (\d+)/i)?.[1];
  const atk = text.match(/([+−-]\d+) to hit with spell attacks/i)?.[1];
  if (dc) {
    token.dc = Number(dc);
    token.casting = { ab: ab?.slice(0, 3).toUpperCase() as Ability, dc: token.dc, atk: atk ? Number(atk.replace("−", "-")) : token.dc - 8 };
  }
  const spells: AttackDef[] = [];
  const add = (name: string, daily?: number, pool = name, cost?: "bonus" | "reaction") => {
    const spell = linkedSpell(name, catalog, token);
    if (!spell) return;
    spell.innate = true; spell.xd = daily; spell.ba = cost === "bonus" || spell.ba; spell.rea = cost === "reaction" || spell.rea;
    if (daily) {
      spell.uses = pool;
      if (!token.zdroje.some(z => z.nazev === pool)) token.zdroje.push({ nazev: pool, max: daily, used: 0, obnova: "long" });
    }
    if (!spells.some(s => s.kouzlo === spell.kouzlo && s.ba === spell.ba && s.rea === spell.rea)) spells.push(spell);
  };
  for (const line of text.split("\n")) {
    const row = line.replace(/\*/g, "").match(/^\s*[-•]?\s*(At Will|\d+\/Day(?: Each)?):\s*(.*)/i);
    if (!row) continue;
    for (const value of row[2].split(",")) {
      const name = value.replace(/\s*\(.*?\)/g, "").trim();
      if (name) add(name, /^At Will/i.test(row[1]) ? undefined : Number(row[1].match(/\d+/)?.[0]));
    }
  }
  for (const [actions, cost] of [[m.bonusove_akce || [], "bonus"], [m.reakce || [], "reaction"]] as const) {
    for (const action of actions) {
      if (!/casts? /i.test(action.text)) continue;
      const daily = Number(action.nazev.match(/(\d+)\/Day/i)?.[1]) || undefined;
      for (const name of Object.keys(catalog).sort((a, b) => b.length - a.length)) {
        const match = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").exec(action.text);
        if (match && /casts?\s/i.test(action.text.slice(0, match.index))) add(name, daily, action.nazev, cost);
      }
    }
  }
  token.kouzla = spells;
}

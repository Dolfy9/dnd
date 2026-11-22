import type { Token, MonsterEntry } from "../types";
import { fromCharacter, fromMonster } from "./combatants";
import type { SpellCatalog } from "./importSpells";

export async function loadCombatant(t: Token, get: <T>(url: string) => Promise<T>): Promise<Token> {
  if (!t.src?.cesta && !t.src?.srd) throw new Error("Žeton nemá zdroj pro import.");
  const catalog = await get<SpellCatalog>("/repo/web/assets/kouzla2024.json");
  if (t.src.cesta) {
    const page = await get<any>(`/api/page?path=${encodeURIComponent(t.src.cesta)}`);
    const sheet = page.entity?.sheet || page.sheet;
    if (!sheet?.boj) throw new Error("Zdroj neobsahuje normalizovaný bojový list.");
    return fromCharacter(t.src.cesta, t.nazev, sheet, t.side, page.entity?.portret || page.portret, catalog);
  }
  const monsters = await get<MonsterEntry[]>("/repo/web/assets/srd/bestiar.json");
  const monster = monsters.find(m => m.nazev === t.src?.srd);
  if (!monster) throw new Error("Netvor už není v katalogu.");
  return fromMonster(monster, t.side, catalog);
}

export function refreshedStats(t: Token, fresh: Token): Partial<Token> {
  const keys: (keyof Token)[] = ["max", "ac", "initB", "s", "velikost", "typ", "speed", "fly", "swim", "climb", "burrow", "saves", "mods", "atk", "kouzla", "pb", "dc", "casting", "extraAtk", "skills", "feats", "features", "items", "lvl", "cr", "xp", "odolnosti", "imunity", "zranitelnosti", "imunity_stavu", "smysly", "rysy", "multiattack"];
  return {
    ...Object.fromEntries(keys.map(k => [k, fresh[k]])), src: { ...fresh.src, owner: t.src?.owner },
    slots: fresh.slots.map((s, i) => ({ ...s, used: t.slots[i]?.used || 0 })),
    pact: fresh.pact ? { ...fresh.pact, used: t.pact?.used || 0 } : undefined,
    zdroje: fresh.zdroje.map(z => ({ ...z, used: t.zdroje.find(old => old.nazev === z.nazev)?.used || 0 })),
    legendary: fresh.legendary ? { ...fresh.legendary, used: t.legendary?.used || 0, resist: fresh.legendary.resist ? { ...fresh.legendary.resist, used: t.legendary?.resist?.used || 0 } : undefined } : undefined,
  };
}

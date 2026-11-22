import type { StavBoje, Token, ActiveEffect } from "../types";

export const creatureType = (t: Token) => t.src?.srd || t.nazev.replace(/\s*(?:[·#]\s*)?\d+\s*$/, "").trim();
export function rosterGroups(tokens: Token[]) {
  return (["druzina", "nepratele", "neutral"] as const).flatMap(side => {
    const groups = new Map<string, Token[]>();
    for (const t of tokens.filter(t => t.side === side)) {
      const key = creatureType(t); groups.set(key, [...(groups.get(key) || []), t]);
    }
    return [...groups].map(([key, tokens]) => ({ side, key, name: tokens[0].nazev.replace(/\s*(?:[·#]\s*)?\d+\s*$/, "").trim(), tokens }));
  });
}
export function effectCountdown(S: StavBoje, duration: ActiveEffect["duration"], target: string) {
  if (!duration) return "Bez časového limitu";
  const who = S.tok.find(t => t.id === (duration.kind === "rounds" ? target : duration.who));
  return `${duration.rounds ?? 1}× ${duration.kind === "endOf" ? "konec" : "začátek"} tahu: ${who?.nazev || "neznámý tvor"}`;
}
export function encounterEffects(S: StavBoje) {
  return [
    ...S.tok.flatMap(t => t.effects.map(e => ({ id: `${t.id}:${e.id}`, effectId: e.id, targetId: t.id, name: e.nazev, target: t.nazev, source: S.tok.find(s => s.id === e.src)?.nazev || e.src || "—", countdown: effectCountdown(S, e.duration, t.id), zone: false }))),
    ...S.zones.map(z => ({ id: `zone:${z.id}`, effectId: z.id, targetId: z.tokenId || z.src || "", name: z.nazev, target: "Zóna", source: S.tok.find(t => t.id === z.src)?.nazev || z.src || "—", countdown: effectCountdown(S, z.duration, z.src || ""), zone: true })),
  ];
}

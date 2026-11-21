/* Agregace aktivních efektů a presetová knihovna (Phase A jádro, Phase B rozšíří data). */
import type { Token, ActiveEffect, Zone, EffectMods, Ability, DmgType, EffectPreset } from "../types";
import { EFFECT_PRESETS } from "./presets";
import { uid } from "../types";
import { cellsOf } from "./grid";

/** Složené modifikátory efektů na tokenu (jen čtení). */
export function sumMods(t: Token): EffectMods {
  const m: EffectMods = {};
  for (const e of t.effects || []) {
    const x = e.mods || {};
    for (const k of ["atkAdvBy", "atkDisBy", "atkAdv", "atkDis", "saveAdvAll", "noOA", "dodge", "helpBonus", "vex", "sap", "extraAction", "extraAtk", "advOnHitBy", "rechargeBonus", "noHeal", "nextAtkAdvBy", "nextAtkDis", "uncanny", "evasion", "stealthDisDetect"] as const)
      if (x[k]) (m as any)[k] = true;
    if (x.toHitBonus) m.toHitBonus = (m.toHitBonus || 0) + x.toHitBonus;
    if (x.acBonus) m.acBonus = (m.acBonus || 0) + x.acBonus;
    if (x.acSet) m.acSet = Math.max(m.acSet || 0, x.acSet);
    if (x.speedBonus) m.speedBonus = (m.speedBonus || 0) + x.speedBonus;
    if (x.flySpeedSet) m.flySpeedSet = Math.max(m.flySpeedSet || 0, x.flySpeedSet);
    if (x.mirrorImages) m.mirrorImages = (m.mirrorImages || 0) + x.mirrorImages;
    if (x.dmgBonusMelee) m.dmgBonusMelee = (m.dmgBonusMelee || 0) + x.dmgBonusMelee;
    if (x.slowFt) m.slowFt = (m.slowFt || 0) + x.slowFt;
    if (x.nextSaveDice) m.nextSaveDice = (m.nextSaveDice || "") + (m.nextSaveDice ? x.nextSaveDice.startsWith("-") ? "" : "+" : "") + x.nextSaveDice;
    if (x.sneakDmg) m.sneakDmg = x.sneakDmg;
    if (x.dmgOnHitOnce) m.dmgOnHitOnce = x.dmgOnHitOnce;
    if (x.sizeDelta) m.sizeDelta = x.sizeDelta;
    if (x.speedMult) m.speedMult = (m.speedMult || 1) * x.speedMult;
    if (x.speedSet != null) m.speedSet = m.speedSet != null ? Math.min(m.speedSet, x.speedSet) : x.speedSet;
    if (x.toHitDice) m.toHitDice = (m.toHitDice || "") + (m.toHitDice ? x.toHitDice.startsWith("-") ? "" : "+" : "") + x.toHitDice;
    if (x.saveDice) m.saveDice = (m.saveDice || "") + (m.saveDice ? x.saveDice.startsWith("-") ? "" : "+" : "") + x.saveDice;
    if (x.saveAdvAb) m.saveAdvAb = [...(m.saveAdvAb || []), ...x.saveAdvAb];
    if (x.saveDisAb) m.saveDisAb = [...(m.saveDisAb || []), ...x.saveDisAb];
    if (x.dmgResist) m.dmgResist = mergeDmg(m.dmgResist, x.dmgResist) as any;
    if (x.dmgVuln) m.dmgVuln = mergeDmg(m.dmgVuln as any, x.dmgVuln as any) as any;
    if (x.dmgImun) m.dmgImun = mergeDmg(m.dmgImun as any, x.dmgImun as any) as any;
    if (x.extraDmgOnHit) m.extraDmgOnHit = x.extraDmgOnHit; // nestackuje: poslední vyhrává
    if (x.grantsCond) m.grantsCond = x.grantsCond;
  }
  return m;
}

const mergeDmg = (a: DmgType[] | "all" | undefined, b: DmgType[] | "all" | undefined): DmgType[] | "all" => {
  if (a === "all" || b === "all") return "all";
  return [...new Set([...(a || []), ...(b || [])])];
};

/** Skutečná AC tokenu včetně efektů (Shield, Shield of Faith…). */
export const effectiveAc = (t: Token): number => {
  const m = sumMods(t);
  const base = m.acSet ? Math.max(t.ac, m.acSet + Math.max(0, t.mods?.DEX ?? 0)) : t.ac;
  return base + (m.acBonus || 0);
};

/** Ticky duration efektů; vrátí názvy expirovaných. */
export function tickEffects(t: Token, phase: "start" | "end", actorId?: string): string[] {
  const gone: string[] = [];
  t.effects = (t.effects || []).filter((e) => {
    const d = e.duration;
    if (!d) return true;
    if (d.kind === "rounds" && phase === "start") {
      d.rounds = (d.rounds ?? 1) - 1;
      if (d.rounds <= 0) { gone.push(e.nazev); return false; }
    }
    if (d.kind === "endOf" && phase === "end" && d.who === actorId) { gone.push(e.nazev); return false; }
    if (d.kind === "startOf" && phase === "start" && d.who === actorId) { gone.push(e.nazev); return false; }
    return true;
  });
  return gone;
}

/** Odpojení efektů/zón vázaných na Concentration `spell` od zdroje `srcId`. */
export const dropConcentration = (tokens: Token[], zones: Zone[], srcId: string, spell: string) => {
  const messages: string[] = [];
  for (const t of tokens) {
    const keep = (t.effects || []).filter((e) => !(e.conc === spell && e.src === srcId));
    if (keep.length !== (t.effects || []).length) {
      const src = tokens.find((x) => x.id === srcId);
      messages.push(`${t.nazev}: konec efektu (${spell}${src ? ` od ${src.nazev}` : ""})`);
    }
    t.effects = keep;
  }
  const kept = zones.filter((z) => !(z.conc === spell && z.src === srcId));
  if (kept.length !== zones.length) messages.push(`Zóna ${spell} zanikla (konec Concentration)`);
  return { zones: kept, messages };
};

/** Kryje zóna buňku? (emanation řeší host — zná polohu zdrojového tokenu). */
export function zoneCoversLocal(z: Zone, x: number, y: number, srcTok?: Token | null): boolean {
  const { kind, size, w, h } = z.shape;
  const r = size / 5;
  if (kind === "emanation") {
    if (!srcTok || srcTok.x == null) return false;
    const cx = srcTok.x + srcTok.s / 2, cy = srcTok.y! + srcTok.s / 2;
    return Math.max(Math.abs(x + 0.5 - cx), Math.abs(y + 0.5 - cy)) - srcTok.s / 2 - 0.5 <= r;
  }
  const [ax, ay] = z.anchor;
  if (kind === "rect") return x >= ax && x < ax + (w || 1) && y >= ay && y < ay + (h || 1);
  if (kind === "cube") {
    const half = Math.max(1, Math.ceil(r / 2));
    return x >= ax - half && x <= ax + half && y >= ay - half && y <= ay + half;
  }
  if (kind === "line") {
    const dir = ((z.dir ?? 0) * Math.PI) / 180;
    const dx = x + 0.5 - (ax + 0.5), dy = y + 0.5 - (ay + 0.5);
    const along = dx * Math.cos(dir) + dy * Math.sin(dir);
    const perp = Math.abs(dx * Math.sin(dir) - dy * Math.cos(dir));
    return along >= -0.5 && along <= r + 0.5 && perp <= (w ? w / 10 : 0.5) + 0.001;
  }
  if (kind === "cone") {
    const dir = ((z.dir ?? 0) * Math.PI) / 180;
    const dx = x + 0.5 - (ax + 0.5), dy = y + 0.5 - (ay + 0.5);
    const along = dx * Math.cos(dir) + dy * Math.sin(dir);
    const perp = Math.abs(dx * Math.sin(dir) - dy * Math.cos(dir));
    return along > -0.5 && along <= r + 0.5 && perp <= Math.max(0, along) / 2 + 0.5;
  }
  const cx = ax + 0.5, cy = ay + 0.5;
  return Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r + 0.001;
}

/** Zóny, ve kterých token stojí (potřebuje seznam tokenů pro emanation). */
export function zonesOn(t: Token, zones: Zone[], tokens: Token[]): Zone[] {
  return zones.filter((z) => {
    const srcTok = z.tokenId ? tokens.find((x) => x.id === z.tokenId) : undefined;
    if (z.tokenId === t.id) return false; // vlastní emanation netriggeruje držitele
    return cellsOf(t).some(([x, y]) => zoneCoversLocal(z, x, y, srcTok));
  });
}


export const presetById = (id: string) => EFFECT_PRESETS.find((p) => p.id === id);
export { EFFECT_PRESETS };
export type { EffectPreset };

export function makeEffect(p: EffectPreset, srcId: string | undefined, concName?: string): ActiveEffect {
  return {
    id: uid(), nazev: p.nazev, icon: p.icon, style: p.cat, src: srcId,
    conc: p.conc ? concName || p.nazev : undefined,
    duration: p.durationRounds != null ? { kind: "rounds", rounds: p.durationRounds } : undefined,
    saveEnd: p.saveEnd ? { ab: p.saveEnd.ab, dc: 0 } : undefined,
    mods: { ...p.mods },
  };
}

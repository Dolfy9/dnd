/* effects.ts */
import type { StavBoje, Token, Zone, AttackDef, FxEvent } from "../../types";
import { uid } from "../../types";
import { rollInitiative, advanceTurn, byId, log, useEco, ecoFree, ecoOf, moveLeft, resetEconomy } from "../../rules/turn";
import { evaluateAttack, resolveAttack, type AttackCtx } from "../../rules/attack";
import { applyDamage, applyHealing, setTempHp, deathSave } from "../../rules/damage";
import { resolveSave } from "../../rules/saves";
import { zonesOn, dropConcentration, makeEffect, presetById, sumMods } from "../../rules/effects";
import { reachable, gapFt, hostile, cellsOf, meleeReach, oaAlong } from "../../rules/grid";
import { coverOf } from "../../rules/los";
import { tokensInArea, areaCells, type AreaSpec } from "../../rules/areas";
import { numberDuplicates } from "../../rules/combatants";
import { d20, rollDice, defaultRng } from "../../rules/dice";
import { hasCond, isIncap, speedOf } from "../../rules/conditions";
import { resourceAction, restResources } from "../../rules/resources";
import { canSeeTarget } from "../../rules/lighting";
import type { BattleMapData } from "../../types";
import { fx } from "./shared";

/* ---------- stavy / efekty ---------- */
export const toggleCond = (S: StavBoje, id: string, n: string, on?: boolean, dc?: number) => {
  const t = byId(S, id); if (!t) return;
  const has = hasCond(t, n);
  const want = on ?? !has;
  if (want && !has) { t.cond.push({ n }); log(S, "cond", `${t.nazev}: +${n}`, t.nazev); }
  if (!want && has) { t.cond = t.cond.filter((c) => c.n !== n); log(S, "cond", `${t.nazev}: −${n}`, t.nazev); }
  if (n === "Unconscious" && want && t.hp <= 0) t.dying = true;
};
export const addEffect = (S: StavBoje, id: string, presetId: string, srcId?: string) => {
  const t = byId(S, id); if (!t) return;
  const p = presetById(presetId); if (!p) return;
  const src = srcId ? byId(S, srcId) : undefined;
  t.effects.push(makeEffect(p, srcId, p.conc ? p.nazev : undefined));
  if (p.grantsCond && !hasCond(t, p.grantsCond)) t.cond.push({ n: p.grantsCond, src: srcId });
  if (p.conc && src) { dropConc(S, src.id); src.conc = p.nazev; }
  if (p.zone) {
    const zp = p.zone;
    S.zones.push({
      id: uid(), nazev: p.nazev, style: zp.style,
      shape: { ...zp.shape },
      anchor: t.x != null ? [t.x, t.y!] : [0, 0],
      src: srcId || t.id, tokenId: zp.shape.kind === "emanation" ? t.id : undefined,
      conc: p.conc ? p.nazev : undefined, trigger: zp.trigger,
      difficult: zp.difficult, blocksLos: zp.blocksLos,
    });
  }
  log(S, "effect", `${t.nazev}: efekt ${p.nazev}${p.conc ? " (Concentration)" : ""}`, src?.nazev || "PJ");
};
export const removeEffect = (S: StavBoje, id: string, effId: string) => {
  const t = byId(S, id); if (!t) return;
  const e = t.effects.find((x) => x.id === effId); if (!e) return;
  if (e.mods?.grantsCond) t.cond = t.cond.filter((c) => c.n !== e.mods!.grantsCond || c.src !== e.src);
  t.effects = t.effects.filter((x) => x.id !== effId);
  log(S, "effect", `${t.nazev}: efekt ${e.nazev} odebrán`, "PJ");
};
export const dropConc = (S: StavBoje, srcId: string) => {
  const src = byId(S, srcId); if (!src?.conc) return;
  const spell = src.conc;
  const res = dropConcentration(S.tok, S.zones, srcId, spell);
  S.zones = res.zones;
  for (const t of S.tok)
    for (const e of t.effects)
      if (e.mods?.grantsCond && e.conc === spell && e.src === srcId)
        t.cond = t.cond.filter((c) => c.n !== e.mods!.grantsCond || c.src !== srcId);
  src.conc = false;
  log(S, "effect", `${src.nazev}: konec Concentration (${spell})`, src.nazev);
  for (const m of res.messages) log(S, "effect", m, "PJ");
};
export const addZone = (S: StavBoje, z: Omit<Zone, "id">) => {
  S.zones.push({ ...z, id: uid() });
  log(S, "effect", `Zóna ${z.nazev} vytvořena`, "PJ");
};
export const removeZone = (S: StavBoje, id: string) => {
  const z = S.zones.find((x) => x.id === id); if (!z) return;
  S.zones = S.zones.filter((x) => x.id !== id);
  log(S, "effect", `Zóna ${z.nazev} odstraněna`, "PJ");
};

/* ---------- zona z presetu na danem miste ---------- */
export function cmdPresetZone(S: StavBoje, presetId: string, anchor: [number, number], dir: number, srcId?: string) {
  const p = presetById(presetId);
  if (!p?.zone) return;
  const src = srcId ? byId(S, srcId) : undefined;
  S.zones.push({
    id: uid(), nazev: p.nazev, style: p.zone.style, shape: { ...p.zone.shape },
    anchor, dir, src: srcId || src?.id, conc: p.conc ? p.nazev : undefined,
    trigger: p.zone.trigger, difficult: p.zone.difficult, blocksLos: p.zone.blocksLos,
    duration: p.durationRounds ? { kind: "rounds", rounds: p.durationRounds } : undefined,
  });
  if (p.conc && src) { dropConc(S, src.id); src.conc = p.nazev; }
  log(S, "effect", `Zona ${p.nazev} na (${anchor[0]},${anchor[1]})`, src?.nazev || "PJ");
}

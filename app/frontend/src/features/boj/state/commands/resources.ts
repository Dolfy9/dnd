/* resources.ts */
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
import { settingsOf } from "../../rules/settings";

/* ---------- zdroje / odpocinek ---------- */
function checkRes(S: StavBoje, setting: "hlidat" | "varovat" | "vypnuto", override: boolean | undefined, msg: string): boolean {
  if (setting === "vypnuto") return true;
  if (setting === "varovat") { log(S, "system", `⚠ ${msg}`, "PJ"); return true; }
  return !!override;
}
export function cmdUseResource(S: StavBoje, id: string, idx: number, amount?: number, override?: boolean): { ok: boolean; msg: string } {
  const t = byId(S, id); if (!t) return { ok: false, msg: "?" };
  const st = settingsOf(S).automatizace;
  const z = t.zdroje?.[idx];
  if (!z) return { ok: false, msg: "neznamy zdroj" };
  if (z.used >= z.max) {
    if (!checkRes(S, st.sloty, override, `${t.nazev}: ${z.nazev} přes vyčerpání (⚙ DM)`))
      return { ok: false, msg: `${z.nazev}: vycerpano` };
    if (override) z.used = z.max; // DM: povolit poslední použití
    else return { ok: false, msg: `${z.nazev}: vycerpano` };
  }
  const act = resourceAction(z.nazev, t);
  if (act.eco && act.eco !== "free" && !ecoFree(S, t, act.eco)
      && !checkRes(S, st.ekonomika, override, `${t.nazev}: ${z.nazev} přes použitou ekonomiku (⚙ DM)`))
    return { ok: false, msg: `${z.nazev}: ${act.eco === "b" ? "Bonus Action" : "akce/reakce"} uz pouzita` };
  if (act.needsAmount && (amount == null || amount <= 0))
    return { ok: false, msg: "zadej castku" };
  const spend = act.needsAmount ? Math.min(amount!, z.max - z.used) : 1;
  z.used += spend;
  if (act.eco && act.eco !== "free") useEco(S, t, act.eco);
  switch (act.kind) {
    case "heal": {
      const amt = act.healDice ? rollDice(act.healDice).total + (act.healAdd || 0) : spend;
      const r = applyHealing(t, amt);
      fx(S, "heal", { to: [t.x ?? 0, t.y ?? 0], text: `+${r.healed}`, dmgType: "heal", tokenId: t.id });
      log(S, "heal", `${t.nazev}: ${z.nazev} → +${r.healed} HP`, t.nazev);
      return { ok: true, msg: `+${r.healed} HP` };
    }
    case "extraAction": {
      const e = ecoOf(S, t);
      e.a = Math.max(0, e.a - 1);
      log(S, "effect", `${t.nazev}: Action Surge — akce navic`, t.nazev);
      return { ok: true, msg: "+1 akce" };
    }
    case "preset": {
      const p = presetById(act.presetId || "");
      if (p) { t.effects.push(makeEffect(p, t.id)); log(S, "effect", `${t.nazev}: ${p.nazev}`, t.nazev); }
      return { ok: true, msg: p ? p.nazev : "ok" };
    }
    case "area":
      return { ok: true, msg: "breath" };
    default:
      log(S, "effect", `${t.nazev}: ${z.nazev} (${z.used}/${z.max})`, t.nazev);
      return { ok: true, msg: `${z.used}/${z.max}` };
  }
}

export function cmdRest(S: StavBoje, ids: string[], kind: "short" | "long") {
  for (const m of restResources(S, ids, kind)) log(S, "system", m, "PJ");
  log(S, "turn", kind === "long" ? "Long Rest" : "Short Rest", "PJ");
}

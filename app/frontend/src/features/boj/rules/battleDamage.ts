import type { StavBoje, Token } from "../types";
import { applyDamage, type DmgPart } from "./damage";
import { defaultRng, type Rng } from "./dice";
import { dropConcentration } from "./effects";
import { isIncap } from "./conditions";
import { isFree } from "./free";
import { resolveSave } from "./saves";
import { settingsOf } from "./settings";
import { log } from "./turn";
import { enqueueDecision } from "./pending";

export function applyBattleDamage(S: StavBoje, t: Token, parts: DmgPart[], opts: Parameters<typeof applyDamage>[2] = {}, rng: Rng = defaultRng) {
  const result = applyDamage(t, parts, opts);
  if (!t.conc || result.applied <= 0) return result;
  if (isFree(S) || settingsOf(S).automatizace.concentration !== "auto") {
    if (result.concDc) log(S, "system", `${t.nazev}: Concentration DC ${result.concDc}`, "PJ", `dc:${result.concDc}`);
    if (!isFree(S) && settingsOf(S).automatizace.concentration === "zeptat")
      enqueueDecision(S, { kind: "concentration", tokenId: t.id, dc: result.concDc || 10, spell: String(t.conc), label: `${t.nazev} · Concentration DC ${result.concDc || 10}` });
    return result;
  }
  if (!t.dead && !isIncap(t) && result.concDc) {
    const save = resolveSave(t, "CON", result.concDc, { rng });
    log(S, "save", `${t.nazev}: Concentration CON ${save.total} vs DC ${result.concDc} → ${save.success ? "úspěch" : "neúspěch"}`, t.nazev, `d20:${save.rolls.join("/")}`);
    if (save.success) return result;
  }
  const spell = t.conc;
  const dropped = dropConcentration(S.tok, S.zones, t.id, spell);
  S.zones = dropped.zones;
  t.conc = false;
  log(S, "effect", `${t.nazev}: konec Concentration (${spell})`, t.nazev);
  for (const message of dropped.messages) log(S, "effect", message, "PJ");
  return result;
}

/* combat.ts */
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
import { fx, type CmdCtx } from "./shared";
import { dropConc } from "./effects";
import { settingsOf } from "../../rules/settings";
import { isFree } from "../../rules/free";
import { grappleResolve, escapeResolve, hideResolve, searchResolve, standUpCost, longJumpFt, highJumpFt, fallingDamage } from "../../rules/actions/actions";
import { hasGWM, hasSavage, savagePick, metaCost, spendSP, METAMAGIC, elementalAdeptFor } from "../../rules/actions/features";
import { EFFECT_PRESETS } from "../../rules/effects";
import { addEffect } from "./effects";

/* ---------- útoky ---------- */
export interface AtkArgs {
  atkId: string; tgtId: string; atk: AttackDef;
  overrideAdv?: number | null; manualD20?: number; manualDmg?: number;
  ax?: number; ay?: number; slot?: number; pact?: boolean;
  override?: boolean; // ⚙ DM: přeskočit hlídané kontroly
  meta?: string[];   // Metamagic ids (Sorcerer)
}
/** Kontrola podle nastavení: vypnuto → ok, varovat → ok+log, hlidat → jen s override. */
function check(S: StavBoje, setting: "hlidat" | "varovat" | "vypnuto", override: boolean | undefined, msg: string): boolean {
  if (isFree(S)) return true;
  if (setting === "vypnuto") return true;
  if (setting === "varovat") { log(S, "system", `⚠ ${msg}`, "PJ"); return true; }
  if (override) { log(S, "system", msg, "PJ"); return true; }
  return false;
}
export function cmdAttack(S: StavBoje, a: AtkArgs, ctx: CmdCtx): { ok: boolean; reason?: string } {
  const A = byId(S, a.atkId), B = byId(S, a.tgtId);
  if (!A || !B || !ctx.map) return { ok: false, reason: "chybí útočník/cíl" };
  const st = settingsOf(S).automatizace;
  // Metamagic (Sorcerer): SP náklad + efekty
  let atk: AttackDef = a.atk;
  if (a.meta?.length) {
    const cost = metaCost(a.meta, atk.lvl || 0);
    if (!spendSP(A, cost)) return { ok: false, reason: `Sorcery Points: potřeba ${cost}, nemáš` };
    if (a.meta.includes("distant")) {
      if (atk.range) atk = { ...atk, range: atk.range * 2 };
      else if (atk.melee || atk.reach) atk = { ...atk, melee: false, range: 30 }; // touch → 30 ft
    }
    if (a.meta.includes("quickened")) atk = { ...atk, ba: true };
    log(S, "system", `${A.nazev}: Metamagic ${a.meta.map((m) => METAMAGIC.find((x) => x.id === m)?.nazev || m).join(", ")} (−${cost} SP)`, A.nazev);
  }
  a = { ...a, atk };
  if (a.atk.rc && A.spent?.[a.atk.nazev]) {
    if (!check(S, st.dosah, a.override, `${a.atk.nazev} použito i když se dobíjí (⚙ DM)`))
      return { ok: false, reason: `${a.atk.nazev} se dobíjí` };

  }
  // preset-klasifikovaný buff/debuff bez damage rollu → čistý cast na cíl
  if (a.atk.kouzlo && !a.atk.dmg && !a.atk.save) {
    const p = EFFECT_PRESETS.find((x) => x.nazev.toLowerCase() === (a.atk.kouzlo || "").toLowerCase());
    if (p) {
      const slotErr = slotError(A, a.atk, a.slot, a.pact);
      if (slotErr && !isFree(S) && !check(S, st.sloty, a.override, `${A.nazev}: ${a.atk.nazev} bez volného slotu (⚙ DM)`))
        return { ok: false, reason: slotErr };
      if (!isFree(S)) consumeSlot(A, a.atk, a.slot, a.pact);
      if (!a.atk.ba && !a.atk.rea) useEco(S, A, "a"); else if (a.atk.ba) useEco(S, A, "b"); else useEco(S, A, "r");
      const tgtId = p.zone?.shape.kind === "emanation" || p.target === "self" ? A.id : B.id;
      addEffect(S, tgtId, p.id, A.id);
      const e2 = S.eco[A.id];
      if (!isFree(S) && (a.atk.lvl || 0) > 0 && e2) e2.spell += 1;
      log(S, "effect", `${A.nazev} seslal ${a.atk.kouzlo} → ${byId(S, tgtId)?.nazev}${p.conc ? " (Concentration)" : ""}`, A.nazev);
      return { ok: true };
    }
  }
  // léčící kouzlo: heal místo útoku
  if (a.atk.heal && B) {
    const slotErr = slotError(A, a.atk, a.slot, a.pact);
    if (slotErr && !isFree(S) && !check(S, st.sloty, a.override, `${A.nazev}: ${a.atk.nazev} bez volného slotu (⚙ DM)`))
      return { ok: false, reason: slotErr };
    const up = a.slot && a.atk.upcast ? Math.max(0, a.slot - (a.atk.lvl || 1)) : 0;
    const um = a.atk.upcast?.dice?.match(/(\d+)d(\d+)/);
    const dice = up && um ? `${a.atk.heal.dice.replace(/\d+d/, `${Number(a.atk.heal.dice.split("d")[0]) + up * Number(um[1])}d`)}` : a.atk.heal.dice;
    const smod = Math.max(0, ((A.casting?.atk ?? 8) - (A.pb ?? 2)));
    const rr = rollDice(`${dice}${a.atk.heal.plusMod ? `+${smod}` : `+${a.atk.heal.flat}`}`, { rng: defaultRng });
    const hr2 = applyHealing(B, rr.total);
    const healed = hr2.healed ?? rr.total;
    if (!isFree(S)) { consumeSlot(A, a.atk, a.slot, a.pact); if (a.atk.conc) { dropConc(S, A.id); A.conc = a.atk.kouzlo || a.atk.nazev; } }
    if (!a.atk.ba && !a.atk.rea) useEco(S, A, "a"); else if (a.atk.ba) useEco(S, A, "b"); else useEco(S, A, "r");
    fx(S, "heal", { to: [B.x ?? 0, B.y ?? 0], text: `+${healed}`, tokenId: B.id });
    log(S, "heal", `${A.nazev}: ${a.atk.nazev} → ${B.nazev} +${healed} HP (${rr.parts.join("+") || dice})`, A.nazev);
    return { ok: true };
  }
  // utility kouzlo: jen cast — slot, ekonomika, conc, log
  if (a.atk.utility) {
    const slotErr = slotError(A, a.atk, a.slot, a.pact);
    if (slotErr && !isFree(S) && !check(S, st.sloty, a.override, `${A.nazev}: ${a.atk.nazev} bez volného slotu (⚙ DM)`))
      return { ok: false, reason: slotErr };
    if (!isFree(S)) { consumeSlot(A, a.atk, a.slot, a.pact); if (a.atk.conc) { dropConc(S, A.id); A.conc = a.atk.kouzlo || a.atk.nazev; } }
    if (!a.atk.ba && !a.atk.rea) useEco(S, A, "a"); else if (a.atk.ba) useEco(S, A, "b"); else useEco(S, A, "r");
    log(S, "system", `${A.nazev} seslal ${a.atk.kouzlo || a.atk.nazev}${a.slot ? ` (${a.slot}. slot)` : ""}${a.atk.ritual && !a.slot ? " (rituál)" : ""}`, A.nazev, a.atk.text?.slice(0, 400));
    return { ok: true };
  }
  const slotErr = slotError(A, a.atk, a.slot, a.pact);
  if (slotErr) {
    if (!check(S, st.sloty, a.override, `${A.nazev}: ${a.atk.nazev} bez volného slotu (⚙ DM)`))
      return { ok: false, reason: slotErr };
  }
  // 2024: jen jedno kouzlo se slotem za tah (cantripy volné)
  const ecoA = S.eco[A.id];
  if (!isFree(S) && a.atk.kind === "spell" && (a.atk.lvl || 0) > 0 && !a.atk.ritualCast && ecoA && ecoA.spell > 0) {
    if (!check(S, st.ekonomika, a.override, `${A.nazev}: druhé kouzlo se slotem tento tah (⚙ DM)`))
      return { ok: false, reason: "za tah už bylo sesláno kouzlo se slotem" };
  }
  const actx: AttackCtx = { attacker: A, target: B, atk: a.atk, map: ctx.map, tokens: S.tok, ax: a.ax, ay: a.ay, overrideAdv: a.overrideAdv, state: S, teren: S.teren };
  const ev = evaluateAttack(actx);
  const force = isFree(S) || a.override && st.dosah === "hlidat" || st.dosah === "varovat";
  const r = resolveAttack(actx, { manualD20: a.manualD20, force: force && !ev.canTarget });
  if (!r) return { ok: false, reason: ev.beyondRange ? "mimo dostřel" : ev.cover === 9 ? "plný kryt" : "nelze zacílit" };
  if (!ev.canTarget) log(S, "system", `⚙ DM: útok ${a.atk.nazev} přes ${ev.beyondRange ? "dostřel" : "plný kryt"}`, A.nazev);
  const n = a.atk.n || 1;
  const parts = a.manualDmg != null
    ? [{ amount: a.manualDmg, type: a.atk.typ || "Bludgeoning" }]
    : r.dmgByType.map((p) => ({ amount: p.amount * n, type: p.type }));
  // Sneak Attack: 1× za tah, adv NEBO spojenec u cíle (<=5 ft), bez dis — jen zásah
  const am = sumMods(A);
  if (r.hit && am.sneakDmg) {
    const key = `sneak:${S.round}:${S.turn}`;
    const allyNear = S.tok.some((h) => h !== A && h !== B && h.x != null && !h.dead && !isIncap(h)
      && hostile(h, B) && gapFt(h, B) <= 5);
    const eligible = ev.net >= 0 && (ev.net > 0 || allyNear);
    if (!A.spent?.[key] && eligible) {
      const sr = rollDice(am.sneakDmg.dice);
      parts.push({ amount: sr.total, type: a.atk.typ || "Piercing" });
      A.spent = A.spent || {}; A.spent[key] = true;
      log(S, "attack", `Sneak Attack +${sr.total} (${am.sneakDmg.dice})`, A.nazev);
    }
  }
  // Uncanny Dodge (reaction): viditelny zasah za pulku — ne crit
  const bmT = sumMods(B);
  if (r.hit && !r.crit && bmT.uncanny && B.react !== false && !isIncap(B)) {
    for (const pt of parts) pt.amount = Math.floor(pt.amount / 2);
    useEco(S, B, "r");
    log(S, "effect", `${B.nazev}: Uncanny Dodge — damage za pulku`, B.nazev);
  }
  // Empowered metamagic: přehoď až CHA mod damage kostek (aproximace plný přehod, vezmi lepší)
  if (r.hit && a.manualDmg == null && a.meta?.includes("empowered") && a.atk.dmg) {
    const again = rollDice(a.atk.dmg, { crit: r.crit }).total;
    const rolled = parts.reduce((x, p) => x + p.amount, 0);
    if (again > rolled) { parts[0].amount += again - rolled; log(S, "damage", `${A.nazev}: Empowered — přehozeno ${rolled} → ${again}`, A.nazev); }
  }
  // Savage Attacker: jednou za tah weapon damage přehodit, vzít vyšší
  const ecoS = S.eco[A.id];
  if (r.hit && a.manualDmg == null && ecoS && hasSavage(A) && !a.atk.kouzlo && a.atk.dmg && !(ecoS as any).savage) {
    (ecoS as any).savage = 1;
    const again = rollDice(a.atk.dmg).total;
    const rolled = parts.reduce((x, p) => x + p.amount, 0);
    if (again > rolled) { parts[0].amount += again - rolled; log(S, "damage", `${A.nazev}: Savage Attacker — přehozeno ${rolled} → ${again}`, A.nazev); }
  }
  let dmgRes: ReturnType<typeof applyDamage> | null = null;
  if (r.hit) dmgRes = applyDamage(B, parts, { crit: r.crit, ignoreResist: parts.filter((p) => elementalAdeptFor(A, p.type)).map((p) => p.type) });
  const txt = `${A.nazev} → ${B.nazev}: ${a.atk.nazev}${n > 1 ? ` ×${n}` : ""} ` +
    `d20(${r.d20s.join("/")})${r.bonus >= 0 ? "+" : ""}${r.bonus} = ${r.total} vs ${ev.acBreak}` +
    (r.hit ? ` → ${r.crit ? "CRIT " : ""}${dmgRes ? dmgRes.applied : 0} ${a.atk.typ || ""}` : " — mina");
  log(S, "attack", txt, A.nazev,
    JSON.stringify({ d20: r.d20s, hit: r.hit, dmg: r.dmgRolls, adv: ev.advSources, dis: ev.disSources, cover: ev.coverText, chance: Math.round(ev.hitChance * 100) }));
  const from: [number, number] = [A.x ?? 0, A.y ?? 0], to: [number, number] = [B.x ?? 0, B.y ?? 0];
  if (r.hit) {
    fx(S, a.atk.kouzlo ? "bolt" : a.atk.melee ? "slash" : "projectile", { from, to, dmgType: a.atk.typ, tokenId: B.id });
    fx(S, "dmg", { to, text: String(dmgRes?.applied ?? 0), dmgType: a.atk.typ, tokenId: B.id });
    if (r.crit) fx(S, "crit", { to, text: "CRIT!", tokenId: B.id });
    for (const p of dmgRes?.parts || [])
      if (p.mod) fx(S, "dmg", { to, text: p.mod.split(" ")[0], dmgType: p.mod.startsWith("Immune") ? "Immune" : "Resist", tokenId: B.id });
  } else {
    fx(S, a.atk.melee ? "slash" : "projectile", { from, to, dmgType: a.atk.typ });
    fx(S, "miss", { to, text: "Mine", tokenId: B.id });
  }
  if (dmgRes) {
    for (const m of dmgRes.messages) log(S, "system", m, A.nazev);
    if (dmgRes.concDc && B.conc) log(S, "system", `${B.nazev}: Concentration DC ${dmgRes.concDc}`, "PJ", `dc:${dmgRes.concDc}`);
  }
  if (r.hit && a.atk.condOnHit) for (const c of a.atk.condOnHit) {
    if (!hasCond(B, c.n)) { B.cond.push({ n: c.n, src: A.id }); log(S, "cond", `${B.nazev}: ${c.n}${c.dc ? ` (DC ${c.dc})` : ""}`, A.nazev); }
  }
  // GWM: +PB damage jednou za tah (Heavy melee — zjednodušeně melee weapon)
  const e2 = S.eco[A.id];
  if (r.hit && e2 && hasGWM(A) && a.atk.melee && !a.atk.kouzlo && !(e2 as any).gwm) {
    (e2 as any).gwm = 1;
    const bonus = A.pb ?? 2;
    applyDamage(B, [{ amount: bonus, type: a.atk.typ || "Bludgeoning" }]);
    log(S, "damage", `${A.nazev}: Great Weapon Master +${bonus} dmg`, A.nazev);
  }
  applyMastery(S, A, B, a.atk, r.hit);
  // preset-klasifikované kouzlo: aplikuj preset na cíl (efekt + conc + zóna)
  if (a.atk.kouzlo && !a.atk.utility) {
    const p = EFFECT_PRESETS.find((x) => x.nazev.toLowerCase() === (a.atk.kouzlo || "").toLowerCase());
    if (p) {
      const tgtId = p.zone?.shape.kind === "emanation" || p.target === "self" ? A.id : B.id;
      const eN = S.tok.flatMap((x) => x.effects).length, zN = S.zones.length;
      addEffect(S, tgtId, p.id, A.id);
      if (a.meta?.includes("extended")) {
        for (const x of S.tok) for (const e of x.effects.slice(-Math.max(0, S.tok.flatMap((y) => y.effects).length - eN))) if ((e as any).duration?.rounds) (e as any).duration.rounds *= 2;
        for (const z of S.zones.slice(zN)) { (z as any).durN = ((z as any).durN || 0) * 2; }
      }
      log(S, "effect", `${A.nazev}: ${a.atk.kouzlo} → preset ${p.nazev}${p.conc ? " (Concentration)" : ""}${a.meta?.includes("extended") ? " ×2 trvání" : ""}`, A.nazev);
    }
  }
  // počítadlo leveled spell za tah (2024)
  if (!isFree(S) && a.atk.kind === "spell" && (a.atk.lvl || 0) > 0 && e2) e2.spell += 1;
  if (r.hit && am.dmgOnHitOnce) consumeMod(A, "dmgOnHitOnce");
  if (bmT.nextAtkAdvBy) consumeMod(B, "nextAtkAdvBy");
  if (am.nextAtkDis) consumeMod(A, "nextAtkDis");
  if (!isFree(S)) {
    if (a.atk.rc) { A.spent = A.spent || {}; A.spent[a.atk.nazev] = true; }
    consumeSlot(A, a.atk, a.slot, a.pact);
    if (a.atk.conc) { dropConc(S, A.id); A.conc = a.atk.kouzlo || a.atk.nazev; }
  }
  if (!a.atk.ba && !a.atk.rea) {
    // Attack action: Extra Attack — první útok stojí akci, další jdou z počítadla atkLeft
    const eco = ecoOf(S, A);
    if (!isFree(S) && !a.atk.kouzlo && (eco.atkLeft ?? 0) > 0) eco.atkLeft!--;
    else {
      useEco(S, A, "a");
      // utoky_za_akci = celkový počet útoků za Attack akci → zbývá N−1
      if (!isFree(S) && !a.atk.kouzlo && (A.extraAtk || 0) > 1) eco.atkLeft = A.extraAtk! - 1;
    }
  }
  else if (a.atk.ba) useEco(S, A, "b"); else useEco(S, A, "r");
  return { ok: true };
}

/** Odebere prvni efekt nesouci dany mod (jednorazove modifikatory). */
function consumeMod(t: Token, k: string) {
  const e = t.effects.find((x) => (x.mods as Record<string, unknown>)[k]);
  if (e) t.effects = t.effects.filter((x) => x !== e);
}

/** Volne sloty pro uroven `lvl` (bezne i pact). */
export const slotsLeft = (t: Token, lvl: number): number =>
  (t.slots?.[lvl - 1] ? t.slots[lvl - 1].max - t.slots[lvl - 1].used : 0) +
  (t.pact && t.pact.lvl >= lvl ? t.pact.max - t.pact.used : 0);

/** Kontrola slotu pred seslanim; vrati duvod zamitnuti nebo null. */
function slotError(t: Token, atk: AttackDef, slot?: number, pact?: boolean): string | null {
  if (!atk.lvl) return null;
  const use = slot ?? atk.lvl;
  if (pact && t.pact && t.pact.lvl >= use && t.pact.used < t.pact.max) return null;
  const sl = t.slots?.[use - 1];
  if (sl && sl.used < sl.max) return null;
  if (t.pact && t.pact.lvl >= use && t.pact.used < t.pact.max) return null;
  return `zadny volny slot urovne ${use}`;
}

function consumeSlot(t: Token, atk: AttackDef, slot?: number, pact?: boolean) {
  if (!atk.lvl) return;
  const use = slot ?? atk.slot ?? atk.lvl;
  if (pact && t.pact && t.pact.lvl >= use && t.pact.used < t.pact.max) { t.pact.used += 1; return; }
  if (t.slots?.[use - 1] && t.slots[use - 1].used < t.slots[use - 1].max) { t.slots[use - 1].used += 1; return; }
  if (t.pact && t.pact.lvl >= use && t.pact.used < t.pact.max) t.pact.used += 1;
}

function applyMastery(S: StavBoje, A: Token, B: Token, atk: AttackDef, hit: boolean) {
  switch (atk.mastery) {
    case "graze":
      if (!hit) {
        const m = Math.max(0, A.mods?.STR ?? 0);
        if (m) { const r = applyDamage(B, [{ amount: m, type: atk.typ || "Slashing" }]); log(S, "attack", `Graze: ${r.applied} ${atk.typ} (${B.nazev})`, A.nazev); }
      }
      break;
    case "push": if (hit) log(S, "cond", `${B.nazev}: odtlačen o 10 ft (Push)`, A.nazev); break;
    case "sap": if (hit && !B.effects.some((e) => e.nazev === "Sap")) { B.effects.push({ id: uid(), nazev: "Sap", mods: { sap: true }, duration: { kind: "startOf", who: B.id } }); log(S, "effect", `${B.nazev}: Sap — dis na příští útok`, A.nazev); } break;
    case "slow": if (hit && !B.effects.some((e) => e.nazev === "Slow")) { B.effects.push({ id: uid(), nazev: "Slow", mods: { slowFt: 10 }, duration: { kind: "startOf", who: B.id } }); log(S, "effect", `${B.nazev}: Slow −10 ft`, A.nazev); } break;
    case "vex": if (hit && !A.effects.some((e) => e.nazev === "Vex")) { A.effects.push({ id: uid(), nazev: "Vex", mods: { vex: true }, duration: { kind: "endOf", who: A.id } }); log(S, "effect", `${A.nazev}: Vex — adv na příští útok`, A.nazev); } break;
    case "topple": if (hit) log(S, "cond", `${B.nazev}: CON save vs Topple (DC 8+mod+PB)`, A.nazev); break;
    default: break;
  }
}

/* ---------- oblasti / záchrany ---------- */
export interface AreaArgs { srcId: string; spec: AreaSpec; atk: AttackDef; manualDmg?: number; slot?: number; pact?: boolean; override?: boolean; meta?: string[] }
export function cmdArea(S: StavBoje, a: AreaArgs, ctx: CmdCtx): { ok: boolean; targets: number; reason?: string } {
  const A = byId(S, a.srcId);
  if (!A) return { ok: false, targets: 0 };
  if (a.meta?.length) {
    const cost = metaCost(a.meta, a.atk.lvl || 0);
    if (!spendSP(A, cost)) return { ok: false, targets: 0, reason: `Sorcery Points: potřeba ${cost}` };
    if (a.meta!.includes("quickened")) a = { ...a, atk: { ...a.atk, ba: true } };
    log(S, "system", `${A.nazev}: Metamagic ${a.meta!.join(",")} (−${cost} SP)`, A.nazev);
  }
  const slotErr = slotError(A, a.atk, a.slot, a.pact);
  if (slotErr) {
    if (!check(S, settingsOf(S).automatizace.sloty, a.override, `${A.nazev}: ${a.atk.nazev} bez volného slotu (⚙ DM)`))
      return { ok: false, targets: 0, reason: slotErr };
  }
  const targets = tokensInArea(a.spec, S.tok, A);
  let dmgBase = a.manualDmg;
  if (dmgBase == null && a.atk.dmg) {
    let dice = a.atk.dmg;
    const upm = a.atk.pozn?.match(/\+(\d+d\d+)\/slot >(\d+)/);
    const up = a.atk.upcast || (upm ? { dice: upm[1], per: Number(upm[2]) } : undefined);
    if (a.slot && a.atk.lvl != null && up && a.slot > a.atk.lvl) {
      const m = up.dice.match(/^(\d*)d(\d+)/);
      if (m) dice += `+${(a.slot - a.atk.lvl) * (parseInt(m[1] || "1", 10))}d${m[2]}`;
    }
    dmgBase = rollDice(dice, { treat1as2: a.atk.typ ? elementalAdeptFor(A, a.atk.typ) : false }).total;
  }
  fx(S, "aoe", { area: { shape: a.spec.shape, size: a.spec.size, anchor: a.spec.anchor, dir: a.spec.dir }, dmgType: a.atk.typ, text: a.atk.nazev });
  for (const T of targets) {
    let dmg = dmgBase ?? 0;
    let applies = true;
    if (a.atk.save && a.atk.dc) {
      const cov = ctx.map ? coverOf(A, T, ctx.map, S.tok, undefined, undefined, S.teren, (S as any).dvere) : 0;
      if ((a.meta || []).includes("careful") && T.side === A.side) { applies = false; log(S, "system", `${T.nazev}: Careful — automaticky uspěl`, A.nazev); }
      const firstT = targets.indexOf(T) === 0;
      const sr = resolveSave(T, a.atk.save, a.atk.dc, { cover: cov, forceDis: !!((a.meta || []).includes("heightened") && firstT) });
      if (!applies) { dmg = 0; }
      applies = applies && !sr.success;
      const tMods = sumMods(T);
      if (a.atk.save === "DEX" && a.atk.half && tMods.evasion) {
        dmg = sr.success ? 0 : Math.floor(dmg / 2);
        if (sr.success) log(S, "effect", `${T.nazev}: Evasion — 0 dmg`, T.nazev);
      } else if (sr.success && a.atk.half) dmg = Math.floor(dmg / 2);
      else if (sr.success) dmg = 0;
      log(S, "save", `${T.nazev}: ${a.atk.save} save ${sr.rolled}${sr.bonus >= 0 ? "+" : ""}${sr.bonus} vs DC ${a.atk.dc} → ${sr.success ? "úspěch" : "neúspěch"}${sr.legendaryUsed ? " (Legendary Resistance)" : ""}`, T.nazev, `d20:${sr.rolls.join("/")}`);
    }
    if (dmg > 0 || (!a.atk.save && dmg > 0)) {
      const r = applyDamage(T, [{ amount: dmg, type: a.atk.typ || "Force" }]);
      fx(S, "dmg", { to: [T.x ?? 0, T.y ?? 0], text: String(r.applied), dmgType: a.atk.typ, tokenId: T.id });
      for (const m of r.messages) log(S, "system", m, T.nazev);
      if (r.concDc && T.conc) log(S, "system", `${T.nazev}: Concentration DC ${r.concDc}`, "PJ");
    }
    if (applies && a.atk.condOnHit) for (const c of a.atk.condOnHit)
      if (!hasCond(T, c.n)) { T.cond.push({ n: c.n, src: A.id }); log(S, "cond", `${T.nazev}: ${c.n}`, A.nazev); }
  }
  log(S, "attack", `${A.nazev}: ${a.atk.nazev} (${targets.map((t) => t.nazev).join(", ") || "nikdo v oblasti"})`, A.nazev);
  consumeSlot(A, a.atk, a.slot, a.pact);
  if (a.atk.conc) { dropConc(S, A.id); A.conc = a.atk.kouzlo || a.atk.nazev; }
  if (!a.atk.ba) useEco(S, A, "a"); else useEco(S, A, "b");
  return { ok: true, targets: targets.length };
}

/* ---------- damage/heal/temp/death ---------- */
export function cmdDamage(S: StavBoje, id: string, amount: number, type: string) {
  const t = byId(S, id); if (!t) return;
  const r = applyDamage(t, [{ amount, type }]);
  fx(S, "dmg", { to: [t.x ?? 0, t.y ?? 0], text: String(r.applied), dmgType: type, tokenId: t.id });
  log(S, "damage", `${t.nazev}: −${r.applied} HP (${type}${r.parts.some((p) => p.mod) ? "; " + r.parts.map((p) => p.mod).filter(Boolean).join(", ") : ""})`, "PJ");
  for (const m of r.messages) log(S, "system", m, "PJ");
  if (r.concDc && t.conc) log(S, "system", `${t.nazev}: Concentration DC ${r.concDc}`, "PJ");
}
export function cmdHeal(S: StavBoje, id: string, amount: number) {
  const t = byId(S, id); if (!t) return;
  const r = applyHealing(t, amount);
  fx(S, "heal", { to: [t.x ?? 0, t.y ?? 0], text: `+${r.healed}`, dmgType: "heal", tokenId: t.id });
  log(S, "heal", `${t.nazev}: +${r.healed} HP`, "PJ");
  for (const m of r.messages) log(S, "system", m, "PJ");
}
export function cmdTemp(S: StavBoje, id: string, v: number) {
  const t = byId(S, id); if (!t) return;
  setTempHp(t, v);
  log(S, "heal", `${t.nazev}: temp HP ${t.tmp}`, "PJ");
}
export function cmdDeathSave(S: StavBoje, id: string, roll?: number) {
  const t = byId(S, id); if (!t) return;
  const r = deathSave(t, roll ?? d20(0, defaultRng).r);
  log(S, "save", r.text, t.nazev);
}

/* ---------- standardní akce ---------- */
export function cmdStdAction(S: StavBoje, id: string, action: string, tgtId?: string, override?: boolean) {
  const t = byId(S, id); if (!t) return;
  if (!useEco(S, t, "a")) {
    if (!check(S, settingsOf(S).automatizace.ekonomika, override, `${t.nazev}: akce navíc (⚙ DM)`)) {
      log(S, "system", `${t.nazev}: akce už použita`, t.nazev); return;
    }
  }
  const e = ecoOf(S, t);
  switch (action) {
    case "dash": e.dash += 1; log(S, "system", `${t.nazev}: Dash (+${t.speed} ft pohybu)`, t.nazev); break;
    case "disengage": e.disengage = 1; t.effects.push({ id: uid(), nazev: "Disengage", mods: { noOA: true }, duration: { kind: "startOf", who: t.id } }); log(S, "system", `${t.nazev}: Disengage`, t.nazev); break;
    case "dodge": t.effects.push({ id: uid(), nazev: "Dodge", mods: { dodge: true, atkDisBy: true, saveAdvAb: ["DEX"] }, duration: { kind: "startOf", who: t.id } }); log(S, "system", `${t.nazev}: Dodge`, t.nazev); break;
    case "hide": {
      const hr = hideResolve(t, defaultRng);
      if (hr.ok || isFree(S)) {
        t.effects.push({ id: uid(), nazev: "Hidden", mods: { stealthTotal: hr.total } as any, duration: { kind: "startOf", who: t.id } });
        if (!hasCond(t, "Invisible")) t.cond.push({ n: "Invisible" });
        log(S, "system", `${t.nazev}: Hide ${hr.roll}+${hr.total - hr.roll}=${hr.total} ≥ 15 → Invisible`, t.nazev);
      } else log(S, "system", `${t.nazev}: Hide ${hr.roll}+${hr.total - hr.roll}=${hr.total} < 15 — neúspěch`, t.nazev);
      break;
    }
    case "escape": {
      // Escape z Grappled: Athletics/Acrobatics vs grapple DC zdroje
      const g = t.cond.find((c) => c.n === "Grappled" && c.src);
      const src = g?.src ? byId(S, g.src) : undefined;
      const er = src ? escapeResolve(t, src, defaultRng) : null;
      if (er && er.ok) { t.cond = t.cond.filter((c) => c !== g); log(S, "system", `${t.nazev}: Escape ${er.roll}+${er.total - er.roll}=${er.total} ≥ ${er.dc} — volný`, t.nazev); }
      else if (er) log(S, "system", `${t.nazev}: Escape ${er.roll}+${er.total - er.roll}=${er.total} < ${er.dc} — stále Grappled`, t.nazev);
      else log(S, "system", `${t.nazev}: Escape — není Grappled`, t.nazev);
      break;
    }
    case "standup": {
      const cost = standUpCost(t);
      e.moved += cost;
      t.cond = t.cond.filter((c) => c.n !== "Prone");
      log(S, "system", `${t.nazev}: Stand Up (−${cost} ft pohybu)`, t.nazev);
      break;
    }
    case "dropprone": {
      if (!hasCond(t, "Prone")) t.cond.push({ n: "Prone" });
      e.a += 1; // Drop Prone je zdarma — vrátíme akci
      log(S, "system", `${t.nazev}: Drop Prone`, t.nazev);
      if ((t.elev || 0) > 0) { const dmg = fallingDamage(t.elev || 0, defaultRng); t.elev = 0; t.hp = Math.max(0, t.hp - dmg); log(S, "damage", `${t.nazev}: pád z výšky — ${dmg} dmg, Prone`, t.nazev); }
      break;
    }
    case "crawl": {
      (t as any).crawl = !(t as any).crawl;
      e.a += 1; // přepínač — zdarma
      log(S, "system", `${t.nazev}: Crawl ${(t as any).crawl ? "zapnuto (pohyb ×2)" : "vypnuto"}`, t.nazev);
      break;
    }
    case "jumplong": {
      e.moved += 5; e.a += 1;
      log(S, "system", `${t.nazev}: Long Jump — ${longJumpFt(t, true)} ft (s rozběhem 10 ft)`, t.nazev);
      break;
    }
    case "jumphigh": {
      e.moved += 5; e.a += 1;
      log(S, "system", `${t.nazev}: High Jump — ${highJumpFt(t, true)} ft`, t.nazev);
      break;
    }
    case "flyup": case "flydown": {
      const d = action === "flyup" ? 5 : -5;
      t.elev = Math.max(0, (t.elev || 0) + d);
      e.moved += 5; e.a += 1; // elevation je pohyb, ne akce — vrátíme
      if (action === "flydown" && t.elev === 0) log(S, "system", `${t.nazev}: přistál`, t.nazev);
      else log(S, "system", `${t.nazev}: elevace ${d > 0 ? "+" : ""}${d} ft → ${t.elev} ft (−5 ft pohybu)`, t.nazev);
      break;
    }
    case "help": {
      const tgt = tgtId ? byId(S, tgtId) : undefined;
      if (tgt) { tgt.effects.push({ id: uid(), nazev: "Help", mods: { advOnHitBy: true }, duration: { kind: "startOf", who: t.id }, src: t.id }); log(S, "system", `${t.nazev}: Help → ${tgt.nazev}`, t.nazev); }
      else log(S, "system", `${t.nazev}: Help`, t.nazev);
      break;
    }
    case "grapple": case "shove": {
      const tgt = tgtId ? byId(S, tgtId) : undefined;
      if (tgt) {
        const r = grappleResolve(t, tgt, defaultRng);
        if (!r) { log(S, "system", `${tgt.nazev} je příliš velký na Grapple/Shove`, t.nazev); break; }
        if (r.ok) {
          if (action === "grapple") { tgt.cond.push({ n: "Grappled", src: t.id }); log(S, "cond", `${tgt.nazev}: Grappled (save ${r.roll}+${r.total - r.roll}=${r.total} < ${r.dc})`, t.nazev); }
          else { tgt.cond.push({ n: "Prone" }); log(S, "cond", `${tgt.nazev}: Prone — Shove (save ${r.roll}+${r.total - r.roll}=${r.total} < ${r.dc})`, t.nazev); }
        } else log(S, "system", `${tgt.nazev}: save ${r.roll}+${r.total - r.roll}=${r.total} ≥ ${r.dc} — ${action} neuspěl`, tgt.nazev);
      }
      break;
    }
    case "search": {
      const tgt = tgtId ? byId(S, tgtId) : undefined;
      const stealth = tgt?.effects.find((x) => (x.mods as any).stealthTotal != null);
      if (tgt && stealth) {
        const sr = searchResolve(t, (stealth.mods as any).stealthTotal, defaultRng);
        if (sr.ok) {
          tgt.cond = tgt.cond.filter((c) => c.n !== "Invisible");
          tgt.effects = tgt.effects.filter((x) => x !== stealth);
          log(S, "system", `${t.nazev}: Search ${sr.roll}+${sr.total - sr.roll}=${sr.total} ≥ ${sr.dc} — ${tgt.nazev} nalezen`, t.nazev);
        } else log(S, "system", `${t.nazev}: Search ${sr.roll}+${sr.total - sr.roll}=${sr.total} < ${sr.dc} — nic`, t.nazev);
      } else {
        const sr = searchResolve(t, 15, defaultRng);
        log(S, "system", `${t.nazev}: Search ${sr.roll}+${sr.total - sr.roll}=${sr.total} (vs 15)`, t.nazev);
      }
      break;
    }
    case "ready": {
      t.ready = { text: "Připravená akce", until: "turn" } as any;
      log(S, "system", `${t.nazev}: Ready — spustitelné reakcí`, t.nazev);
      break;
    }
    default: log(S, "system", `${t.nazev}: ${action}`, t.nazev);
  }
}

export function evalUi(S: StavBoje, map: BattleMapData, A: Token, B: Token, atk: AttackDef) {
  return evaluateAttack({ attacker: A, target: B, atk, map, tokens: S.tok, state: S, teren: S.teren });
}
export const canSee = (S: StavBoje, map: BattleMapData, A: Token, B: Token) =>
  canSeeTarget(S, map, A, B).see;
export const areaPreview = (spec: AreaSpec) => areaCells(spec);

/** Hod na atribut/skill/save/init (d20 + mod, adv/dis). */
export function cmdCheck(S: StavBoje, id: string, name: string, mod: number, mode: "adv" | "dis" | "norm" = "norm", contest?: { id: string; mod: number }) {
  const t = byId(S, id); if (!t) return;
  const r1 = d20(0, defaultRng), r2 = mode !== "norm" ? d20(0, defaultRng) : null;
  const use = mode === "adv" ? Math.max(r1.r, r2!.r) : mode === "dis" ? Math.min(r1.r, r2!.r) : r1.r;
  const total = use + mod;
  const dice = t.effects.find((e) => (e.mods as any).bless || (e.mods as any).guidance || (e.mods as any).bardic);
  let extra = "";
  if (dice) { const ex = rollDice("1d4", { rng: defaultRng }).total; extra = ` +${ex} (Bless/Guidance/Bardic)`; }
  if (contest) {
    const c = byId(S, contest.id); const cr = c ? d20(0, defaultRng).r + contest.mod : 0;
    log(S, "system", `${t.nazev}: ${name} ${use}${mod ? `+${mod}` : ""}=${total}${extra} vs ${c?.nazev} ${cr} → ${total >= cr ? "vítězí" : "prohrává"}`, t.nazev);
  } else
    log(S, "system", `${t.nazev}: hod ${name} ${mode === "norm" ? "" : `(${mode}) `}${r2 ? `[${r1.r},${r2.r}] ` : ""}${use}${mod ? `+${mod}` : ""}=${total}${extra}`, t.nazev);
}

const POTION_DICE: [RegExp, string][] = [
  [/Supreme/i, "10d4+20"], [/Superior/i, "8d4+8"], [/Greater/i, "4d4+4"], [/Potion of Healing/i, "2d4+2"],
];
/** Použití consumable z t.items (počet per-battle) — potion léčí, scroll/generic jen log+decrement. */
export function cmdUseItem(S: StavBoje, id: string, itemIdx: number, tgtId?: string, asBA?: boolean) {
  const t = byId(S, id); if (!t || !t.items?.[itemIdx]) return;
  const it = t.items[itemIdx];
  if ((it.qty ?? 0) <= 0) { log(S, "system", `${t.nazev}: ${it.nazev} došel`, t.nazev); return; }
  if (!isFree(S) && !useEco(S, t, asBA ? "b" : "a")) {
    if (!check(S, settingsOf(S).automatizace.ekonomika, undefined, `${t.nazev}: ${asBA ? "bonus akce" : "akce"} už použita (⚙ DM)`)) return;
  }
  it.qty = (it.qty ?? 1) - 1;
  const pd = POTION_DICE.find(([re]) => re.test(it.nazev));
  if (pd) {
    const tgt = (tgtId && byId(S, tgtId)) || t;
    const rr = rollDice(pd[1], { rng: defaultRng });
    const healed = applyHealing(tgt, rr.total).healed ?? rr.total;
    fx(S, "heal", { to: [tgt.x ?? 0, tgt.y ?? 0], text: `+${healed}`, tokenId: tgt.id });
    log(S, "heal", `${t.nazev}: ${it.nazev} → ${tgt.nazev} +${healed} HP (${rr.parts.join("+")})${asBA ? " (BA)" : ""}`, t.nazev);
  } else log(S, "system", `${t.nazev} použil ${it.nazev} (zbývá ${it.qty}×)`, t.nazev);
}
/** Stabilize: Medicine DC 10 akce → dying zatím žije. */
export function cmdStabilize(S: StavBoje, id: string, tgtId: string) {
  const t = byId(S, id), tgt = byId(S, tgtId); if (!t || !tgt) return;
  if (!useEco(S, t, "a") && !isFree(S)) return;
  const mod = t.skills?.["Medicine"] ?? t.mods.WIS ?? 0;
  const r = d20(0, defaultRng);
  const ok = r.r + mod >= 10;
  if (ok && tgt.dying) { (tgt as any).stable = true; log(S, "system", `${t.nazev}: Stabilize ${r.r}+${mod}≥10 — ${tgt.nazev} stabilizován`, t.nazev); }
  else log(S, "system", `${t.nazev}: Stabilize ${r.r}+${mod}${ok ? "≥" : "<"}10${ok ? "" : " — neúspěch"}`, t.nazev);
}

/* Čisté reakce 2024: detekce možností + aplikace (bez UI). */
import type { StavBoje, Token, AttackDef } from "../../types";
import { hasCond } from "../conditions";
import { rollDice, d20, type Rng } from "../dice";
import { uid } from "../../types";
import { settingsOf } from "../settings";
import { applyDamage } from "../damage";
import { isFree } from "../free";

export interface ReactionTrigger {
  kind: "hit" | "damaged" | "enemyCasts" | "leavesReach" | "entersReach" | "disengageLeave";
  attacker?: Token; target?: Token; atk?: AttackDef;
  distFt?: number; hitTotal?: number;
}
export interface ReactionOption {
  id: string; whoId: string; who: string; nazev: string;
  desc: string; needsSlot?: number;
}
const knowsSpell = (t: Token, name: string) =>
  (t.kouzla || []).some((k) => (k.kouzlo || k.nazev || "").toLowerCase() === name.toLowerCase());
const hasFeat = (t: Token, re: RegExp) => (t.feats || []).some((f) => re.test(f));
const hasFeature = (t: Token, re: RegExp) =>
  (t.features || []).some((f) => re.test(f.nazev)) || hasFeat(t, re) || ((t as any).trida && re.test((t as any).trida));
const slotsLeft = (t: Token, lvl: number): number =>
  (t.slots?.[lvl - 1] ? t.slots[lvl - 1].max - t.slots[lvl - 1].used : 0) +
  (t.pact && t.pact.lvl >= lvl ? t.pact.max - t.pact.used : 0);
const alive = (t: Token | undefined): t is Token => !!t && !t.dead && !hasCond(t, "Incapacitated") && !hasCond(t, "Stunned");

/** Které reakce jsou pro trigger k dispozici. spent = r v S.eco. */
export function reactionOptions(S: StavBoje, trig: ReactionTrigger): ReactionOption[] {
  if (isFree(S) || settingsOf(S).automatizace.reakce === "vypnuto") return [];
  const out: ReactionOption[] = [];
  const ecoR = (t: Token) => !(S.eco[t.id]?.r);
  const adjFt = trig.distFt ?? (trig.attacker && trig.target
    ? Math.max(Math.abs((trig.attacker.x ?? 0) - (trig.target.x ?? 0)), Math.abs((trig.attacker.y ?? 0) - (trig.target.y ?? 0))) * 5 : 999);
  for (const t of S.tok) {
    if (!alive(t) || !ecoR(t)) continue;
    const isTgt = trig.target && t.id === trig.target.id;
    const isAlly = trig.target && t.side === trig.target.side;
    // Shield (kouzlo): zasažený + dostupný slot 1+
    if (trig.kind === "hit" && isTgt && knowsSpell(t, "Shield") && slotsLeft(t, 1) > 0)
      out.push({ id: `shield:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Shield", desc: "+5 AC do začátku tvého tahu — zásah se může stát miss (slot 1, Reaction).", needsSlot: 1 });
    // Defensive Duelist: melee hit, finesse zbraň (zjednodušeno: má feat)
    if (trig.kind === "hit" && isTgt && hasFeat(t, /defensive duelist/i) && trig.atk?.melee)
      out.push({ id: `duelist:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Defensive Duelist", desc: `+${t.pb ?? 2} AC proti tomuto melee útoku (Reaction).` });
    // Uncanny Dodge: poškozený (rogue feature)
    if (trig.kind === "damaged" && isTgt && hasFeature(t, /uncanny dodge/i))
      out.push({ id: `uncanny:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Uncanny Dodge", desc: "Zranění z útoku napůl (Reaction)." });
    // Interception style: spojenec do 5 ft zasažen
    if (trig.kind === "damaged" && isAlly && !isTgt && hasFeat(t, /interception/i) && adjFt <= 5)
      out.push({ id: `intercept:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Interception", desc: `Sniž zranění o 1d10+${t.pb ?? 2} (Reaction).` });
    // Protection style: spojenec do 5 ft napaden — Dis na útok
    if (trig.kind === "hit" && isAlly && !isTgt && hasFeat(t, /^protection$/i) && adjFt <= 5)
      out.push({ id: `protect:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Protection", desc: "Disadvantage na tento útok (Reaction, štít)." });
    // Hellish Rebuke po zranění
    if (trig.kind === "damaged" && isTgt && knowsSpell(t, "Hellish Rebuke") && slotsLeft(t, 1) > 0)
      out.push({ id: `rebuke:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Hellish Rebuke", desc: "2d10 Fire útočníkovi, DEX save half (slot 1, Reaction).", needsSlot: 1 });
    // Counterspell: nepřítel sesílá do 60 ft
    if (trig.kind === "enemyCasts" && trig.attacker && t.side !== trig.attacker.side && knowsSpell(t, "Counterspell") && slotsLeft(t, 3) > 0 && adjFt <= 60)
      out.push({ id: `counter:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Counterspell", desc: "Sesilatel CON save vs tvé DC — při neúspěchu kouzlo selže, slot se nespotřebuje (slot 3).", needsSlot: 3 });
    // OA varianty při odchodu/vstupu z/do dosahu
    if ((trig.kind === "leavesReach" || trig.kind === "entersReach" || trig.kind === "disengageLeave") && trig.attacker && t.side !== trig.attacker.side) {
      if (trig.kind === "leavesReach")
        out.push({ id: `oa:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Opportunity Attack", desc: "Útok na odcházejícího (Reaction)." });
      if (trig.kind === "disengageLeave" && hasFeature(t, /sentinel/i))
        out.push({ id: `sentinel:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Sentinel", desc: "OA i přes Disengage; zásah → speed 0 (Reaction)." });
      if (trig.kind === "entersReach" && hasFeature(t, /polearm master/i))
        out.push({ id: `pam:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Polearm Master", desc: "OA při vstupu do dosahu (Reaction)." });
      if ((trig.kind === "leavesReach" || trig.kind === "entersReach") && hasFeature(t, /war caster/i) && (t.kouzla || []).some((k) => (k.lvl || 0) === 0))
        out.push({ id: `warcaster:${t.id}`, whoId: t.id, who: t.nazev, nazev: "War Caster", desc: "Sešlij cantrip místo OA (Reaction)." });
      if (trig.kind === "leavesReach" && hasFeature(t, /mage slayer/i))
        out.push({ id: `mslayer:${t.id}`, whoId: t.id, who: t.nazev, nazev: "Mage Slayer", desc: "OA na sesilatele opouštějící dosah (Reaction)." });
    }
  }
  return out;
}

/** Aplikace reakce; vrátí text do logu (UI loguje přes cmd). */
export function applyReaction(S: StavBoje, opt: ReactionOption, trig: ReactionTrigger, rng: Rng): { msg: string; miss?: boolean; dmgMul?: number; dmgFlat?: number; countered?: boolean } {
  const t = S.tok.find((x) => x.id === opt.whoId); if (!t) return { msg: "" };
  const kind = opt.id.split(":")[0];
  const spendR = () => { const e = S.eco[t.id] = S.eco[t.id] || { a: 0, b: 0, r: 0, moved: 0, objInt: 0, spell: 0, baSpell: 0, dash: 0, disengage: 0, extraA: 0 }; e.r = 1; };
  const spendSlot = (lvl: number) => { const s = t.slots?.[lvl - 1]; if (s && s.used < s.max) { s.used++; return; } if (t.pact && t.pact.lvl >= lvl) t.pact.used++; };
  switch (kind) {
    case "shield": {
      spendSlot(1); spendR();
      t.effects.push({ id: uid(), nazev: "Shield", mods: { acBonus: 5 }, duration: { kind: "startOf", who: t.id } });
      const miss = (trig.hitTotal ?? 99) < t.ac + 5;
      return { msg: `${t.nazev}: Shield (+5 AC)${miss ? " — zásah je miss!" : ""}`, miss };
    }
    case "duelist": {
      spendR();
      const miss = (trig.hitTotal ?? 99) < t.ac + (t.pb ?? 2);
      return { msg: `${t.nazev}: Defensive Duelist (+${t.pb ?? 2} AC)${miss ? " — miss!" : ""}`, miss };
    }
    case "protect": spendR(); return { msg: `${t.nazev}: Protection — útok má Disadvantage` };
    case "uncanny": spendR(); return { msg: `${t.nazev}: Uncanny Dodge — zranění napůl`, dmgMul: 0.5 };
    case "intercept": { spendR(); const red = rollDice("1d10", { rng }).total + (t.pb ?? 2); return { msg: `${t.nazev}: Interception −${red} dmg`, dmgFlat: -red }; }
    case "rebuke": {
      spendSlot(1); spendR();
      const dmg = rollDice("2d10", { rng }).total;
      const atk = trig.attacker; let taken = dmg;
      if (atk) { const sv = d20(0, rng).r + (atk.saves?.DEX ?? atk.mods.DEX ?? 0); const dc = t.dc || t.casting?.dc || 10; if (sv >= dc) taken = Math.floor(dmg / 2); }
      if (atk) applyDamage(atk, [{ amount: taken, type: "Fire" }]);
      return { msg: `${t.nazev}: Hellish Rebuke → ${taken} Fire ${atk ? `na ${atk.nazev}` : ""}` };
    }
    case "counter": {
      spendSlot(3); spendR();
      const c = trig.attacker;
      if (!c) return { msg: `${t.nazev}: Counterspell` };
      const sv = d20(0, rng).r + (c.saves?.CON ?? c.mods.CON ?? 0);
      const dc = t.dc || t.casting?.dc || 10;
      const ok = sv < dc;
      return { msg: `${t.nazev}: Counterspell — ${c.nazev} CON save ${sv} vs ${dc}: ${ok ? "kouzlo selhalo (slot se nespotřebuje)" : "kouzlo projde"}`, countered: ok };
    }
    case "sentinel": { spendR(); if (trig.attacker) trig.attacker.speed = 0; return { msg: `${t.nazev}: Sentinel OA — ${trig.attacker?.nazev} speed 0` }; }
    case "pam": case "mslayer": case "oa": { spendR(); return { msg: `${t.nazev}: ${opt.nazev} (Reaction)` }; }
    case "warcaster": { spendR(); return { msg: `${t.nazev}: War Caster — cantrip jako OA` }; }
  }
  return { msg: "" };
}

/* Příkazy pro class features / featy (economy + zdroje + log). */
import { applyBattleDamage } from "../../rules/battleDamage";
import type { StavBoje, Token } from "../../types";
import { byId, log, useEco, ecoOf } from "../../rules/turn";
import { uid } from "../../types";
import { isFree } from "../../rules/free";
import { rollDice, defaultRng } from "../../rules/dice";
import { applyDamage, applyHealing } from "../../rules/damage";
import { fx } from "./shared";
import * as F from "../../rules/actions/features";

/** Spustí class feature / feat akci podle klíče. */
export function cmdFeature(S: StavBoje, id: string, key: string, tgtId?: string): { ok: boolean; reason?: string } {
  const t = byId(S, id); if (!t) return { ok: false, reason: "?" };
  const tgt = tgtId ? byId(S, tgtId) : undefined;
  const free = isFree(S);
  const eco = (k: "a" | "b") => free || useEco(S, t, k);
  const zd = (re: RegExp, n = 1) => free || F.spendZdroj(t, re, n);
  switch (key) {
    case "bardic": {
      if (!tgt) return { ok: false, reason: "vyber spojence" };
      if (!eco("b")) return { ok: false, reason: "Bonus Action použita" };
      const die = F.giveBardic(t, tgt);
      if (!die) return { ok: false, reason: "Bardic Inspiration došla" };
      log(S, "effect", `${t.nazev}: Bardic Inspiration (${die}) → ${tgt.nazev}`, t.nazev);
      return { ok: true };
    }
    case "divine-spark": {
      if (!eco("a") || !zd(/channel|divinity/i)) return { ok: false, reason: "akce/Channel Divinity" };
      const amt = F.divineSparkAmount(t);
      if (tgt && tgt.side === t.side) {
        const h = applyHealing(tgt, rollDice(amt, { rng: defaultRng }).total).healed;
        fx(S, "heal", { to: [tgt.x ?? 0, tgt.y ?? 0], text: `+${h}`, tokenId: tgt.id });
        log(S, "heal", `${t.nazev}: Divine Spark → ${tgt.nazev} +${h}`, t.nazev);
      } else if (tgt) {
        const d = rollDice(amt, { rng: defaultRng }).total;
        const sv = rollDice("1d20", { rng: defaultRng }).total + (tgt.saves?.CON ?? tgt.mods.CON ?? 0);
        const taken = sv >= (t.dc || 10) ? Math.floor(d / 2) : d;
        applyBattleDamage(S, tgt, [{ amount: taken, type: "Radiant" }]);
        fx(S, "bolt", { from: [t.x ?? 0, t.y ?? 0], to: [tgt.x ?? 0, tgt.y ?? 0], dmgType: "Radiant", tokenId: tgt.id });
        log(S, "damage", `${t.nazev}: Divine Spark → ${tgt.nazev} ${taken} Radiant (CON ${sv} vs ${t.dc || 10})`, t.nazev);
      }
      return { ok: true };
    }
    case "turn-undead": {
      if (!eco("a") || !zd(/channel|divinity/i)) return { ok: false, reason: "akce/Channel Divinity" };
      let n = 0;
      for (const u of S.tok) {
        if (u.dead || u.side === t.side || !/undead/i.test((u.typ || "") + " " + u.nazev)) continue;
        const d = Math.max(Math.abs((u.x ?? 0) - (t.x ?? 0)), Math.abs((u.y ?? 0) - (t.y ?? 0))) * 5;
        if (d > 30) continue;
        const sv = F.turnUndeadSave(u, t.dc || 10, defaultRng);
        if (!sv.ok) { F.applyTurned(u); n++; log(S, "cond", `${u.nazev}: Turned (Frightened+Incapacitated)`, t.nazev); }
        else log(S, "system", `${u.nazev}: WIS save ${sv.total} ≥ ${t.dc || 10} — odolal`, u.nazev);
      }
      log(S, "system", `${t.nazev}: Turn Undead — ${n}× obrácen`, t.nazev);
      return { ok: true };
    }
    case "wildshape": {
      if (!eco("b") || !zd(/wild shape/i)) return { ok: false, reason: "Bonus Action/Wild Shape" };
      const tmp = F.wildShapeTemp(t);
      t.tmp = Math.max(t.tmp || 0, tmp);
      t.effects.push({ id: uid(), nazev: "Wild Shape", mods: {}, duration: { kind: "rounds", rounds: 10 } });
      log(S, "system", `${t.nazev}: Wild Shape — temp HP ${tmp}`, t.nazev);
      return { ok: true };
    }
    case "flurry": {
      if (!eco("b") || !zd(/focus|ki /i)) return { ok: false, reason: "Bonus Action/Focus Point" };
      const e = ecoOf(S, t); (e as any).atkLeft = ((e as any).atkLeft || 0) + 2;
      log(S, "system", `${t.nazev}: Flurry of Blows — 2 unarmed strikes (BA)`, t.nazev);
      return { ok: true };
    }
    case "patient": {
      if (!eco("b") || !zd(/focus|ki /i)) return { ok: false, reason: "Bonus Action/Focus Point" };
      t.effects.push({ id: uid(), nazev: "Patient Defense", mods: { dodge: true, atkDisBy: true, noOA: true } as any, duration: { kind: "startOf", who: t.id } });
      log(S, "system", `${t.nazev}: Patient Defense — Disengage + Dodge`, t.nazev);
      return { ok: true };
    }
    case "stepwind": {
      if (!eco("b") || !zd(/focus|ki /i)) return { ok: false, reason: "Bonus Action/Focus Point" };
      const e = ecoOf(S, t); e.dash += 1; e.disengage = 1;
      log(S, "system", `${t.nazev}: Step of the Wind — Dash + Disengage (BA)`, t.nazev);
      return { ok: true };
    }
    case "cunning": {
      if (!eco("b")) return { ok: false, reason: "Bonus Action použita" };
      const e = ecoOf(S, t); e.dash += 1;
      log(S, "system", `${t.nazev}: Cunning Action (Dash/Disengage/Hide — zvol pohyb)`, t.nazev);
      return { ok: true };
    }
    case "reckless": {
      t.effects.push({ id: uid(), nazev: "Reckless Attack", mods: { atkAdv: true, atkAdvBy: true } as any, duration: { kind: "startOf", who: t.id } });
      log(S, "system", `${t.nazev}: Reckless Attack — Adv na STR útoky; útoky proti němu Adv`, t.nazev);
      return { ok: true };
    }
  }
  return { ok: false, reason: `neznámá schopnost ${key}` };
}

/** Detekované feature-akce tokenu (pro UI sekci Schopnosti). */
export function featureActions(t: Token): { key: string; nazev: string; desc: string }[] {
  const out: { key: string; nazev: string; desc: string }[] = [];
  if (F.hasBardic(t)) out.push({ key: "bardic", nazev: "Bardic Inspiration", desc: `BA: spojenci ${F.bardicDie(t)} die` });
  if (F.hasChannel(t)) {
    out.push({ key: "divine-spark", nazev: "Divine Spark", desc: "A: heal spojence nebo Radiant dmg (CON half)" });
    out.push({ key: "turn-undead", nazev: "Turn Undead", desc: "A: Undead 30 ft WIS save → Turned" });
  }
  if (F.hasWildShape(t)) out.push({ key: "wildshape", nazev: "Wild Shape", desc: `BA: temp HP ${F.wildShapeTemp(t)}` });
  if (F.hasFocus(t)) {
    out.push({ key: "flurry", nazev: "Flurry of Blows", desc: "BA+FP: 2 unarmed strikes" });
    out.push({ key: "patient", nazev: "Patient Defense", desc: "BA+FP: Disengage+Dodge" });
    out.push({ key: "stepwind", nazev: "Step of the Wind", desc: "BA+FP: Dash+Disengage" });
  }
  if (F.hasCunning(t)) out.push({ key: "cunning", nazev: "Cunning Action", desc: "BA: Dash/Disengage/Hide" });
  if (F.hasReckless(t)) out.push({ key: "reckless", nazev: "Reckless Attack", desc: "Adv na útoky; proti tobě Adv" });
  return out;
}

/* MovePopover: rozhodovací popover při dropu/přesunu — over-limit možnosti
   (Dash / Přesunout i tak ⚙ / Nucený přesun / Teleport), OA quick-resolve řádky,
   wall→teleport, "Pamatovat pro tento boj". */
import { useState } from "react";
import type { StavBoje, Token, BattleMapData, MoveMode } from "../types";
import type { MovementPlan } from "../rules/movement";
import { settingsOf } from "../rules/settings";
import { byId } from "../rules/turn";
import * as C from "../state/commands";
import OverridePrompt from "./OverridePrompt";

export interface DropReq {
  t: Token;
  plan: MovementPlan;
  waypoints: [number, number][];
  pt: { x: number; y: number };
  kind: "over" | "oa" | "blocked" | "mimoTah";
}

type Cmd = (fn: (S: StavBoje) => void) => void;

export default function MovePopover({ S, map, req, cmd, onClose }: {
  S: StavBoje; map: BattleMapData; req: DropReq; cmd: Cmd; onClose: () => void;
}) {
  const { t, plan } = req;
  const set = settingsOf(S);
  const [remember, setRemember] = useState(false);
  const [oaDone, setOaDone] = useState<Set<string>>(new Set());

  const execMove = (mode: MoveMode, useDash = false) => {
    const target = plan.blocked && plan.farthest ? plan.farthest : plan.path[plan.path.length - 1];
    if (!target) { onClose(); return; }
    cmd((s) => {
      if (remember) {
        s.nastaveni = s.nastaveni || undefined;
        s.nastaveni = { ...settingsOf(s), pohyb: { ...settingsOf(s).pohyb, limit: "volne" as const, vychoziPrekroceni: mode } };
      }
      C.moveToken(s, t.id, target[0], target[1], { ft: useDash || mode === "pravidla" || mode === "prekrocit" ? plan.ft : 0, oas: plan.oas, mode: useDash ? "dash" : mode, override: true });
    });
    onClose();
  };

  const doOa = (hid: string, attack: boolean) => {
    const h = byId(S, hid); if (!h) return;
    const atk = h.atk.find((a) => a.melee) || h.atk[0];
    if (attack && atk) cmd((s) => { const r = C.cmdAttack(s, { atkId: hid, tgtId: t.id, atk, override: true }, { map }); void r; });
    else cmd((s) => { const hh = byId(s, hid); if (hh) hh.react = false; });
    setOaDone(new Set([...oaDone, hid]));
  };

  const e = { plan, t };
  void e;

  // OA quick-resolve řádky
  const oaRows = plan.oaIds.length > 0 && (
    <div className="boj-op-oa">
      <b>Opportunity Attack:</b>
      {plan.oaIds.map((hid, i) => {
        const h = byId(S, hid);
        if (!h) return null;
        const atk = h.atk.find((a) => a.melee) || h.atk[0];
        const done = oaDone.has(hid);
        return (
          <div key={hid} className={`boj-op-oarow ${done ? "done" : ""}`}>
            <span>{plan.oas[i] || h.nazev}</span>
            {done ? <em>✓</em> : (
              <>
                <button onClick={() => doOa(hid, true)} disabled={!atk}>Útočit{atk ? ` (${atk.nazev})` : ""}</button>
                <button onClick={() => doOa(hid, false)}>Přeskočit</button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  if (req.kind === "oa") {
    const e2 = { canDisengage: plan.actionFree };
    return (
      <OverridePrompt title={`${t.nazev}: ${plan.ft} ft`} anchor={req.pt}
        reason={`Opustí dosah: ${plan.oas.join(", ")}`}
        options={[
          ...(e2.canDisengage ? [{ label: "Disengage (Action) a pokračovat", onPick: () => { cmd((s) => { const tt = byId(s, t.id); if (tt) { const e3 = s.eco[tt.id] || (s.eco[tt.id] = { a: 0, b: 0, r: 0, moved: 0, objInt: 0, spell: 0, baSpell: 0, dash: 0, disengage: 0, extraA: 0 }); e3.a = 1; e3.disengage = 1; } }); execMove("pravidla"); } }] : []),
          { label: "Pokračovat (OA viz níže)", onPick: () => execMove("pravidla") },
        ]}
        onClose={onClose}>
        {oaRows}
      </OverridePrompt>
    );
  }

  if (req.kind === "blocked") {
    return (
      <OverridePrompt title={`${t.nazev}: cesta blokována`} anchor={req.pt}
        reason={plan.blocked === "obsazeno" ? "Cílová buňka je obsazená." : plan.blocked === "mimo_mapu" ? "Mimo mapu." : "Zeď / neprůchodný terén."}
        options={[
          { label: "Teleport (⚙)", dm: true, onPick: () => execMove("teleport") },
          ...(plan.farthest ? [{ label: `Nucený přesun na (${plan.farthest[0]},${plan.farthest[1]})`, dm: true, onPick: () => execMove("nuceny") }] : []),
        ]}
        onClose={onClose} />
    );
  }

  if (req.kind === "mimoTah") {
    return (
      <OverridePrompt title={`${t.nazev}: přesun mimo tah`} anchor={req.pt}
        reason={`Není na tahu — ${plan.ft} ft${plan.oas.length ? ` · ⚠ OA: ${plan.oas.join(", ")}` : ""}`}
        options={[
          { label: `Pohyb (spotřebuje ${plan.ft} ft)`, onPick: () => execMove("pravidla") },
          { label: "Nucený přesun", dm: true, onPick: () => execMove("nuceny") },
          { label: "Teleport", dm: true, onPick: () => execMove("teleport") },
        ]}
        onClose={onClose}>
        {oaRows}
      </OverridePrompt>
    );
  }

  // over-limit
  const header = `${t.nazev}: ${plan.ft} ft · zbývá ${plan.limitFt} ft${plan.overFt ? ` (+${plan.overFt} ft)` : ""}`;
  const strict = set.pohyb.limit === "prisne";
  return (
    <OverridePrompt title={header} anchor={req.pt}
      reason={plan.oas.length ? `⚠ OA: ${plan.oas.join(", ")}` : undefined}
      options={[
        { label: "Dash (spotřebuje Action)", hint: plan.dashFits ? `do ${plan.limitFt + (t.speedOverride ?? t.speed)} ft` : "nesedí / Action použita", disabled: !plan.dashFits, onPick: () => execMove("dash", true) },
        ...(strict ? [] : [
          { label: `Přesunout i tak (+${plan.overFt} ft)`, dm: true, onPick: () => execMove("prekrocit") },
          { label: "Nucený přesun (bez pohybu, bez OA)", dm: true, onPick: () => execMove("nuceny") },
          { label: "Teleport", dm: true, onPick: () => execMove("teleport") },
        ]),
      ]}
      onClose={onClose}>
      {oaRows}
      {!strict && (
        <label className="boj-op-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Pamatovat pro tento boj (volný pohyb)
        </label>
      )}
    </OverridePrompt>
  );
}

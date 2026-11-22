import { describe, expect, it } from "vitest";
import { migrate } from "../rules/migrate";
import { custom } from "../rules/combatants";
import type { Intent } from "./useIntents";
import type { BattleMapData } from "../types";
import { actionId, applySimpleIntent, canAutoMove, intentError, intentResolution, intentOptions, logIntent, intentWasApplied, playerTurn, requestForResolution } from "./intentModel";
import { applyResolution, previewResolution } from "./resolution";
const map: BattleMapData = { id: "map", nazev: "Map", podklad: "mesto", mrizka: Array(15).fill("...............") };
const state = () => migrate({ map: "map", round: 1, turn: 0, ord: ["hero", "enemy"], tok: [
  { ...custom("Hero", "druzina", 30, 14), id: "hero", x: 2, y: 2, src: { owner: "7" }, atk: [{ nazev: "Bow", dmg: "1d6", typ: "Piercing", range: 80, toHit: 5 }] },
  { ...custom("Enemy", "nepratele", 30, 10), id: "enemy", x: 6, y: 2, atk: [{ nazev: "Sword", dmg: "1d6", typ: "Slashing", melee: true, toHit: 5 }] },
] });
const row = (kind: Intent["kind"], payload: Intent["payload"] = {}): Intent => ({ id: "request", user_id: 7, token_id: "hero", kind, payload, status: "pending", note: "" });
describe("intent revalidation and command adapters", () => {
  it("revalidates movement and automatically applies only legal non-OA paths", () => {
    const S = state(), move = row("move", { path: [[2, 2], [3, 2], [4, 2]] });
    expect(playerTurn(S, S.tok[0], 7)).toBe(true); expect(playerTurn(S, S.tok[0], 8)).toBe(false);
    expect(canAutoMove(S, map, move)).toBe(true);
    expect(applySimpleIntent(S, map, move)).toBe(true); expect(S.tok[0].x).toBe(4);
    expect(intentError(S, map, move)).toContain("pozice");
    const long = row("move", { path: [[4, 2], [14, 2]] }); expect(canAutoMove(S, map, long)).toBe(false);
    S.tok[0].x = 5;
    const oa = row("move", { path: [[5, 2], [4, 2], [3, 2]] });
    expect(canAutoMove(S, map, oa)).toBe(false);
    expect(applySimpleIntent(S, map, oa)).toBe(true); expect(S.pendingResolutions?.[0].kind).toBe("oa");
  });
  it("uses submitted dice in the staged dock, allows editing, and records an idempotency marker", () => {
    const S = state(), atk = S.tok[0].atk[0];
    const request = row("action", { ...requestForResolution({ kind: "attack", srcId: "hero", tgtId: "enemy", atk }), manual_dice: { attack: 19, damage: 8 } });
    expect(request.payload.action_id).toBe(actionId(atk)); expect(intentError(S, map, request)).toBeUndefined();
    const r = intentResolution(S, request)!;
    const draft = previewResolution(S, map, r, { ...intentOptions(request), manualDmg: 11 });
    expect(applyResolution(S, draft)).toBe(true); expect(S.tok[1].hp).toBe(19);
    logIntent(S, request, "Player One"); expect(intentWasApplied(S, request.id)).toBe(true);
    expect(S.log[0].t).toContain("Player One");
    expect(intentError(S, map, row("action", { action_id: "attack:missing" }))).toContain("dostupná");
    expect(intentError(S, map, row("action", { action_id: actionId(atk), target_ids: ["missing"] }))).toContain("Cíl");
  });
  it("handles standard actions, removed owners, empty paths and owner-only reaction approval", () => {
    const S = state(); expect(canAutoMove(S, map, row("move", { path: [] }))).toBe(false);
    expect(applySimpleIntent(S, map, row("action", { action_id: "std:dash" }))).toBe(true);
    S.pendingResolutions = [{ id: "reaction", tokenId: "enemy", kind: "oa", label: "OA", move: { ownerId: "hero", batch: "b", from: [6, 2], at: [6, 2], to: [7, 2], ft: 5 } }];
    expect(intentError(S, map, row("reaction", { pending_id: "reaction", accept: false }))).toBeUndefined();
    expect(applySimpleIntent(S, map, row("reaction", { pending_id: "reaction", accept: false }))).toBe(true);
    expect(S.tok[1].x).toBe(7); expect(S.pendingResolutions).toHaveLength(0);
    S.tok[0].src!.owner = "8";
    expect(intentError(S, map, row("end_turn"))).toContain("Vlastník");
  });
});

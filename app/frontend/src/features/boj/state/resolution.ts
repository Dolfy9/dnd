import type { BattleMapData, StavBoje } from "../types";
import type { Resolve } from "../components/ResolveDialog";
import type { ReactionOffer, TargetResult } from "../rules/resolutionTrace";
import { cmdArea, cmdAttack } from "./commands/combat";
import { byId, log } from "../rules/turn";

export interface ResolutionOptions {
  overrideAdv?: number | null; manualD20?: number; manualDmg?: number;
  manualSaves?: Record<string, number>; targetDamage?: Record<string, number>;
  slot?: number; pact?: boolean; override?: boolean; lucky?: "adv" | "dis"; inspire?: boolean;
}
export interface ResolutionDraft {
  before: string; next: StavBoje; seed: number; options: ResolutionOptions;
  results: TargetResult[]; reactions: ReactionOffer[]; accepted: string[]; skipped: string[];
  error?: string;
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const seeded = (seed: number) => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
export function previewResolution(S: StavBoje, map: BattleMapData, r: Resolve, options: ResolutionOptions, previous?: ResolutionDraft, accepted = previous?.accepted || [], skipped = previous?.skipped || []): ResolutionDraft {
  options = { slot: r.slot, pact: r.pact, ...options };
  const next = clone(S);
  const seed = previous?.seed ?? Math.floor(Math.random() * 4294967296);
  const draft: ResolutionDraft = { before: JSON.stringify(S), next, seed, options, results: [], reactions: [], accepted, skipped };
  if (options.manualD20 != null && (!Number.isInteger(options.manualD20) || options.manualD20 < 1 || options.manualD20 > 20)
    || Object.values(options.manualSaves || {}).some(n => !Number.isInteger(n) || n < 1 || n > 20)
    || [options.manualDmg, ...Object.values(options.targetDamage || {})].some(n => n != null && (!Number.isFinite(n) || n < 0))) {
    draft.error = "d20 musí být 1–20 a damage nezáporné číslo."; return draft;
  }
  const actor = byId(next, r.srcId);
  if (options.lucky && actor) {
    const resource = actor.zdroje.find(z => /lucky|luck/i.test(z.nazev) && z.used < z.max);
    if (!resource) { draft.error = "Chybí Luck Point."; return draft; }
    resource.used++; log(next, "system", `${actor.nazev}: Lucky (−1 Luck Point)`, actor.nazev);
  }
  if (options.inspire && actor) {
    if (!actor.heroicInspiration) { draft.error = "Chybí Heroic Inspiration."; return draft; }
    actor.heroicInspiration = false;
  }
  const hooks = { rng: seeded(seed), reactionRng: seeded(seed ^ 0x5f3759df), reactionIds: accepted,
    onResult: (result: TargetResult) => draft.results.push(result),
    onReaction: (offer: ReactionOffer) => { if (!draft.reactions.some(x => x.key === offer.key)) draft.reactions.push(offer); } };
  const target = r.kind === "attack" ? byId(next, r.tgtId) : undefined;
  const result = r.kind === "attack"
    ? r.atk.save && target
      ? cmdArea(next, { ...options, ...hooks, srcId: r.srcId, atk: r.atk, targetIds: [target.id], spec: { shape: "sphere", size: 0, anchor: [target.x || 0, target.y || 0] }, meta: r.meta, override: options.override || r.force }, { map })
      : cmdAttack(next, { ...options, ...hooks, atkId: r.srcId, tgtId: r.tgtId, atk: r.atk, meta: r.meta, override: options.override || r.force }, { map })
    : cmdArea(next, { ...options, ...hooks, srcId: r.srcId, spec: r.spec, atk: r.atk, slot: options.slot ?? r.slot, meta: r.meta, override: options.override || r.force }, { map });
  if (!result.ok) draft.error = result.reason || "Akci nelze vyhodnotit.";
  if (result.ok && r.kind === "attack") for (const tgtId of r.extraTgtIds || []) {
    const extra = cmdAttack(next, { ...options, ...hooks, atkId: r.srcId, tgtId, atk: r.atk, override: true }, { map });
    if (!extra.ok) draft.error = extra.reason || "Další cíl nelze vyhodnotit.";
  }
  return draft;
}
export function applyResolution(S: StavBoje, draft: ResolutionDraft): boolean {
  if (draft.error || JSON.stringify(S) !== draft.before) return false;
  for (const key of Object.keys(S)) delete (S as unknown as Record<string, unknown>)[key];
  Object.assign(S, clone(draft.next));
  return true;
}

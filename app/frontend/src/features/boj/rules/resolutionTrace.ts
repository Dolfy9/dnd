import type { AttackDef, StavBoje } from "../types";
import type { DamageResult } from "./damage";
import { gapFt } from "./grid";
import { applyReaction, reactionOptions, type ReactionOption, type ReactionTrigger } from "./actions/reactions";
import { defaultRng, type Rng } from "./dice";
import { log } from "./turn";

export interface TargetResult {
  tokenId: string;
  outcome: "hit" | "miss" | "crit" | "save" | "heal" | "cast";
  breakdown: string;
  parts: DamageResult["parts"];
  applied: number;
}
export interface ReactionOffer { key: string; option: ReactionOption; kind: ReactionTrigger["kind"] }
export interface ResolutionHooks {
  rng?: Rng;
  reactionRng?: Rng;
  reactionIds?: string[];
  onReaction?: (offer: ReactionOffer) => void;
  onResult?: (result: TargetResult) => void;
}
export function interrupt(S: StavBoje, hooks: ResolutionHooks, trigger: ReactionTrigger, before = false) {
  const result = { miss: false, countered: false, disadvantage: false, dmgMul: 1, dmgFlat: 0 };
  for (const reactor of S.tok) {
    const distance = trigger.kind === "enemyCasts" && trigger.attacker ? gapFt(reactor, trigger.attacker)
      : trigger.target ? gapFt(reactor, trigger.target) : trigger.distFt;
    for (const option of reactionOptions(S, { ...trigger, distFt: distance }).filter(o => o.whoId === reactor.id)) {
      if (trigger.kind === "hit" && option.id.startsWith("protect:") !== before) continue;
      const key = `${trigger.kind}:${option.id}`;
      hooks.onReaction?.({ key, option, kind: trigger.kind });
      if (!hooks.reactionIds?.includes(key)) continue;
      const response = applyReaction(S, option, trigger, hooks.reactionRng || hooks.rng || defaultRng);
      if (response.msg) log(S, "effect", response.msg, option.who);
      result.miss ||= !!response.miss;
      result.countered ||= !!response.countered;
      result.disadvantage ||= option.id.startsWith("protect:");
      result.dmgMul *= response.dmgMul ?? 1;
      result.dmgFlat += response.dmgFlat ?? 0;
      break;
    }
  }
  return result;
}
export function spellInterrupt(S: StavBoje, srcId: string, atk: AttackDef, hooks: ResolutionHooks) {
  const attacker = S.tok.find(t => t.id === srcId);
  return atk.kind === "spell" && (atk.lvl || 0) > 0 && attacker
    ? interrupt(S, hooks, { kind: "enemyCasts", attacker, atk }).countered : false;
}

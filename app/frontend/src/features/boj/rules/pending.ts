import type { StavBoje } from "../types";
import { uid } from "../types";

export type PendingKind = "oa" | "concentration" | "reaction" | "legendary" | "saveEnd";
export interface PendingDecision {
  id: string;
  kind: "oa" | "concentration" | "saveEnd";
  tokenId: string;
  label: string;
  dc?: number;
  spell?: string;
  effectId?: string;
  key?: string;
  move?: { batch: string; ownerId: string; from: [number, number]; at: [number, number]; to: [number, number]; ft: number };
}
export const pendingOrder: Record<PendingKind, number> = { oa: 0, concentration: 1, reaction: 2, legendary: 3, saveEnd: 4 };
export const pendingOf = (S: StavBoje): PendingDecision[] => S.pendingResolutions || [];
export function enqueueDecision(S: StavBoje, decision: Omit<PendingDecision, "id">) {
  if (decision.key && pendingOf(S).some(p => p.key === decision.key)) return;
  S.pendingResolutions = [...pendingOf(S), { ...decision, id: uid() }];
}
export function removeDecision(S: StavBoje, id: string) {
  S.pendingResolutions = pendingOf(S).filter(p => p.id !== id);
}
export function orderedDecisions<T extends { kind: PendingKind }>(items: T[]): T[] {
  return items.map((item, i) => ({ item, i })).sort((a, b) => pendingOrder[a.item.kind] - pendingOrder[b.item.kind] || a.i - b.i).map(x => x.item);
}

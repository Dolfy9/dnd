/* Volný režim — jediný predikát pro celý příkazový layer.
   isFree(S) → žádné kontroly ekonomiky/dostřelu/OA/triggerů. */
import type { StavBoje } from "../types";
import { settingsOf } from "./settings";

export const isFree = (S: StavBoje): boolean => settingsOf(S).rezim === "volny";

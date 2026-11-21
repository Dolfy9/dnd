/* Sjednocená knihovna presetů efektů/zón. */
import type { EffectPreset } from "../../types";
import { BUFF_PRESETS } from "./buffs";
import { CONTROL_PRESETS } from "./control";
import { ZONE_PRESETS } from "./zones";
import { FEATURE_PRESETS } from "./features";
import { ENV_PRESETS } from "./environment";

export const EFFECT_PRESETS: EffectPreset[] = [
  ...BUFF_PRESETS, ...CONTROL_PRESETS, ...ZONE_PRESETS, ...FEATURE_PRESETS, ...ENV_PRESETS,
];

export const PRESET_CATS = [
  { id: "buff", nazev: "Bufy", icon: "✨" },
  { id: "control", nazev: "Kontrola", icon: "🧊" },
  { id: "zone", nazev: "Zóny", icon: "🌫️" },
  { id: "feature", nazev: "Schopnosti", icon: "⚔️" },
  { id: "env", nazev: "Prostředí", icon: "🌍" },
] as const;

/** Auto-návrh presetů podle názvů features/kouzel postavy. */
export function suggestPresets(names: string[]): EffectPreset[] {
  const hay = names.join("\n").toLowerCase();
  return EFFECT_PRESETS.filter((p) => {
    if (!p.suggest) return false;
    try { return new RegExp(p.suggest, "i").test(hay); } catch { return false; }
  });
}

export interface VariantAsset { src: string; varianty?: string[] }

export function normalizeVariant(value: unknown, count = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= count ? value : 0;
}

export function assetSrc(entry: VariantAsset, value?: number): string {
  const v = normalizeVariant(value, entry.varianty?.length || 0);
  return v ? entry.varianty![v - 1] || entry.src : entry.src;
}

export function placementVariant(entry: VariantAsset | undefined, random: boolean, chosen = 0, rng = Math.random): number {
  const count = entry?.varianty?.length || 0;
  if (!random) return normalizeVariant(chosen, count);
  if (!count) return 0;
  const roll = rng();
  return Number.isFinite(roll) ? Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, roll)) * (count + 1)) : 0;
}

export function nextVariant(entry: VariantAsset | undefined, current?: number): number {
  const count = entry?.varianty?.length || 0;
  return (normalizeVariant(current, count) + 1) % (count + 1);
}

export function variantEdits(
  objects: { id: string; asset: string; v?: number }[],
  assets: Record<string, VariantAsset>,
  action: number | "next" | "random",
  rng = Math.random,
): Record<string, number> {
  const edits: Record<string, number> = {};
  for (const object of objects) {
    const entry = assets[object.asset];
    const current = normalizeVariant(object.v, entry?.varianty?.length || 0);
    const value = action === "next" ? nextVariant(entry, current)
      : placementVariant(entry, action === "random", typeof action === "number" ? action : 0, rng);
    if (value !== current) edits[object.id] = value;
  }
  return edits;
}

/* Manifest assetů a textur — načítá se z /repo/11_Mapy/bojove/assets|textury.
   Obrázky mají přednost; vestavěné SVG stamps/textury jsou fallback. */
import { useQuery } from "@tanstack/react-query";
export { assetSrc, normalizeVariant, placementVariant, nextVariant } from "../../boj/model/assetVariants";

export interface AssetEntry {
  id: string; nazev: string; kategorie?: string; src: string;
  varianty?: string[];
  srcVyp?: string;
  prepinatelny?: boolean;
  w?: number; h?: number;
  z?: number;
  blend?: "screen";
  vyska?: number;
  blocks?: boolean; cover?: 2 | 3; difficult?: boolean;
  light?: { bright: number; dim: number };
  tags?: string[]; custom?: boolean;
  anim?: "voda" | "portal" | "vitr" | "ohen" | "zare";
}
export interface TextureEntry { id: string; nazev: string; src: string; cells: number }

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) return {};
  return r.json().catch(() => ({}));
}

export async function fetchAssetManifest(): Promise<Record<string, AssetEntry>> {
  const a = await fetchJson("/repo/11_Mapy/bojove/assets/assety.json");
  const map: Record<string, AssetEntry> = {};
  for (const e of a.assety || []) map[e.id] = e;
  return map;
}

export function useAssetManifest() {
  return useQuery({
    queryKey: ["boj-assets-manifest"],
    queryFn: fetchAssetManifest,
    staleTime: 30_000,
  });
}

export function useTextureManifest() {
  return useQuery({
    queryKey: ["boj-textury-manifest"],
    queryFn: async () => {
      const t = await fetchJson("/repo/11_Mapy/bojove/textury/textury.json");
      const map: Record<string, TextureEntry> = {};
      for (const e of t.textury || []) map[e.id] = e;
      return map;
    },
    staleTime: 30_000,
  });
}

export const assetUrl = (src: string) => `/repo/11_Mapy/${src}`;

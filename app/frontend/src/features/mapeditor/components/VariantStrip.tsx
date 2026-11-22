import { assetUrl, assetSrc, normalizeVariant, type AssetEntry } from "../assets/manifest";

export function VariantStrip({ entry, value = 0, onChange }: {
  entry: AssetEntry; value?: number; onChange: (value: number) => void;
}) {
  return <div className="me-variant-strip" aria-label={"Varianty: " + entry.nazev}>
    {Array.from({ length: 1 + (entry.varianty?.length || 0) }, (_, v) =>
      <button type="button" key={v} aria-pressed={normalizeVariant(value, entry.varianty?.length || 0) === v}
        title={v ? "Varianta " + v : "Základ"} onClick={() => onChange(v)}>
        <img src={assetUrl(assetSrc(entry, v))} alt={entry.nazev + (v ? " – varianta " + v : " – základ")} loading="lazy" />
        <small>{v || "Základ"}</small>
      </button>)}
  </div>;
}

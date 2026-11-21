/* Panel Prostředí: zóny (seznam), světla, terén brush, fog of war, kostky, rest. */
import { useState } from "react";
import type { StavBoje, Token } from "../types";
import { TILES } from "../types";
import { parseLightLevel } from "../rules/lighting";
import type { BattleMapData } from "../types";
import { Dices, CloudFog, Brush, Lightbulb, MoonStar, SunDim, Sun, BedDouble, Coffee } from "lucide-react";

export const LIGHT_PRESETS = [
  { nazev: "Torch", bright: 20, dim: 20 },
  { nazev: "Lantern (hooded)", bright: 30, dim: 30 },
  { nazev: "Light (cantrip)", bright: 20, dim: 20 },
  { nazev: "Daylight", bright: 60, dim: 60 },
  { nazev: "Continual Flame", bright: 20, dim: 20 },
  { nazev: "Vlastní", bright: 10, dim: 10 },
] as const;

export const PAINT_TILES = [
  { c: "#", n: "Zeď" }, { c: "o", n: "Sloup (¾)" }, { c: "%", n: "Kryt ½ + těžký" },
  { c: "^", n: "Těžký terén" }, { c: "~", n: "Voda" }, { c: "_", n: "Propast" },
  { c: "x", n: "Nebezpečí" }, { c: "+", n: "Dveře" }, { c: ".", n: "Guma" },
];

export default function ToolsPanel({ S, map, sel, dm, tool, paintTile, fogMode,
  onTool, onPaintTile, onFogMode, onFogToggle, onFogParty, onAddLight, onRemoveLight,
  onLightLevel, onRemoveZone, onDice, onRest }: {
  S: StavBoje; map: BattleMapData; sel: Token | null; dm: boolean;
  tool: string; paintTile: string; fogMode: "reveal" | "hide";
  onTool: (t: any) => void;
  onPaintTile: (c: string) => void;
  onFogMode: (m: "reveal" | "hide") => void;
  onFogToggle: (on: boolean) => void;
  onFogParty: () => void;
  onAddLight: (l: { nazev: string; bright: number; dim: number; tokenId?: string }) => void;
  onRemoveLight: (id: string) => void;
  onLightLevel: (l: "bright" | "dim" | "dark") => void;
  onRemoveZone: (id: string) => void;
  onDice: (expr: string, adv: -1 | 0 | 1) => void;
  onRest: (kind: "short" | "long") => void;
}) {
  const [expr, setExpr] = useState("2d6+3");
  const [adv, setAdv] = useState<-1 | 0 | 1>(0);
  const globalLvl = S.lightLevel || parseLightLevel(map.osvetleni);
  return (
    <div className="boj-tools">
      {dm && (
        <>
          <div className="boj-sec">
            <h4><Brush size={12} /> Terén (malování)</h4>
            <div className="boj-paint">
              {PAINT_TILES.map((t) => (
                <button key={t.c} className={tool === "paint" && paintTile === t.c ? "on" : ""}
                        title={TILES[t.c]?.nazev || t.n}
                        onClick={() => { onPaintTile(t.c); onTool("paint"); }}>{t.c === "." ? "⌫" : t.c}</button>
              ))}
            </div>
          </div>
          <div className="boj-sec">
            <h4><CloudFog size={12} /> Fog of War</h4>
            <div className="boj-fog">
              <label><input type="checkbox" checked={!!S.fog?.on} onChange={(e) => onFogToggle(e.target.checked)} /> zapnuto</label>
              <button className={tool === "fog" && fogMode === "reveal" ? "on" : ""} onClick={() => { onFogMode("reveal"); onTool("fog"); }}>Odkrýt</button>
              <button className={tool === "fog" && fogMode === "hide" ? "on" : ""} onClick={() => { onFogMode("hide"); onTool("fog"); }}>Zakrýt</button>
              <button onClick={onFogParty}>Odhalit okolí družiny</button>
            </div>
          </div>
          <div className="boj-sec">
            <h4><Lightbulb size={12} /> Osvětlení</h4>
            <div className="boj-light-global">
              {([["bright", Sun, "Bright"], ["dim", SunDim, "Dim"], ["dark", MoonStar, "Darkness"]] as const).map(([l, I, n]) => (
                <button key={l} className={globalLvl === l ? "on" : ""} onClick={() => onLightLevel(l)}><I size={12} /> {n}</button>
              ))}
              <i className="boj-hint">mapa: {map.osvetleni || "—"}</i>
            </div>
            <div className="boj-light-list">
              {LIGHT_PRESETS.map((l) => (
                <div key={l.nazev} className="boj-light-row">
                  <b>{l.nazev}</b><span>{l.bright}/{l.dim} ft</span>
                  <button onClick={() => sel ? onAddLight({ ...l, tokenId: sel.id }) : onAddLight(l)}
                          title={sel ? `Přidat na ${sel.nazev}` : "Umístit do mapy (nástroj Světlo)"}>
                    {sel ? "na žeton" : "+"}
                  </button>
                </div>
              ))}
            </div>
            {!!(S.lights || []).length && (
              <div className="boj-light-list">
                {S.lights!.map((l) => {
                  const src = l.tokenId ? S.tok.find((t) => t.id === l.tokenId) : null;
                  return (
                    <div key={l.id} className="boj-light-row owned">
                      <b>{l.nazev}</b><span>{src ? `na ${src.nazev}` : "na mapě"}</span>
                      <button onClick={() => onRemoveLight(l.id)}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      {!!S.zones.length && (
        <div className="boj-sec">
          <h4>Zóny ({S.zones.length})</h4>
          {S.zones.map((z) => (
            <div key={z.id} className="boj-zone-row">
              <b>{z.nazev}</b><span>{z.style}{z.conc ? " ⛁" : ""}</span>
              {dm && <button onClick={() => onRemoveZone(z.id)}>✕</button>}
            </div>
          ))}
        </div>
      )}
      <div className="boj-sec">
        <h4><Dices size={12} /> Kostky</h4>
        <div className="boj-dice">
          <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="2d6+3 / d20" />
          <button className={adv === 1 ? "on" : ""} onClick={() => setAdv(adv === 1 ? 0 : 1)} title="Advantage">A</button>
          <button className={adv === -1 ? "on" : ""} onClick={() => setAdv(adv === -1 ? 0 : -1)} title="Disadvantage">D</button>
          <button className="acc" onClick={() => onDice(expr === "d20" ? "1d20" : expr, expr === "d20" ? adv : 0)}>Hoď</button>
        </div>
      </div>
      {dm && (
        <div className="boj-sec">
          <h4>Odpočinek (všichni živí)</h4>
          <div className="boj-rest">
            <button onClick={() => onRest("short")}><Coffee size={13} /> Short Rest</button>
            <button onClick={() => onRest("long")}><BedDouble size={13} /> Long Rest</button>
          </div>
        </div>
      )}
    </div>
  );
}

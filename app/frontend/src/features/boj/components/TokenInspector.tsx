/* Inspektor žetonu: HP/damage/heal/temp s damage type, stavy, efekty, zdroje,
   death saves, concentration, poznámky, hide-from-players, odebrat. */
import { useState } from "react";
import type { StavBoje, Token } from "../types";
import { DMG_TYPES } from "../types";
import { CONDITIONS, CONDITION_NAMES, exhaustion } from "../rules/conditions";
import { EFFECT_PRESETS } from "../rules/effects";
import { dmgStyle, SIDE_STYLE } from "./visual";
import ConditionIcon from "./ConditionIcon";
import { PORTRAIT_DEFAULT, fokusOf } from "./TokenCoin";
import EntityPicker from "../../../components/EntityPicker";
import { get } from "../../../api";

type Cmd = (fn: (S: StavBoje) => void) => void;
import * as C from "../state/commands";
import { byId, ecoOf, moveLeft } from "../rules/turn";

export default function TokenInspector({ S, t, cmd, dm, onClose }: {
  S: StavBoje; t: Token; cmd: Cmd; dm: boolean; onClose: () => void;
}) {
  const [dmg, setDmg] = useState("6");
  const [dtyp, setDtyp] = useState("Slashing");
  const [eff, setEff] = useState(EFFECT_PRESETS[0].id);
  const [pickPath, setPickPath] = useState("");
  const [portPath, setPortPath] = useState(t.portret || "");
  const [fok, setFok] = useState(() => ({ ...fokusOf(t) }));
  const commitFok = (f = fok) => cmd((S) => C.patchToken(S, t.id, { portretFokus: { ...f } }));
  const setPort = (v: string) => {
    setPortPath(v);
    cmd((S) => C.patchToken(S, t.id, { portret: v.trim() || undefined }));
  };
  const usePicked = async (p: string) => {
    setPickPath(p);
    if (!p) return;
    try {
      const r = await get<any>(`/api/page?path=${encodeURIComponent(p)}`);
      const pr = r.entity?.portret || r.portret;
      if (pr) setPort(pr);
    } catch { /* keep */ }
  };
  const side = SIDE_STYLE[t.side];
  const ex = exhaustion(t);
  return (
    <div className="boj-insp">
      <div className="boj-insp-head">
        <b>{t.nazev}</b>
        <button className="boj-x" onClick={onClose}>✕</button>
      </div>
      <div className="boj-insp-hp">
        {dm ? (
        <>
        <div className="boj-hpbar">
          <i style={{ width: `${Math.max(0, (t.hp / Math.max(1, t.max)) * 100)}%` }} />
          {t.tmp > 0 && <em style={{ width: `${Math.min(100, (t.tmp / Math.max(1, t.max)) * 100)}%` }} />}
          <b>{t.hp}{t.tmp ? `+${t.tmp}` : ""} / {t.max} HP · AC {t.ac}</b>
        </div>
        <div className="boj-insp-dmg">
          <input type="number" value={dmg} onChange={(e) => setDmg(e.target.value)} min={0} />
          <select value={dtyp} onChange={(e) => setDtyp(e.target.value)}>
            {DMG_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="boj-insp-btns">
          <button className="boj-btn2 dmg" onClick={() => cmd((S) => C.cmdDamage(S, t.id, Number(dmg) || 0, dtyp))}>Zranit</button>
          <button className="boj-btn2 heal" onClick={() => cmd((S) => C.cmdHeal(S, t.id, Number(dmg) || 0))}>Léčit</button>
          <button className="boj-btn2 tmp" onClick={() => cmd((S) => C.cmdTemp(S, t.id, Number(dmg) || 0))}>Temp</button>
        </div>
        </>
        ) : (
        <div className="boj-hpbar">
          <i style={{ width: `${Math.max(0, (t.hp / Math.max(1, t.max)) * 100)}%` }} />
          <b>{t.side === "druzina" ? `${t.hp}/${t.max} HP` : "Stav skryt"} · AC {t.side === "druzina" ? t.ac : "—"}</b>
        </div>
        )}
        {t.dying && (
          <div className="boj-ds">
            <b>Death saves:</b>
            {[0, 1, 2].map((i) => <i key={"s" + i} className={t.ds.s > i ? "ok" : ""} />)}
            <span>/</span>
            {[0, 1, 2].map((i) => <i key={"f" + i} className={t.ds.f > i ? "bad" : ""} />)}
            <button className="boj-btn2" onClick={() => cmd((S) => C.cmdDeathSave(S, t.id))}>Hodit</button>
          </div>
        )}
      </div>
      <details className="boj-insp-sec" open>
        <summary>Pohyb</summary>
        <div className="boj-move-sec">
          <div>Pohyb tento tah: <b>{ecoOf(S, t).moved} / {moveLeft(S, t) + ecoOf(S, t).moved} ft</b>{ecoOf(S, t).dash ? " (+Dash)" : ""}
            <div className="boj-move-bar"><i style={{ width: `${Math.min(100, (ecoOf(S, t).moved / Math.max(1, moveLeft(S, t) + ecoOf(S, t).moved)) * 100)}%` }} /></div>
            {t.fly || t.swim || t.climb ? (
            <em style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)", display: "block" }}>
              walk {t.speed} · fly {t.fly || "—"} · swim {t.swim || "—"} · climb {t.climb || "—"}
            </em>
          ) : null}</div>
          {t.speedOverride != null && <span className="boj-chip">⚙ speed {t.speedOverride}</span>}
          {dm && (
            <div className="boj-move-ctl">
              <button className="boj-btn2" onClick={() => cmd((S) => { const e = ecoOf(S, byId(S, t.id)!); e.moved = Math.max(0, e.moved - 5); })}>−5 ft</button>
              <button className="boj-btn2" onClick={() => cmd((S) => { const e = ecoOf(S, byId(S, t.id)!); e.moved += 5; })}>+5 ft</button>
              <button className="boj-btn2" onClick={() => cmd((S) => C.undoTurnMovement(S, t.id))} disabled={!t.startPos}>Reset</button>
              <button className={`boj-btn2 ${ecoOf(S, t).dash ? "on" : ""}`} title="Dash — zdvojnásobí zbytek pohybu za Action"
                      onClick={() => cmd((S) => { const e = ecoOf(S, byId(S, t.id)!); e.dash = e.dash ? 0 : 1; if (e.dash) e.a = 1; })}>Dash</button>
              <input type="number" min={0} step={5} placeholder="speed ⚙" title="Dočasná rychlost (⚙ DM)"
                     value={t.speedOverride ?? ""}
                     onChange={(e) => cmd((S) => C.patchToken(S, t.id, { speedOverride: e.target.value === "" ? undefined : Number(e.target.value) }))}
                     style={{ width: 58 }} />
            </div>
          )}
        </div>
      </details>
      {dm && (
        <details className="boj-insp-sec">
          <summary>Portrét</summary>
          <div className="boj-portrait-edit">
            <EntityPicker target="postava" value={pickPath} onChange={usePicked} placeholder="Postava / NPC…" />
            <input type="text" value={portPath} onChange={(e) => setPort(e.target.value)}
                   placeholder="repo cesta nebo URL obrázku" />
            {portPath && (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--line)", flexShrink: 0 }}>
                    <img src={/^(https?:)?\//.test(portPath) ? portPath : `/repo/${portPath}`} alt=""
                         style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${fok.x * 100}% ${fok.y * 100}%`, transform: `scale(${fok.zoom})` }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {([["X", "x", 0, 1, 0.01], ["Y", "y", 0, 1, 0.01], ["Zoom", "zoom", 1, 3.5, 0.05]] as const).map(([lab, k, mn, mx, stp]) => (
                      <div key={k} className="boj-fok">
                        <span>{lab}</span>
                        <input type="range" min={mn} max={mx} step={stp} value={fok[k]}
                               onChange={(e) => setFok({ ...fok, [k]: Number(e.target.value) })}
                               onPointerUp={() => commitFok()} onKeyUp={() => commitFok()} />
                        <b>{fok[k].toFixed(2)}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="boj-btn2" onClick={() => { setFok({ ...PORTRAIT_DEFAULT }); commitFok({ ...PORTRAIT_DEFAULT }); }}>
                  Výchozí ořez (hlava)
                </button>
              </>
            )}
          </div>
        </details>
      )}
      {dm && (
        <details className="boj-insp-sec" open>
          <summary>Stavy</summary>
          <div className="boj-cond-grid">
            {CONDITION_NAMES.map((n) => {
              const on = t.cond.some((c) => c.n === n);
              if (n === "Exhaustion") return (
                <div key={n} className="boj-exh">
                  <ConditionIcon n={n} size={18} />
                  <div className="boj-exh-lvls">
                    {[1, 2, 3, 4, 5, 6].map((l) => (
                      <i key={l} className={ex >= l ? "on" : ""} onClick={() => cmd((S) => {
                        const x = byId(S, t.id); if (!x) return;
                        x.cond = x.cond.filter((c) => c.n !== "Exhaustion");
                        x.exhaustion = l === ex ? 0 : l;
                        if (x.exhaustion) x.cond.push({ n: "Exhaustion", lvl: x.exhaustion });
                      })}>{l}</i>
                    ))}
                  </div>
                </div>
              );
              return (
                <button key={n} className={`boj-cond-btn ${on ? "on" : ""}`}
                        onClick={() => cmd((S) => C.toggleCond(S, t.id, n))} title={CONDITIONS[n]?.desc}>
                  <ConditionIcon n={n} size={16} /> {n}
                </button>
              );
            })}
          </div>
        </details>
      )}
      <details className="boj-insp-sec" open>
        <summary>Efekty</summary>
        {t.effects.length ? t.effects.map((e) => (
          <div key={e.id} className="boj-eff">
            <span>{e.icon} {e.nazev}{e.conc ? " ⛁" : ""}{e.duration?.rounds != null ? ` (${e.duration.rounds}k)` : ""}</span>
            {dm && <button onClick={() => cmd((S) => C.removeEffect(S, t.id, e.id))}>✕</button>}
          </div>
        )) : <i className="boj-none">žádné</i>}
        {dm && (
          <div className="boj-insp-add">
            <select value={eff} onChange={(e) => setEff(e.target.value)}>
              {EFFECT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.nazev}</option>)}
            </select>
            <button className="boj-btn2" onClick={() => cmd((S) => C.addEffect(S, t.id, eff, S.ord?.[S.turn]))}>Přidat</button>
          </div>
        )}
        {t.conc && <div className="boj-conc-row">⛁ Concentration: <b>{t.conc}</b> {dm && <button onClick={() => cmd((S) => C.dropConc(S, t.id))}>ukončit</button>}</div>}
      </details>
      {!!t.zdroje.length && (
        <details className="boj-insp-sec" open>
          <summary>Zdroje</summary>
          {t.zdroje.map((z, i) => (
            <div key={i} className="boj-eff">
              <span>{z.nazev} <em>{z.max - z.used}/{z.max}</em></span>
              {dm && <button onClick={() => cmd((S) => { const x = byId(S, t.id); if (x) x.zdroje[i].used = Math.min(z.max, x.zdroje[i].used + 1); })}>−1</button>}
            </div>
          ))}
        </details>
      )}
      {!!t.slots.length && (
        <details className="boj-insp-sec" open>
          <summary>Sloty</summary>
          <div className="boj-slots">
            {t.slots.map((s, i) => (
              <span key={i} className="boj-slot" title={`${i + 1}. úroveň`} onClick={() => cmd((S) => { const x = byId(S, t.id); if (x && s.used < s.max) x.slots[i].used += 1; })}>
                {i + 1}<em>{s.max - s.used}</em>
              </span>
            ))}
          </div>
        </details>
      )}
      {dm && (
        <details className="boj-insp-sec">
          <summary>Nastavení žetonu</summary>
          <div className="boj-insp-meta">
          <label><input type="checkbox" checked={!!t.skryty} onChange={(e) => cmd((S) => C.patchToken(S, t.id, { skryty: e.target.checked }))} /> Skrytý před hráči</label>
          <label>Init: <input type="number" style={{ width: 44 }} value={t.init ?? ""} onChange={(e) => cmd((S) => C.setInit(S, t.id, Number(e.target.value) || 0))} /></label>
          <label>Elev: <input type="number" style={{ width: 44 }} value={t.elev ?? 0} onChange={(e) => cmd((S) => C.patchToken(S, t.id, { elev: Number(e.target.value) || 0 }))} /></label>
          <button className="boj-btn2 err" onClick={() => cmd((S) => C.removeToken(S, t.id))}>Odebrat z boje</button>
          </div>
        </details>
      )}
      <div className="boj-insp-foot" style={{ color: side.ring }}>{side.name} · {t.kind}{t.cr ? ` · CR ${t.cr}` : ""}{t.xp ? ` · ${t.xp} XP` : ""}</div>
    </div>
  );
}

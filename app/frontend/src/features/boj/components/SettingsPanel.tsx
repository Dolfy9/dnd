/* Nastavení boje — DM panel (gear v toolbaru): seskupené volby s jednořádkovým
   vysvětlením, "Obnovit výchozí", "Uložit jako výchozí pro nové boje". */
import { useMemo, useState } from "react";
import type { StavBoje, BattleSettings } from "../types";
import { defaultSettings, mergeSettings, saveDefaultSettings, SETTING_LABELS } from "../rules/settings";
import OverridePrompt from "./OverridePrompt";

const POHYB_KEYS = ["pohyb.limit", "pohyb.uhlopricky", "pohyb.pruchodNepratel", "pohyb.oa", "pohyb.zonyPriPresunuDM", "pohyb.mimoTah", "pohyb.sledujTah"];
const AUTO_KEYS = ["automatizace.hodUtoku", "automatizace.zraneni", "automatizace.concentration", "automatizace.zony", "automatizace.expirace", "automatizace.recharge", "automatizace.deathSaves", "automatizace.ekonomika", "automatizace.sloty", "automatizace.dosah"];

function deepGet(o: any, path: string) { return path.split(".").reduce((a, k) => a?.[k], o); }
function deepSet(o: any, path: string, v: unknown) {
  const ks = path.split(".");
  const c = { ...o, [ks[0]]: { ...o[ks[0]] } };
  c[ks[0]][ks[1]] = v;
  return c;
}

export default function SettingsPanel({ S, cmd, onClose }: {
  S: StavBoje;
  cmd: (fn: (s: StavBoje) => void) => void;
  onClose: () => void;
}) {
  const cur = useMemo(() => mergeSettings(S.nastaveni), [S.nastaveni]);
  const [saved, setSaved] = useState(false);
  const set = (path: string, v: unknown) =>
    cmd((s) => { s.nastaveni = deepSet(mergeSettings(s.nastaveni), path, v) as BattleSettings; });

  const group = (title: string, keys: string[]) => (
    <div key={title}>
      <h4>{title}</h4>
      {keys.map((k) => {
        const L = SETTING_LABELS[k];
        if (!L) return null;
        const v = deepGet(cur, k);
        return (
          <div className="boj-set-row" key={k}>
            <label>{L.n}</label>
            <i>{L.hint}</i>
            {L.opts ? (
              <select value={String(v)} onChange={(e) => set(k, e.target.value)}>
                {Object.entries(L.opts).map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
              </select>
            ) : (
              <label style={{ fontWeight: 400 }}>
                <input type="checkbox" checked={!!v} onChange={(e) => set(k, e.target.checked)} /> zapnuto
              </label>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <OverridePrompt title="Nastavení boje" onClose={onClose} options={[]}>
      <div className="boj-set">
        {group("Pohyb", POHYB_KEYS)}
        {group("Automatizace", AUTO_KEYS)}
        <div className="boj-set-actions">
          <button className="boj-btn2" onClick={() => cmd((s) => { s.nastaveni = defaultSettings(); })}>Obnovit výchozí</button>
          <button className="boj-btn2 pri" onClick={() => { saveDefaultSettings(mergeSettings(S.nastaveni)); setSaved(true); }}>
            {saved ? "✓ Uloženo" : "Uložit jako výchozí pro nové boje"}
          </button>
        </div>
      </div>
    </OverridePrompt>
  );
}

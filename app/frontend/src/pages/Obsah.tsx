import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "../api";
import { PageHeader, toast } from "../components/ui";
import EffectEditor from "../components/EffectEditor";
import ContentPicker, { useObsah, type ObsahItem } from "../components/ContentPicker";

const AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const FEAT_KAT = ["Origin", "General", "Fighting Style", "Epic Boon"];
const PREDMET_TYPY = ["weapon", "armor", "shield", "wondrous", "potion", "ring", "rod",
  "staff", "wand", "scroll", "gear", "other"];

/* kind (rules) → typ entity / složka / šablona */
const KINDY: Record<string, { label: string; type: string; dir: string; tpl: string; fm: string }> = {
  species: { label: "Druhy (Species)", type: "druh", dir: "13_Druhy", tpl: "_Sablony/Sablona_Druh.md", fm: "druh" },
  class: { label: "Povolání (Classes)", type: "povolani", dir: "14_Povolani", tpl: "_Sablony/Sablona_Povolani.md", fm: "povolani" },
  subclass: { label: "Subclasses", type: "podtrida", dir: "15_Podtridy", tpl: "_Sablony/Sablona_Podtrida.md", fm: "podtrida" },
  feat: { label: "Featy", type: "feat", dir: "16_Featy", tpl: "_Sablony/Sablona_Feat.md", fm: "feat" },
  spell: { label: "Kouzla", type: "kouzlo", dir: "17_Kouzla", tpl: "_Sablony/Sablona_Kouzlo.md", fm: "kouzlo" },
  item: { label: "Předměty", type: "predmet", dir: "18_Predmety", tpl: "_Sablony/Sablona_Predmet.md", fm: "predmet" },
  background: { label: "Pozadí (Backgrounds)", type: "pozadi", dir: "19_Pozadi", tpl: "_Sablony/Sablona_Pozadi.md", fm: "pozadi" },
};

function In({ label, v, set, w, num, ta }: {
  label: string; v: any; set: (x: any) => void; w?: number; num?: boolean; ta?: boolean;
}) {
  return (
    <label className="ob-f"><span>{label}</span>
      {ta
        ? <textarea className="inp" rows={3} value={v ?? ""} onChange={(e) => set(e.target.value)} />
        : <input className="inp" style={w ? { width: w } : undefined} type={num ? "number" : "text"}
            value={v ?? ""} onChange={(e) => set(num ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)} />}
    </label>
  );
}
function ListIn({ label, v, set, hint }: { label: string; v: any; set: (x: any) => void; hint?: string }) {
  return <In label={label + (hint ? ` (${hint})` : "")} v={Array.isArray(v) ? v.join(", ") : (v ?? "")}
    set={(x) => set(String(x).split(",").map((s) => s.trim()).filter(Boolean))} />;
}

/* editor rysů {nazev, uroven?, text, efekty} */
function RysyEditor({ rysy, onChange, uroven }: { rysy: any[]; onChange: (r: any[]) => void; uroven?: boolean }) {
  const arr = Array.isArray(rysy) ? rysy : [];
  const upd = (i: number, p: any) => { const n = [...arr]; n[i] = { ...n[i], ...p }; onChange(n); };
  return (
    <div className="ob-rysy">
      {arr.map((r, i) => (
        <div key={i} className="fx-row">
          <div className="fx-head">
            <input className="cs-e" placeholder="Název" value={r.nazev || ""} onChange={(e) => upd(i, { nazev: e.target.value })} />
            {uroven && <input type="number" className="cs-e" style={{ width: 56 }} placeholder="Úr." value={r.uroven ?? ""}
              onChange={(e) => upd(i, { uroven: e.target.value === "" ? undefined : Number(e.target.value) })} />}
            <button type="button" className="cs-edel" onClick={() => onChange(arr.filter((_, j) => j !== i))}>✕</button>
          </div>
          <textarea className="cs-e cs-ea" rows={2} placeholder="Text rysu" value={r.text || ""} onChange={(e) => upd(i, { text: e.target.value })} />
          <EffectEditor effects={r.efekty || []} onChange={(l) => upd(i, { efekty: l })} />
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onChange([...arr, { nazev: "", ...(uroven ? { uroven: 1 } : {}), text: "", efekty: [] }])}>+ rys</button>
    </div>
  );
}

/* standardní tabulky slotů PHB 2024 (sloupce 1st–9th) pro předvyplnění */
const SLOTY_FULL = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
const SLOTY_HALF = [
  [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]];
const SLOTY_THIRD: number[][] = Array.from({ length: 20 }, (_, i) => {
  const t: Record<number, number[]> = { 3: [2], 4: [3], 7: [4, 2], 10: [4, 3], 13: [4, 3, 2], 16: [4, 3, 3], 19: [4, 3, 3, 1] };
  const l = i + 1; let cur: number[] = [];
  for (const k of Object.keys(t)) if (l >= Number(k)) cur = t[Number(k)];
  return cur;
});
const PACT: Record<number, [number, number]> = { 1: [1, 1], 2: [2, 1], 3: [2, 2], 5: [2, 3], 7: [2, 4], 9: [2, 5], 11: [3, 5], 17: [4, 5] };
const SLOT_COLS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
const KOUZLENI_TYPY: [string, string][] = [
  ["none", "žádné"], ["full", "plné"], ["half", "poloviční"], ["third", "třetinové"], ["pact", "pakt"]];

/* sloupce tabulky podle typu kouzlení */
function kouzleniSloupce(k: any): string[] {
  if (!k?.typ || k.typ === "none") return [];
  if (k.typ === "pact") return ["Cantrips", "Spells Known", "Pact Slots", "Slot Level"];
  return ["Cantrips", k.pripravuje === false ? "Spells Known" : "Prepared Spells", ...SLOT_COLS];
}

/* předvyplnění tabulky standardními hodnotami podle typu kouzlení */
function prefillTabulka(k: any): any {
  const t: any = {};
  for (let l = 1; l <= 20; l++) {
    const row: any = {};
    if (!k?.typ || k.typ === "none") { t[String(l)] = row; continue; }
    if (k.typ === "pact") {
      let p: [number, number] = [0, 0];
      for (const kk of Object.keys(PACT)) if (l >= Number(kk)) p = PACT[Number(kk)];
      row["Cantrips"] = l >= 10 ? 4 : l >= 4 ? 3 : 2;
      row["Spells Known"] = Math.min(15, l + 1);
      row["Pact Slots"] = p[0]; row["Slot Level"] = p[1];
    } else {
      const arr = k.typ === "half" ? SLOTY_HALF : k.typ === "third" ? SLOTY_THIRD : SLOTY_FULL;
      row["Cantrips"] = k.typ === "third" ? (l >= 10 ? 4 : 3) : (l >= 10 ? 4 : l >= 4 ? 3 : 2);
      row[k.pripravuje === false ? "Spells Known" : "Prepared Spells"] = l + 1;
      arr[l - 1].forEach((n, i) => { row[SLOT_COLS[i]] = n; });
    }
    t[String(l)] = row;
  }
  return t;
}

/* editor tabulky povolání 1–20 (PB + Features auto, sloupce kouzlení, vlastní sloupce) */
function TabulkaEditor({ tabulka, onChange, rysy, kouzleni }: {
  tabulka: any; onChange: (t: any) => void; rysy?: any[]; kouzleni?: any;
}) {
  const tab = tabulka || {};
  const spellCols = kouzleniSloupce(kouzleni);
  const rysyPoUrovnich = useMemo(() => {
    const m: Record<number, string[]> = {};
    (rysy || []).forEach((r: any) => {
      const u = Number(r.uroven) || 0;
      if (u >= 1 && u <= 20 && r.nazev) (m[u] = m[u] || []).push(r.nazev);
    });
    return m;
  }, [rysy]);
  const autoCols = new Set(["Proficiency Bonus", "Features", ...spellCols]);
  const cols = useMemo(() => {
    const s = new Set<string>();
    Object.values(tab).forEach((r: any) => Object.keys(r || {}).forEach((k) => s.add(k)));
    return [...s].filter((c) => !autoCols.has(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, kouzleni?.typ, kouzleni?.pripravuje]);
  const [newCol, setNewCol] = useState("");
  const setCell = (lvl: number, col: string, v: string) => {
    const t = { ...tab, [String(lvl)]: { ...(tab[String(lvl)] || {}) } };
    if (v === "") delete t[String(lvl)][col];
    else t[String(lvl)][col] = v !== "" && !isNaN(Number(v)) ? Number(v) : v;
    onChange(t);
  };
  return (
    <div className="ob-tab-wrap">
      <table className="ob-tab">
        <thead><tr><th>Úr.</th><th title="Automaticky">PB</th><th title="Z rysů">Features</th>
          {spellCols.map((c) => <th key={c}>{c}</th>)}
          {cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((l) => (
            <tr key={l}><td>{l}</td>
              <td className="ob-tab-ro">+{Math.ceil(l / 4) + 1}</td>
              <td className="ob-tab-ro ob-tab-feat">{(rysyPoUrovnich[l] || []).join(", ")}</td>
              {spellCols.map((c) => (
                <td key={c}><input className="cs-e" value={tab[String(l)]?.[c] ?? ""}
                  onChange={(e) => setCell(l, c, e.target.value)} /></td>
              ))}
              {cols.map((c) => (
                <td key={c}><input className="cs-e" value={tab[String(l)]?.[c] ?? ""}
                  onChange={(e) => setCell(l, c, e.target.value)} /></td>
              ))}</tr>
          ))}
        </tbody>
      </table>
      <div className="cs-erow mt-1">
        <input className="cs-e" placeholder="nový sloupec (Rages, Sorcery Points…)" value={newCol} onChange={(e) => setNewCol(e.target.value)} />
        <button type="button" className="btn sm" onClick={() => {
          if (!newCol.trim()) return;
          onChange({ ...tab, "1": { ...(tab["1"] || {}), [newCol.trim()]: tab["1"]?.[newCol.trim()] } });
          setNewCol("");
        }}>+ sloupec</button>
        {!!spellCols.length && (
          <button type="button" className="btn sm" title="Přepíše sloupce kouzlení standardní tabulkou"
            onClick={() => {
              const p = prefillTabulka(kouzleni);
              const t = { ...tab };
              for (let l = 1; l <= 20; l++) t[String(l)] = { ...(t[String(l)] || {}), ...p[String(l)] };
              onChange(t);
            }}>Předvyplnit standardní tabulku</button>)}
      </div>
    </div>
  );
}

function ObsahForm({ kind, initial, onSave, onCancel }: {
  kind: string; initial: any; onSave: (data: any) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<any>(initial || {});
  const set = (k: string, v: any) => setD((p: any) => { const n = { ...p }; if (v === undefined || v === "") delete n[k]; else n[k] = v; return n; });
  return (
    <div className="card-in ob-form">
      <In label="Název" v={d.nazev} set={(x) => set("nazev", x)} />
      {kind === "species" && <>
        <ListIn label="Velikost" v={d.velikost} set={(x) => set("velikost", x)} hint="Small, Medium" />
        <In label="Rychlost (ft)" v={d.rychlost} set={(x) => set("rychlost", x)} num />
        <In label="Typ" v={d.typ} set={(x) => set("typ", x)} />
        <h5>Rysy</h5><RysyEditor rysy={d.rysy} onChange={(r) => set("rysy", r)} />
      </>}
      {kind === "class" && <>
        <h5>Základ</h5>
        <div className="ob-grid2">
          <div className="ob-f"><span>Hit Die</span>
            <select className="inp" value={d.hit_die ?? ""} onChange={(e) => set("hit_die", e.target.value === "" ? undefined : Number(e.target.value))}>
              <option value="">—</option>{[6, 8, 10, 12].map((x) => <option key={x} value={x}>k{x}</option>)}
            </select></div>
          <div className="ob-f"><span>Primární atribut</span>
            <select className="inp" value={d.primarni_atribut || ""} onChange={(e) => set("primarni_atribut", e.target.value)}>
              <option value="">—</option>{AB.map((a) => <option key={a} value={a}>{a}</option>)}
            </select></div>
          <In label="Subclass od úrovně" v={d.podtrida_uroven} set={(x) => set("podtrida_uroven", x)} num w={60} />
          <ListIn label="ASI úrovně" v={d.asi_urovne} set={(x) => set("asi_urovne", x)} hint="4,8,12,16,19" />
        </div>
        <h5>Zdatnosti</h5>
        <div className="ob-grid2">
          <div className="ob-f"><span>Záchrany</span>
            <span className="flex flex-wrap gap-2">
              {AB.map((a) => <label key={a} className="cs-echeck"><input type="checkbox"
                checked={(d.zachrany || []).includes(a)}
                onChange={(e) => set("zachrany", e.target.checked ? [...(d.zachrany || []), a] : (d.zachrany || []).filter((x: string) => x !== a))} />{a}</label>)}
            </span></div>
          <In label="Dovednosti – počet" v={d.dovednosti_volba?.pocet} set={(x) => set("dovednosti_volba", { ...(d.dovednosti_volba || {}), pocet: x })} num w={60} />
          <ListIn label="Dovednosti – z" v={d.dovednosti_volba?.z} set={(x) => set("dovednosti_volba", { ...(d.dovednosti_volba || {}), z: x })} />
          <ListIn label="Zbroj" v={d.zbroj} set={(x) => set("zbroj", x)} />
          <ListIn label="Zbraně" v={d.zbrane} set={(x) => set("zbrane", x)} />
          <ListIn label="Nástroje" v={d.nastroje} set={(x) => set("nastroje", x)} />
        </div>
        <h5>Kouzlení</h5>
        <div className="ob-grid2">
          <div className="ob-f"><span>Typ kouzlení</span>
            <select className="inp" value={d.kouzleni?.typ || "none"} onChange={(e) => set("kouzleni", { ...(d.kouzleni || {}), typ: e.target.value })}>
              {KOUZLENI_TYPY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>
          {d.kouzleni?.typ && d.kouzleni.typ !== "none" && <>
            <div className="ob-f"><span>Atribut kouzlení</span>
              <select className="inp" value={d.kouzleni?.atribut || ""} onChange={(e) => set("kouzleni", { ...(d.kouzleni || {}), atribut: e.target.value })}>
                <option value="">—</option>{AB.map((a) => <option key={a} value={a}>{a}</option>)}
              </select></div>
            <label className="cs-echeck"><input type="checkbox" checked={d.kouzleni?.pripravuje !== false}
              onChange={(e) => set("kouzleni", { ...(d.kouzleni || {}), pripravuje: e.target.checked })} /> připravuje kouzla (Prepared Spells)</label>
          </>}
        </div>
        <h5>Tabulka úrovní 1–20</h5>
        <TabulkaEditor tabulka={d.tabulka} rysy={d.rysy} kouzleni={d.kouzleni} onChange={(t) => set("tabulka", t)} />
        <h5>Rysy (podle úrovně)</h5><RysyEditor rysy={d.rysy} onChange={(r) => set("rysy", r)} uroven />
      </>}
      {kind === "subclass" && <>
        <div className="ob-f"><span>Rodičovská třída</span>
          <ContentPicker kind="class" value={d.trida || ""} onChange={(name) => set("trida", name)} />
        </div>
        <h5>Rysy</h5><RysyEditor rysy={d.rysy} onChange={(r) => set("rysy", r)} uroven />
        <h5>Vždy připravená kouzla</h5>
        <RysyEditor rysy={d.kouzla_vzdy} onChange={(r) => set("kouzla_vzdy", r)} uroven />
      </>}
      {kind === "feat" && <>
        <div className="ob-f"><span>Kategorie</span>
          <select className="inp" value={d.kategorie || ""} onChange={(e) => set("kategorie", e.target.value)}>
            <option value="">—</option>{FEAT_KAT.map((k) => <option key={k} value={k}>{k}</option>)}
          </select></div>
        <In label="Předpoklad" v={d.predpoklad} set={(x) => set("predpoklad", x)} />
        <label className="cs-echeck"><input type="checkbox" checked={!!d.opakovatelny} onChange={(e) => set("opakovatelny", e.target.checked || undefined)} /> opakovatelný</label>
        <In label="Text" v={d.text} set={(x) => set("text", x)} ta />
        <h5>Efekty</h5><EffectEditor effects={d.efekty || []} onChange={(l) => set("efekty", l)} />
      </>}
      {kind === "spell" && <>
        <In label="Úroveň (0 = cantrip)" v={d.uroven} set={(x) => set("uroven", x)} num w={70} />
        <In label="Škola" v={d.skola} set={(x) => set("skola", x)} />
        <In label="Čas" v={d.cas} set={(x) => set("cas", x)} />
        <In label="Dosah" v={d.dosah} set={(x) => set("dosah", x)} />
        <In label="Složky" v={d.slozky} set={(x) => set("slozky", x)} />
        <In label="Trvání" v={d.trvani} set={(x) => set("trvani", x)} />
        <label className="cs-echeck"><input type="checkbox" checked={!!d.koncentrace} onChange={(e) => set("koncentrace", e.target.checked || undefined)} /> Concentration</label>
        <label className="cs-echeck"><input type="checkbox" checked={!!d.ritual} onChange={(e) => set("ritual", e.target.checked || undefined)} /> Ritual</label>
        <ListIn label="Třídy" v={d.tridy} set={(x) => set("tridy", x)} />
        <In label="Text" v={d.text} set={(x) => set("text", x)} ta />
        <In label="Na vyšších úrovních" v={d.vyssi_urovne} set={(x) => set("vyssi_urovne", x)} ta />
      </>}
      {kind === "item" && <>
        <div className="ob-f"><span>Typ</span>
          <select className="inp" value={d.typ || ""} onChange={(e) => set("typ", e.target.value)}>
            <option value="">—</option>{PREDMET_TYPY.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></div>
        <In label="Vzácnost" v={d.vzacnost} set={(x) => set("vzacnost", x)} />
        <label className="cs-echeck"><input type="checkbox" checked={!!d.naladeni} onChange={(e) => set("naladeni", e.target.checked || undefined)} /> vyžaduje Attunement</label>
        <In label="Hmotnost (lb)" v={d.hmotnost} set={(x) => set("hmotnost", x)} num w={80} />
        <In label="Cena" v={d.cena} set={(x) => set("cena", x)} />
        {(d.typ === "armor" || d.typ === "shield") && <>
          <In label="Základní AC" v={d.zbroj?.zakladni_ac} set={(x) => set("zbroj", { ...(d.zbroj || {}), zakladni_ac: x })} num w={70} />
          <div className="ob-f"><span>Typ zbroje</span>
            <select className="inp" value={d.zbroj?.typ || ""} onChange={(e) => set("zbroj", { ...(d.zbroj || {}), typ: e.target.value })}>
              <option value="">—</option>{["light", "medium", "heavy"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <In label="Max DEX bonus" v={d.zbroj?.max_dex} set={(x) => set("zbroj", { ...(d.zbroj || {}), max_dex: x })} num w={70} />
        </>}
        {d.typ === "weapon" && <>
          <In label="Kostka" v={d.zbran?.kostka} set={(x) => set("zbran", { ...(d.zbran || {}), kostka: x })} />
          <ListIn label="Typ zranění" v={d.zbran?.typ_zraneni} set={(x) => set("zbran", { ...(d.zbran || {}), typ_zraneni: x })} />
          <ListIn label="Vlastnosti" v={d.zbran?.vlastnosti} set={(x) => set("zbran", { ...(d.zbran || {}), vlastnosti: x })} />
          <In label="Weapon Mastery" v={d.zbran?.mastery} set={(x) => set("zbran", { ...(d.zbran || {}), mastery: x })} />
          <In label="Dosah" v={d.zbran?.dosah} set={(x) => set("zbran", { ...(d.zbran || {}), dosah: x })} />
        </>}
        <In label="Text" v={d.text} set={(x) => set("text", x)} ta />
        <h5>Efekty</h5><EffectEditor effects={d.efekty || []} onChange={(l) => set("efekty", l)} />
      </>}
      {kind === "background" && <>
        <ListIn label="Atributy (3)" v={d.atributy} set={(x) => set("atributy", x)} />
        <div className="ob-f"><span>Origin feat</span>
          <ContentPicker kind="feat" value={d.feat || ""} filter={(it) => it.data?.kategorie === "Origin"} onChange={(name) => set("feat", name)} />
        </div>
        <ListIn label="Dovednosti (2)" v={d.dovednosti} set={(x) => set("dovednosti", x)} />
        <In label="Nástroj" v={d.nastroj} set={(x) => set("nastroj", x)} />
        <In label="Výbava" v={d.vybava} set={(x) => set("vybava", x)} ta />
        <In label="Text" v={d.text} set={(x) => set("text", x)} ta />
      </>}
      {kind !== "class" && kind !== "subclass" && (
        <><h5>Sdílené efekty navíc</h5><EffectEditor effects={d.efekty || []} onChange={(l) => set("efekty", l)} /></>
      )}
      <div className="flex gap-2 mt-3 justify-end">
        <button className="btn" onClick={onCancel}>Zrušit</button>
        <button className="btn btn-primary" disabled={!String(d.nazev || "").trim()}
          onClick={() => onSave({ ...d, vlastni: true })}>Uložit</button>
      </div>
    </div>
  );
}

export default function Obsah() {
  const [sp] = useSearchParams();
  const [kind, setKind] = useState(sp.get("kind") || "feat");
  const [q, setQ] = useState("");
  const [filtr, setFiltr] = useState<"vse" | "vlastni" | "oficialni">("vse");
  const [editing, setEditing] = useState<null | { mode: "new" | "edit"; item?: ObsahItem }>(null);
  const listQ = useObsah(kind, "");
  const qc = useQueryClient();
  const items = ((listQ.data?.items || listQ.data || []) as ObsahItem[])
    .filter((it) => (!q || it.name.toLowerCase().includes(q.toLowerCase()))
      && (filtr === "vse" || (filtr === "vlastni") === it.vlastni));
  const K = KINDY[kind];

  /* deep link /obsah?kind=X&stranka=path → rovnou otevřít editor */
  const strankaParam = sp.get("stranka");
  useEffect(() => {
    if (!strankaParam || editing) return;
    const it = ((listQ.data?.items || listQ.data || []) as ObsahItem[])
      .find((x) => x.stranka === strankaParam);
    if (it) setEditing({ mode: "edit", item: it });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQ.data, strankaParam]);

  const duplikuj = async (it: ObsahItem) => {
    const nazev = prompt("Název vlastní verze:", `${it.name} (vlastní)`);
    if (!nazev) return;
    try {
      const data = { ...(it.data || {}), nazev, vlastni: true };
      const r = await post<{ ok: boolean; url: string }>("/api/entities",
        { type: K.type, dir: K.dir, name: nazev, data, template: K.tpl });
      toast("Vytvořena vlastní kopie.", "ok");
      qc.invalidateQueries({ queryKey: ["obsah"] });
      if (r.url) window.location.hash = "";
    } catch (e) { toast(e instanceof Error ? e.message : "Chyba", "err"); }
  };

  const save = async (data: any) => {
    try {
      if (editing?.mode === "edit" && editing.item?.stranka) {
        const ent = await get<{ id: number }>(`/api/entities/by-path?path=${encodeURIComponent(editing.item.stranka)}`);
        await put(`/api/entities/${ent.id}`, { data });
      } else {
        await post("/api/entities", { type: K.type, dir: K.dir, name: data.nazev, data, template: K.tpl });
      }
      toast("Uloženo — mechanika je hned k dispozici engine.", "ok");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["obsah"] });
      qc.invalidateQueries({ queryKey: ["nav"] });
    } catch (e) { toast(e instanceof Error ? e.message : "Uložení selhalo", "err"); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto fade-in">
      <PageHeader icon="🛠" title="Vlastní obsah pravidel"
        subtitle="Homebrew druhy, povolání, subclassy, featy, kouzla, předměty a pozadí — ukládají se jako stránky označené jako vlastní obsah a engine je použije stejně jako oficiální pravidla." />
      <div className="flex flex-wrap gap-2 items-center mb-3">
        {Object.entries(KINDY).map(([k, v]) => (
          <button key={k} className={"cs-tab" + (kind === k ? " on" : "")} onClick={() => { setKind(k); setEditing(null); }}>{v.label}</button>
        ))}
      </div>
      <div className={"ob-cols" + (editing ? " editing" : "")}>
        <div>
          <div className="flex gap-2 mb-3 items-center">
            <input className="inp" style={{ maxWidth: 260 }} placeholder="Hledat…" value={q} onChange={(e) => setQ(e.target.value)} />
            {(["vse", "vlastni", "oficialni"] as const).map((f) => (
              <button key={f} className={"btn sm" + (filtr === f ? " btn-primary" : "")}
                onClick={() => setFiltr(f)}>{f === "vse" ? "Vše" : f === "vlastni" ? "Vlastní" : "Oficiální"}</button>
            ))}
            <span className="flex-1" />
            <button className="btn btn-primary" onClick={() => setEditing({ mode: "new" })}>+ Nový</button>
          </div>
          <div className="card divide-y divide-[var(--line)] ob-list">
            {items.map((it) => (
              <div key={it.key} className={"flex items-center gap-2 px-3 py-2 font-ui" + (editing?.item?.key === it.key ? " ob-sel" : "")}>
                <span className="text-sm flex-1">{it.name}
                  {it.vlastni && <span className="chip chip-accent ml-2">vlastní</span>}</span>
                {it.stranka && <a className="text-[12px] text-[var(--accent-2)]" href={`/p/${it.stranka}`}>stránka</a>}
                {it.vlastni
                  ? <button className="btn sm" onClick={() => setEditing({ mode: "edit", item: it })}>Upravit</button>
                  : <button className="btn sm" title="Zkopíruje data do nové vlastní stránky" onClick={() => duplikuj(it)}>Duplikovat jako vlastní</button>}
              </div>
            ))}
            {!items.length && <p className="p-4 text-sm text-[var(--ink-3)] italic">Nic nenalezeno.</p>}
          </div>
        </div>
        {editing && (
          <ObsahForm kind={kind}
            initial={editing.mode === "edit" ? editing.item?.data : {}}
            onSave={save} onCancel={() => setEditing(null)} />
        )}
      </div>
    </div>
  );
}

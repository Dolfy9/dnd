import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "../api";

const AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const DMG = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const SKILLS = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History",
  "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception",
  "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"];
const OBLAST = ["dovednost", "zachrana", "zbran", "zbroj", "nastroj", "jazyk"];
const CIL_BONUS = ["iniciativa", "utok", "zraneni", "zachrana", "dovednost", "dc_kouzel",
  "utok_kouzel", "pasivni", "ac"];
const OBNOVA = ["short", "long"];
const DRUH_RYCHLOSTI = ["walk", "fly", "swim", "climb", "burrow"];
const VELIKOSTI = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

const FIELD_LABELS: Record<string, string> = {
  atribut: "Atribut", hodnota: "Hodnota / výraz", max: "Maximum", podminka: "Podmínka",
  zaklad: "Základ", atributy: "Atributy (čárkou)", stit_povolen: "Štít povolen",
  bez_zbroje: "Jen bez zbroje", za_uroven: "Za úroveň", druh: "Druh", nastavit: "Nastavit (ne přičíst)",
  nazev: "Název", dosah: "Dosah (ft)", oblast: "Oblast", cil: "Cíl", filtr: "Filtr",
  popis: "Popis", text: "Text", od_urovne: "Od úrovně", obnova: "Obnova", pocet: "Počet / výraz",
  vzdy: "Vždy připravené", kostka: "Kostka", typ_zraneni: "Typ zranění", volba: "Volba (název)",
  moznosti: "Možnosti",
};

type Meta = { typ: string; label: string; pole: string[] };

export function useEfektTypy() {
  return useQuery({
    queryKey: ["efekty-typy"],
    queryFn: () => get<{ typy: Meta[]; spolecna_pole: string[] }>("/api/postava/efekty-typy"),
    staleTime: 300_000,
  });
}

function Field({ name, ef, set }: { name: string; ef: any; set: (k: string, v: any) => void }) {
  const v = ef[name];
  const numOrExpr = (raw: string) =>
    raw === "" ? undefined : (raw.trim() !== "" && !isNaN(Number(raw)) ? Number(raw) : raw);
  if (name === "atribut") return (
    <select className="cs-e" value={v || ""} onChange={(e) => set(name, e.target.value || undefined)}>
      <option value="">—</option>{AB.map((a) => <option key={a} value={a}>{a}</option>)}
    </select>);
  if (name === "typ_zraneni") return (
    <select className="cs-e" value={v || ""} onChange={(e) => set(name, e.target.value || undefined)}>
      <option value="">—</option>{DMG.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>);
  if (name === "oblast") return (
    <select className="cs-e" value={v || ""} onChange={(e) => set(name, e.target.value || undefined)}>
      <option value="">—</option>{OBLAST.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>);
  if (name === "cil") return (
    <select className="cs-e" value={v || ""} onChange={(e) => set(name, e.target.value || undefined)}>
      <option value="">—</option>{CIL_BONUS.map((x) => <option key={x} value={x}>{x}</option>)}
      {SKILLS.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>);
  if (name === "obnova") return (
    <select className="cs-e" value={v || ""} onChange={(e) => set(name, e.target.value || undefined)}>
      <option value="">—</option>{OBNOVA.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>);
  if (name === "druh") return (
    <select className="cs-e" value={v || ""} onChange={(e) => set(name, e.target.value || undefined)}>
      <option value="">walk</option>{DRUH_RYCHLOSTI.filter((x) => x !== "walk").map((x) => <option key={x} value={x}>{x}</option>)}
    </select>);
  if (name === "hodnota" && ef.typ === "zdatnost" && ef.oblast === "dovednost") return (
    <select className="cs-e" value={v || ""} onChange={(e) => set(name, e.target.value || undefined)}>
      <option value="">—</option>{SKILLS.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>);
  if (name === "hodnota" && ef.typ === "velikost") return (
    <select className="cs-e" value={v || ""} onChange={(e) => set(name, e.target.value || undefined)}>
      <option value="">—</option>{VELIKOSTI.map((x) => <option key={x} value={x}>{x}</option>)}
    </select>);
  if (["stit_povolen", "bez_zbroje", "nastavit", "vzdy"].includes(name)) return (
    <input type="checkbox" checked={!!v} onChange={(e) => set(name, e.target.checked || undefined)} />);
  if (["od_urovne", "zaklad", "dosah", "max"].includes(name)) return (
    <input type="number" className="cs-e" style={{ width: 70 }} value={v ?? ""}
      onChange={(e) => set(name, e.target.value === "" ? undefined : Number(e.target.value))} />);
  if (name === "atributy") return (
    <input className="cs-e" placeholder="STR, DEX" value={Array.isArray(v) ? v.join(", ") : (v || "")}
      onChange={(e) => set(name, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />);
  if (name === "text" || name === "popis") return (
    <textarea className="cs-e cs-ea" rows={2} value={v || ""} onChange={(e) => set(name, e.target.value || undefined)} />);
  return (
    <input className="cs-e" placeholder={name === "hodnota" || name === "pocet" ? "číslo nebo výraz (PB, mod:CHA…)" : ""}
      value={v ?? ""} onChange={(e) => set(name, numOrExpr(e.target.value))} />);
}

/* Editor jednoho efektu + volitelné vnořené možnosti (volba → moznosti). */
function EffectRow({ ef, onChange, onDel, onMove, meta }: {
  ef: any; onChange: (e: any) => void; onDel: () => void;
  onMove: (d: number) => void; meta: Meta[];
}) {
  const [raw, setRaw] = useState(false);
  const [rawTxt, setRawTxt] = useState("");
  const m = meta.find((x) => x.typ === ef.typ);
  const set = (k: string, v: any) => {
    const n = { ...ef };
    if (v === undefined) delete n[k]; else n[k] = v;
    onChange(n);
  };
  const pole = [...(m?.pole || Object.keys(ef).filter((k) => k !== "typ")), "od_urovne", "podminka"];
  const seen = new Set<string>();
  const moznosti = ef.moznosti && typeof ef.moznosti === "object" ? ef.moznosti : {};
  return (
    <div className="fx-row">
      <div className="fx-head">
        <button type="button" className="btn sm" title="Nahoru" onClick={() => onMove(-1)}>↑</button>
        <button type="button" className="btn sm" title="Dolů" onClick={() => onMove(1)}>↓</button>
        <select className="cs-e" value={ef.typ || ""}
          onChange={(e) => onChange({ typ: e.target.value })}>
          <option value="">— typ —</option>
          {meta.map((x) => <option key={x.typ} value={x.typ}>{x.label} ({x.typ})</option>)}
          {ef.typ && !meta.find((x) => x.typ === ef.typ) && <option value={ef.typ}>{ef.typ}</option>}
        </select>
        <label className="fx-volba-l">volba
          <input className="cs-e" style={{ width: 120 }} placeholder="—"
            value={ef.volba || ""} onChange={(e) => set("volba", e.target.value || undefined)} /></label>
        <button type="button" className="btn sm" title="Režim surového JSONu"
          onClick={() => { setRaw(!raw); setRawTxt(JSON.stringify(ef, null, 1)); }}>{"{}"}</button>
        <button type="button" className="cs-edel" onClick={onDel}>✕</button>
      </div>
      {raw ? (
        <div>
          <textarea className="cs-e cs-ea" rows={5} value={rawTxt} onChange={(e) => setRawTxt(e.target.value)} />
          <button type="button" className="btn sm" onClick={() => {
            try { onChange(JSON.parse(rawTxt)); setRaw(false); } catch { alert("Neplatný JSON"); }
          }}>Použít JSON</button>
        </div>
      ) : (
        <>
          <div className="fx-fields">
            {pole.filter((p) => p !== "moznosti" && !seen.has(p) && seen.add(p)).map((p) => (
              <label key={p} className="fx-f"><span>{FIELD_LABELS[p] || p}</span>
                <Field name={p} ef={ef} set={set} /></label>
            ))}
          </div>
          {ef.volba && (
            <div className="fx-moz">
              <div className="fx-moz-h">Možnosti volby „{ef.volba}“
                <button type="button" className="btn sm" onClick={() => {
                  const n = prompt("Název možnosti:");
                  if (n) set("moznosti", { ...moznosti, [n]: [] });
                }}>+ možnost</button>
              </div>
              {Object.entries(moznosti).map(([opt, list]: [string, any]) => (
                <div key={opt} className="fx-moz-opt">
                  <b>{opt}</b>
                  <button type="button" className="cs-edel" onClick={() => {
                    const m2 = { ...moznosti }; delete m2[opt]; set("moznosti", m2);
                  }}>✕</button>
                  <EffectEditor effects={Array.isArray(list) ? list : []}
                    onChange={(l2) => set("moznosti", { ...moznosti, [opt]: l2 })} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Sdílený editor efektů (vlastní rysy, ruční efekty, vlastní obsah). */
export default function EffectEditor({ effects, onChange }: {
  effects: any[]; onChange: (e: any[]) => void;
}) {
  const { data } = useEfektTypy();
  const meta = data?.typy || [];
  const arr = Array.isArray(effects) ? effects : [];
  const upd = (i: number, e: any) => { const n = [...arr]; n[i] = e; onChange(n); };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const n = [...arr];[n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  return (
    <div className="fx">
      {arr.map((ef, i) => (
        <EffectRow key={i} ef={ef} meta={meta}
          onChange={(e) => upd(i, e)} onDel={() => onChange(arr.filter((_, j) => j !== i))}
          onMove={(d) => move(i, d)} />
      ))}
      <button type="button" className="btn sm" onClick={() => onChange([...arr, { typ: "poznamka" }])}>
        + efekt
      </button>
      {!arr.length && <span className="text-[11px] text-[var(--ink-3)]">Žádné mechanické efekty.</span>}
    </div>
  );
}

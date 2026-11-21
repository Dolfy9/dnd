import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { post } from "../api";
import ContentPicker, { useObsah } from "./ContentPicker";
import { Modal, toast, confirmDialog } from "./ui";

const AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

/* Dialog „Postup na úroveň" — nová úroveň ve stávající nebo nové (multiclass) třídě. */
export default function LevelUpDialog({ data, onClose, onApply }: {
  data: any; onClose: () => void; onApply: (next: any) => void;
}) {
  const tridy: any[] = (data.tridy || []).filter((t: any) => t.trida);
  const [trida, setTrida] = useState(tridy[0]?.trida || "");
  const [novaTrida, setNovaTrida] = useState("");
  const clQ = useObsah("class");
  const klasy = (clQ.data?.items || clQ.data || []) as any[];
  const cil = novaTrida || trida;

  const [moz, setMoz] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [hp, setHp] = useState<"prumer" | "hod" | "rucne">("prumer");
  const [hpHod, setHpHod] = useState("");
  const [podtrida, setPodtrida] = useState("");
  const [asiRezim, setAsiRezim] = useState<"asi2" | "asi11" | "feat">("asi2");
  const [asi1, setAsi1] = useState("STR");
  const [asi2, setAsi2] = useState("STR");
  const [feat, setFeat] = useState("");
  const [volby, setVolby] = useState<Record<string, string>>({});
  const [kouzlaNova, setKouzlaNova] = useState<{ nazev: string; uroven?: number }[]>([]);
  const featQ = useObsah("feat", "");

  useEffect(() => {
    if (!cil) { setMoz(null); return; }
    let dead = false;
    setBusy(true);
    post<any>("/api/postava/postup-moznosti", { data, trida: cil })
      .then((r) => { if (!dead) { setMoz(r); setPodtrida(""); } })
      .catch((e) => { if (!dead) { setMoz(null); toast(e.message, "err"); } })
      .finally(() => !dead && setBusy(false));
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cil]);

  const featy = ((featQ.data?.items || featQ.data || []) as any[])
    .filter((f) => (f.data?.kategorie || "") !== "Origin");

  const potvrd = () => {
    if (!moz) return;
    const next = JSON.parse(JSON.stringify(data));
    next.tridy = (next.tridy || []).map((t: any) => ({ ...t }));
    let t = next.tridy.find((x: any) => x.trida === cil);
    if (!t) { t = { trida: cil, uroven: 0 }; next.tridy.push(t); }
    t.uroven = moz.nova_uroven;
    if (podtrida) t.podtrida = podtrida;
    const zaznam: any = { uroven: moz.uroven_postavy, trida: cil };
    if (hp === "prumer") zaznam.hp = moz.hp_prumer;
    else if (hp === "rucne" && hpHod) zaznam.hp = Number(hpHod);
    else if (hp === "hod" && hpHod) zaznam.hp = Number(hpHod);
    next.hp_metoda = hp === "prumer" ? "prumer" : "hody";
    if (moz.asi) {
      if (asiRezim === "feat" && feat) { zaznam.feat = feat; next.featy = [...(next.featy || []), feat]; }
      else if (asiRezim === "asi2") zaznam.asi = { [asi1]: 2 };
      else zaznam.asi = { [asi1]: 1, [asi2]: 1 };
    }
    const kv = kouzlaNova.map((k) => k.nazev).filter(Boolean);
    if (kv.length) {
      zaznam.kouzla = kv;
      next.kouzla = [...(next.kouzla || []),
        ...kouzlaNova.map((k) => ({ nazev: k.nazev, trida: cil, ...(k.uroven != null ? { uroven: k.uroven } : {}) }))];
    }
    const nv = Object.entries(volby).filter(([, v]) => v);
    if (nv.length) {
      zaznam.volby = Object.fromEntries(nv);
      next.volby = { ...(next.volby || {}), ...Object.fromEntries(nv) };
    }
    next.postup = [...(next.postup || []), zaznam];
    onApply(next);
    onClose();
  };

  const prerekvFail = moz?.prerekvizity && moz.prerekvizity.vyhovuje === false;

  return (
    <Modal title="Postup na úroveň" onClose={onClose} width={560}
      footer={<>
        <button className="btn" onClick={onClose}>Zrušit</button>
        <button className="btn btn-primary" disabled={!moz || busy || !!prerekvFail ||
          (moz?.vybirat_podtridu && !podtrida)} onClick={potvrd}>
          Potvrdit postup{cil ? ` → ${cil} ${moz?.nova_uroven ?? ""}` : ""}
        </button>
      </>}>
      <div className="lu">
        <label className="lu-f"><span>Třída</span>
          <select className="inp" value={novaTrida ? "__nova" : trida}
            onChange={(e) => {
              if (e.target.value === "__nova") { setTrida(""); }
              else { setTrida(e.target.value); setNovaTrida(""); }
            }}>
            {tridy.map((t) => <option key={t.trida} value={t.trida}>{t.trida} (nyní {t.uroven})</option>)}
            <option value="__nova">+ nová třída (multiclass)…</option>
          </select>
        </label>
        {(novaTrida !== "" || trida === "") && (
          <label className="lu-f"><span>Nová třída</span>
            <select className="inp" value={novaTrida} onChange={(e) => setNovaTrida(e.target.value)}>
              <option value="">— vyber —</option>
              {klasy.filter((k) => !tridy.find((t) => t.trida === k.name))
                .map((k) => <option key={k.key} value={k.name}>{k.name}{k.vlastni ? " (vlastní)" : ""}</option>)}
            </select>
          </label>
        )}
        {busy && <p className="text-[12px] text-[var(--ink-3)]">Počítám možnosti…</p>}
        {moz && (
          <div className="card-in">
            <p className="text-[13px]"><b>{cil} {moz.nova_uroven}</b> · celková úroveň {moz.uroven_postavy}
              {moz.je_nova_trida && " · nová třída (multiclass)"}</p>
            {moz.prerekvizity && (
              <p className={"text-[12px] " + (prerekvFail ? "text-[var(--warn,#b00)]" : "text-[var(--ink-3)]")}>
                Multiclass prerekvizity (13 v primárním atributu obou tříd):{" "}
                {prerekvFail ? "NESPLNĚNO" : "splněno"}
                {moz.prerekvizity.nova_trida?.atributy?.length
                  ? ` — ${cil}: ${moz.prerekvizity.nova_trida.atributy.join("/")}` : ""}
              </p>)}
            <label className="lu-f"><span>HP za úroveň (kostka k{moz.hit_die})</span>
              <span className="lu-row">
                <label><input type="radio" checked={hp === "prumer"} onChange={() => setHp("prumer")} /> průměr {moz.hp_prumer}</label>
                <label><input type="radio" checked={hp === "hod"} onChange={() => setHp("hod")} /> hod</label>
                <label><input type="radio" checked={hp === "rucne"} onChange={() => setHp("rucne")} /> ručně</label>
                {hp !== "prumer" && <input className="inp" style={{ width: 70 }} type="number" value={hpHod} onChange={(e) => setHpHod(e.target.value)} />}
              </span>
            </label>
            {!!moz.nove_rysy?.length && (
              <div><b className="text-[12px]">Nové rysy:</b>
                {moz.nove_rysy.map((r: any, i: number) => (
                  <details key={i} className="lu-rysa"><summary>{r.nazev}</summary>
                    <p className="text-[12px] whitespace-pre-line">{r.text}</p></details>
                ))}</div>)}
            {moz.vybirat_podtridu && (
              <label className="lu-f"><span>Subclass (povinné na této úrovni)</span>
                <select className="inp" value={podtrida} onChange={(e) => setPodtrida(e.target.value)}>
                  <option value="">— vyber —</option>
                  {moz.podtridy.map((p: any) => <option key={p.nazev} value={p.nazev}>{p.nazev}{p.vlastni ? " (vlastní)" : ""}</option>)}
                </select></label>)}
            {moz.asi && (
              <div className="lu-f"><span>Ability Score Improvement / feat</span>
                <span className="lu-row">
                  <label><input type="radio" checked={asiRezim === "asi2"} onChange={() => setAsiRezim("asi2")} /> +2</label>
                  <label><input type="radio" checked={asiRezim === "asi11"} onChange={() => setAsiRezim("asi11")} /> +1/+1</label>
                  <label><input type="radio" checked={asiRezim === "feat"} onChange={() => setAsiRezim("feat")} /> feat</label>
                </span>
                {asiRezim === "asi2" && (
                  <select className="inp" value={asi1} onChange={(e) => setAsi1(e.target.value)}>
                    {AB.map((a) => <option key={a} value={a}>{a}</option>)}</select>)}
                {asiRezim === "asi11" && (
                  <span className="lu-row">
                    <select className="inp" value={asi1} onChange={(e) => setAsi1(e.target.value)}>
                      {AB.map((a) => <option key={a} value={a}>{a}</option>)}</select>
                    <select className="inp" value={asi2} onChange={(e) => setAsi2(e.target.value)}>
                      {AB.filter((a) => a !== asi1).map((a) => <option key={a} value={a}>{a}</option>)}</select>
                  </span>)}
                {asiRezim === "feat" && (
                  <select className="inp" value={feat} onChange={(e) => setFeat(e.target.value)}>
                    <option value="">— feat —</option>
                    {featy.map((f) => <option key={f.key} value={f.name}>{f.name}{f.data?.kategorie ? ` (${f.data.kategorie})` : ""}{f.vlastni ? " · vlastní" : ""}</option>)}
                  </select>)}
                <small className="text-[11px] text-[var(--ink-3)]">Maximum atributu je 20 — engine hodnotu omezí.</small>
              </div>)}
            {!!moz.volby_pozadovane?.length && (
              <div className="lu-f"><span>Volby nových rysů</span>
                {moz.volby_pozadovane.map((v: any, i: number) => (
                  <label key={i} className="lu-row">{v.zdroj}: {v.volba}
                    <select className="inp" value={volby[`${v.zdroj}|${v.volba}`] || ""}
                      onChange={(e) => setVolby({ ...volby, [`${v.zdroj}|${v.volba}`]: e.target.value })}>
                      <option value="">—</option>
                      {v.moznosti.map((m: string) => <option key={m} value={m}>{m}</option>)}
                    </select></label>))}</div>)}
            {(moz.cantrips != null || moz.pripravena != null) && (
              <p className="text-[12px] text-[var(--ink-3)]">
                Cantrips: {moz.cantrips ?? "—"} · Prepared Spells: {moz.pripravena ?? "—"}
                {moz.pact_po ? ` · Pact: ${moz.pact_po.pocet}× ${moz.pact_po.uroven}. st.` : ""}</p>)}
            <div className="lu-f"><span>Nová kouzla (cantripy / připravená)</span>
              <span className="lu-row" style={{ flexWrap: "wrap" }}>
                {kouzlaNova.map((k, i) => (
                  <span key={i} className="chip">{k.nazev}
                    <button type="button" onClick={() => setKouzlaNova(kouzlaNova.filter((_, j) => j !== i))}>×</button></span>))}
                <ContentPicker kind="spell" value="" placeholder="+ kouzlo ze seznamu…"
                  filter={(it) => {
                    // seznam třídy + max. seslatelná úroveň (sloty po postupu / pakt)
                    const tr = String(it.data?.tridy || "");
                    if (tr && !tr.split(",").map((s) => s.trim()).includes(cil)) return false;
                    const slots = moz.sloty_po || [];
                    let maxL = 0;
                    slots.forEach((n: any, i: number) => { if (Number(n) > 0) maxL = i + 1; });
                    if (moz.pact_po?.uroven) maxL = Math.max(maxL, Number(moz.pact_po.uroven) || 0);
                    return Number(it.data?.uroven ?? 0) <= Math.max(maxL, 1);
                  }}
                  onChange={(name, it) => name && !kouzlaNova.find((k) => k.nazev === name)
                    && setKouzlaNova([...kouzlaNova, { nazev: name, uroven: it?.data?.uroven }])} />
              </span>
            </div>
            {!!Object.keys(moz.delty_tabulky || {}).length && (
              <p className="text-[11px] text-[var(--ink-3)]">
                {Object.entries(moz.delty_tabulky).map(([k, v]: [string, any]) => `${k}: ${v.pred ?? "—"} → ${v.po ?? "—"}`).join(" · ")}</p>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* Tlačítko „Vrátit poslední postup" — odstraní poslední záznam postupu a sníží úroveň. */
export function revertPostup(data: any): any | null {
  const postup = [...(data.postup || [])];
  const last = postup.pop();
  if (!last) return null;
  const next = JSON.parse(JSON.stringify(data));
  next.postup = postup;
  next.tridy = (next.tridy || []).map((t: any) =>
    t.trida === last.trida ? { ...t, uroven: Math.max(0, (Number(t.uroven) || 1) - 1) } : t)
    .filter((t: any) => t.uroven > 0);
  if (last.feat) next.featy = (next.featy || []).filter((f: string) => f !== last.feat);
  if (last.kouzla?.length) {
    const odebrat = new Set(last.kouzla.map((k: any) => (typeof k === "object" ? k.nazev : k)));
    next.kouzla = (next.kouzla || []).filter((k: any) =>
      !odebrat.has(typeof k === "object" ? k.nazev : k));
  }
  if (last.volby) {
    next.volby = { ...(next.volby || {}) };
    for (const k of Object.keys(last.volby)) delete next.volby[k];
  }
  return next;
}

export async function confirmRevert(data: any): Promise<boolean> {
  const last = (data.postup || [])[data.postup.length - 1];
  return confirmDialog({
    title: "Vrátit poslední postup",
    text: last ? `Odebere se úroveň ${last.uroven} (${last.trida}) včetně featu/kouzel/voleb z tohoto postupu.` : "Žádný postup k vrácení.",
    okLabel: "Vrátit", danger: true,
  });
}

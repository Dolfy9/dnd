import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../api";
import { PageHeader, toast } from "../components/ui";
import ContentPicker, { useObsah, type ObsahItem } from "../components/ContentPicker";

const AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const SKILLS = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History",
  "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception",
  "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"];
const STD_ARRAY = [15, 14, 13, 12, 10, 8];
const PB_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

const KROKY = ["Základ", "Druh", "Povolání", "Pozadí", "Atributy", "Dovednosti",
  "Featy a volby", "Kouzla", "Výbava", "Shrnutí"];

type Data = any;
const set = (d: Data, k: string, v: any) => { const n = { ...d }; if (v === undefined || v === "") delete n[k]; else n[k] = v; return n; };

export default function PostavaNova() {
  const nav = useNavigate();
  const [krok, setKrok] = useState(0);
  /* živý náhled: na úzkém displeji sbalený do <details> */
  const [wide, setWide] = useState(() => window.innerWidth > 1100);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1100px)");
    const f = () => setWide(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  const [d, setD] = useState<Data>({
    jmeno: "", titul: "", hrac: false, slozka: "04_Postavy",
    druh: "", druh_volby: "", pozadi: "",
    tridy: [{ trida: "", uroven: 1, podtrida: "" }],
    metoda: "standard", atributy_zaklad: {}, bonusy_pozadi: {},
    asi_pozadi_rezim: "2+1", asi_pozadi: {} as Record<string, number>,
    dovednosti: [] as string[], featy: [] as any[], volby: {} as Record<string, string>,
    kouzla: [] as any[], vybava: [] as any[],
  });
  const up = (k: string, v: any) => setD((p: Data) => set(p, k, v));
  const [roll, setRoll] = useState<number[][] | null>(null);
  const [nahled, setNahled] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const spQ = useObsah("species");
  const clQ = useObsah("class");
  const bgQ = useObsah("background");
  const ftQ = useObsah("feat");
  const items = (x: any): ObsahItem[] => (x?.items || x || []);

  const druhData = items(spQ.data).find((x) => x.name === d.druh)?.data;
  const tridaData = items(clQ.data).find((x) => x.name === d.tridy?.[0]?.trida)?.data;
  const pozadiData = items(bgQ.data).find((x) => x.name === d.pozadi)?.data;
  // rysy jsou v pravidlech objekt {název: {text}} – převod na seznam
  const rysyDruha = useMemo(() => {
    const r = druhData?.rysy;
    if (!r) return [];
    return Array.isArray(r) ? r : Object.entries(r).map(([nazev, v]: any) =>
      ({ nazev, ...(typeof v === "object" ? v : { text: v }) }));
  }, [druhData]);

  /* nevyřešené volby + živý náhled – z /api/postava/nahled (engine počítá) */
  const [pendingVolby, setPendingVolby] = useState<{ zdroj: string; volba: string; moznosti: string[] }[]>([]);
  const [nahledLive, setNahledLive] = useState<any>(null);
  const volbyDruha = pendingVolby.filter((v) => !d.volby[`${v.zdroj}|${v.volba}`]);

  /* point-buy náklady */
  const pbCost = AB.reduce((s, a) => s + (PB_COST[d.atributy_zaklad?.[a] ?? 8] ?? 0), 0);
  const pozadiAtributy: string[] = useMemo(() => {
    const a = pozadiData?.atributy;
    if (Array.isArray(a)) return a;
    if (typeof a === "string") return a.split(/[,\/]/).map((s: string) => s.trim()).filter(Boolean);
    return [];
  }, [pozadiData]);
  const pozadiSkilly: string[] = useMemo(() => {
    const s = pozadiData?.dovednosti;
    if (Array.isArray(s)) return s;
    if (typeof s === "string") return s.split(",").map((x: string) => x.trim()).filter(Boolean);
    return [];
  }, [pozadiData]);
  const asiValid = useMemo(() => {
    if (!pozadiAtributy.length) return true;
    const entries = Object.entries(d.asi_pozadi || {});
    const sum = entries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
    return entries.every(([a]) => pozadiAtributy.includes(a)) && sum === 3;
  }, [d.asi_pozadi, pozadiAtributy]);

  /* finální data postavy pro náhled / uložení */
  const finalData = useMemo(() => {
    const o: Data = { ...d };
    delete o.metoda; delete o.slozka; delete o.asi_pozadi_rezim; delete o.asi_pozadi;
    o.jmeno = d.jmeno;
    o.tridy = (d.tridy || []).filter((t: any) => t.trida).map((t: any) =>
      ({ trida: t.trida, uroven: Number(t.uroven) || 1, ...(t.podtrida ? { podtrida: t.podtrida } : {}) }));
    // pozadí ASI do bonusy_pozadi
    o.bonusy_pozadi = Object.fromEntries(
      Object.entries(d.asi_pozadi || {}).filter(([a]) => pozadiAtributy.includes(a)));
    if (!Object.keys(o.bonusy_pozadi).length) delete o.bonusy_pozadi;
    o.featy = (d.featy || []).map((f: any) => (typeof f === "object" ? f : { nazev: f }));
    o.kouzla = (d.kouzla || []).map((k: any) => (typeof k === "object" ? k : { nazev: k }));
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  /* živý náhled – debounce nad finálními daty (pravý panel mini-sheetu) */
  useEffect(() => {
    let dead = false;
    const t = setTimeout(async () => {
      try {
        const r = await post<any>("/api/postava/nahled", { data: finalData });
        if (!dead) { setNahledLive(r); setPendingVolby(r.chybejici_volby || []); }
      } catch { /* chyba náhledu nebrání pokračovat */ }
    }, 400);
    return () => { dead = true; clearTimeout(t); };
  }, [finalData]);

  /* výběr dovedností třídy – z core textu pravidel ("Choose N: A, B, or C") */
  const skillVolba = useMemo(() => {
    const sv = tridaData?.dovednosti_volba;
    if (sv) return sv;
    const m = /Choose\s+(\d+)\s*:\s*(.+)/i.exec(String(tridaData?.core?.["Skill Proficiencies"] || ""));
    if (!m) return null;
    const z = m[2].replace(/\bor\b/g, "").split(",").map((s: string) => s.trim())
      .filter((s: string) => SKILLS.includes(s));
    return { pocet: Number(m[1]), z };
  }, [tridaData]);
  const kouzloList = (tridaData?.nazev || d.tridy?.[0]?.trida) ? true : false;
  const lvl1 = (tridaData?.tabulka || {})["1"] || {};
  const cantripCount = Number(lvl1.Cantrips) || 0;
  const prepCount = Number(lvl1["Prepared Spells"]) || 0;

  const krokValid = (k: number): boolean => {
    switch (k) {
      case 0: return !!String(d.jmeno || "").trim() && !!String(d.slozka || "").trim();
      case 1: return !!d.druh && volbyDruha.length === 0;
      case 2: return !!d.tridy?.[0]?.trida && (Number(d.tridy[0].uroven) || 0) >= 1;
      case 3: return !!d.pozadi ? asiValid : true;
      case 4: return AB.every((a) => Number(d.atributy_zaklad?.[a]) >= 3 && Number(d.atributy_zaklad?.[a]) <= 20)
        && (d.metoda !== "pointbuy" || pbCost <= 27);
      case 5: return !skillVolba || (d.dovednosti || []).length === (skillVolba.pocet || 0);
      default: return true;
    }
  };
  const next = () => setKrok((k) => Math.min(KROKY.length - 1, k + 1));
  const back = () => setKrok((k) => Math.max(0, k - 1));

  const hod4k3 = () => {
    const sady = AB.map(() => {
      const h = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
      return h;
    });
    setRoll(sady);
    const ab: any = {};
    AB.forEach((a, i) => { ab[a] = sady[i].slice(0, 3).reduce((s, x) => s + x, 0); });
    up("atributy_zaklad", ab);
  };

  const spocitej = async () => {
    setBusy(true);
    try { setNahled(await post("/api/postava/nahled", { data: finalData })); }
    catch (e) { toast(e instanceof Error ? e.message : "Náhled selhal", "err"); }
    setBusy(false);
  };

  const vytvor = async () => {
    if (!krokValid(0)) return;
    setBusy(true);
    try {
      const r = await post<{ ok: boolean; url: string }>("/api/entities", {
        type: "postava", dir: d.slozka, name: d.jmeno, data: finalData,
        template: "_Sablony/Sablona_Postava.md",
      });
      toast("Postava vytvořena.", "ok");
      nav(r.url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Vytvoření selhalo", "err");
      setBusy(false);
    }
  };

  const F = ({ l, children, hint }: { l: string; children: React.ReactNode; hint?: string }) => (
    <div className="wi-f"><span className="wi-l">{l}</span>{children}
      {hint && <small className="wi-hint">{hint}</small>}</div>);

  return (
    <div className="p-6 max-w-6xl mx-auto fade-in">
      <PageHeader icon="🧝" title="Nová postava" subtitle="Průvodce vytvořením postavy podle pravidel 2024." />
      <ol className="wi-steps">
        {KROKY.map((k, i) => (
          <li key={k} className={i === krok ? "on" : i < krok ? "done" : ""}
            onClick={() => i < krok && setKrok(i)}>{i + 1}. {k}</li>
        ))}
      </ol>

      <div className="wi-cols">
      <div className="card p-4">
        {krok === 0 && <>
          <F l="Jméno"><input className="inp" value={d.jmeno} onChange={(e) => up("jmeno", e.target.value)} /></F>
          <F l="Titul"><input className="inp" value={d.titul} onChange={(e) => up("titul", e.target.value)} /></F>
          <F l="Typ"><label className="cs-echeck"><input type="radio" checked={!d.hrac} onChange={() => up("hrac", false)} /> NPC</label>
            <label className="cs-echeck"><input type="radio" checked={!!d.hrac} onChange={() => up("hrac", true)} /> hráčská postava</label></F>
          <F l="Složka" hint="Kam se soubor uloží (pod 04_Postavy).">
            <input className="inp" value={d.slozka} onChange={(e) => up("slozka", e.target.value)} /></F>
        </>}

        {krok === 1 && <>
          <F l="Druh (Species)">
            <ContentPicker kind="species" value={d.druh} onChange={(name) => up("druh", name)} /></F>
          {druhData && (
            <div className="card-in mt-2">
              <p className="text-[12px] text-[var(--ink-3)]">Velikost {druhData.velikost || "Medium"} · Speed {druhData.rychlost || 30} ft{druhData.typ ? ` · ${druhData.typ}` : ""}</p>
              {rysyDruha.map((r: any, i: number) => (
                <details key={i} className="lu-rysa"><summary>{r.nazev}</summary>
                  <p className="text-[12px] whitespace-pre-line">{r.text}</p></details>
              ))}
            </div>)}
          {pendingVolby.map((v) => (
            <F key={`${v.zdroj}|${v.volba}`} l={`${v.zdroj}: ${v.volba}`}>
              <select className="inp" value={d.volby[`${v.zdroj}|${v.volba}`] || ""}
                onChange={(e) => up("volby", { ...d.volby, [`${v.zdroj}|${v.volba}`]: e.target.value })}>
                <option value="">— vyber —</option>
                {v.moznosti.map((m) => <option key={m} value={m}>{m}</option>)}
              </select></F>))}
          {druhData && [].concat(druhData.velikost || []).length > 1 && (
            <F l="Velikost"><select className="inp" value={d.velikost || ""}
              onChange={(e) => up("velikost", e.target.value)}>
              <option value="">—</option>{([] as any[]).concat(druhData.velikost || []).map((v: string) => <option key={v} value={v}>{v}</option>)}</select></F>)}
        </>}

        {krok === 2 && <>
          <F l="Povolání (Class)">
            <ContentPicker kind="class" value={d.tridy[0]?.trida || ""} placeholder="Vyber povolání…"
              onChange={(name) => up("tridy", [{ ...(d.tridy[0] || {}), trida: name }])} /></F>
          <F l="Úroveň" hint="Rychlé vytvoření: vyšší úroveň použije průměrné HP a rysy bez podrobného postupu.">
            <input className="inp" type="number" min={1} max={20} style={{ width: 80 }}
              value={d.tridy[0]?.uroven ?? 1}
              onChange={(e) => up("tridy", [{ ...(d.tridy[0] || {}), uroven: Number(e.target.value) || 1 }])} /></F>
          {(Number(d.tridy[0]?.uroven) || 1) >= (tridaData?.podtrida_uroven ?? 3) && (
            <F l="Subclass"><ContentPicker kind="subclass" value={d.tridy[0]?.podtrida || ""} placeholder="Vyber subclass…"
              filter={(it) => it.data?.trida === d.tridy[0]?.trida}
              onChange={(name) => up("tridy", [{ ...(d.tridy[0] || {}), podtrida: name }])} /></F>)}
          {tridaData && (
            <p className="text-[12px] text-[var(--ink-3)] mt-2">
              Hit Die k{tridaData.hit_die || "?"}
              {nahledLive && <> · záchrany {(nahledLive.save_prof || []).join(", ") || "—"}</>}
              {nahledLive?.train && <> · zbroj {nahledLive.train.armor || "—"} · zbraně {nahledLive.train.weapons || "—"}</>}
              {lvl1["Prepared Spells"] != null && ` · Prepared Spells ${lvl1["Prepared Spells"]}`}
              {lvl1.Cantrips != null && ` · Cantrips ${lvl1.Cantrips}`}
            </p>)}
        </>}

        {krok === 3 && <>
          <F l="Pozadí (Background)">
            <ContentPicker kind="background" value={d.pozadi} placeholder="Vyber pozadí…" onChange={(name) => up("pozadi", name)} /></F>
          {pozadiData && (
            <div className="card-in mt-2">
              <p className="text-[12px]">Atributy: {pozadiAtributy.join(", ") || "?"} · Origin feat: <b>{pozadiData.feat || "?"}</b></p>
              <p className="text-[12px]">Dovednosti: {(pozadiSkilly).join(", ")} · Nástroj: {pozadiData.nastroj || "?"}</p>
            </div>)}
          {!!pozadiAtributy.length && (
            <F l="Bonusy atributů z pozadí" hint="Rozděl celkem 3 body: +2/+1 nebo +1/+1/+1, jen mezi uvedené atributy.">
              <div className="flex flex-wrap gap-3">
                {pozadiAtributy.map((a) => (
                  <label key={a} className="cs-echeck">{a}
                    <select className="inp" value={d.asi_pozadi[a] ?? 0}
                      onChange={(e) => up("asi_pozadi", { ...d.asi_pozadi, [a]: Number(e.target.value) })}>
                      {[0, 1, 2, 3].map((n) => <option key={n} value={n}>+{n}</option>)}
                    </select></label>))}
              </div>
              {!asiValid && <small className="text-[var(--warn,#b00)]">Součet musí být přesně 3.</small>}
            </F>)}
        </>}

        {krok === 4 && <>
          <F l="Metoda atributů">
            <div className="flex flex-wrap gap-3">
              {[["standard", "Standard Array"], ["pointbuy", "Point Buy (27)"], ["roll", "4k6 drop lowest"], ["manual", "Ručně"]].map(([m, l]) => (
                <label key={m} className="cs-echeck">
                  <input type="radio" checked={d.metoda === m} onChange={() => up("metoda", m)} /> {l}</label>))}
            </div></F>
          {d.metoda === "standard" && (
            <F l="Přiřaď hodnoty" hint={`K dispozici: ${STD_ARRAY.join(", ")}`}>
              <div className="flex flex-wrap gap-2">
                {AB.map((a) => (
                  <label key={a} className="cs-echeck">{a}
                    <select className="inp" value={d.atributy_zaklad[a] ?? ""}
                      onChange={(e) => up("atributy_zaklad", { ...d.atributy_zaklad, [a]: Number(e.target.value) })}>
                      <option value="">—</option>
                      {STD_ARRAY.map((v) => <option key={v} value={v}
                        disabled={AB.some((b) => b !== a && d.atributy_zaklad[b] === v)}>{v}</option>)}
                    </select></label>))}
              </div></F>)}
          {d.metoda === "pointbuy" && (
            <F l="Point Buy" hint={`Bodů: ${pbCost}/27 — každý atribut 8–15.`}>
              <div className="flex flex-wrap gap-2">
                {AB.map((a) => (
                  <label key={a} className="cs-echeck">{a}
                    <select className="inp" value={d.atributy_zaklad[a] ?? 8}
                      onChange={(e) => up("atributy_zaklad", { ...d.atributy_zaklad, [a]: Number(e.target.value) })}>
                      {Object.keys(PB_COST).map((v) => <option key={v} value={v}>{v}</option>)}
                    </select></label>))}
                <b className={pbCost > 27 ? "text-[var(--warn,#b00)]" : ""}>{pbCost}/27</b>
              </div></F>)}
          {d.metoda === "roll" && (
            <F l="Hody 4k6 (nejnižší škrtni)">
              <button className="btn sm" onClick={hod4k3}>Hodit znovu</button>
              {roll && <div className="flex flex-wrap gap-2 mt-1">
                {AB.map((a, i) => <span key={a} className="chip">{a}: <b>{d.atributy_zaklad[a]}</b> <small>({roll[i].join(",")})</small></span>)}
              </div>}</F>)}
          {d.metoda === "manual" && (
            <F l="Atributy">
              <div className="flex flex-wrap gap-2">
                {AB.map((a) => (
                  <label key={a} className="cs-echeck">{a}
                    <input className="inp" type="number" style={{ width: 64 }} value={d.atributy_zaklad[a] ?? 10}
                      onChange={(e) => up("atributy_zaklad", { ...d.atributy_zaklad, [a]: Number(e.target.value) })} /></label>))}
              </div></F>)}
        </>}

        {krok === 5 && <>
          {skillVolba ? (
            <F l={`Dovednosti povolání — vyber ${skillVolba.pocet}`}
              hint="Nesmí se shodovat s dovednostmi z pozadí.">
              <div className="flex flex-wrap gap-2">
                {(skillVolba.z || SKILLS).map((s: string) => {
                  const dup = pozadiSkilly.includes(s);
                  const on = (d.dovednosti || []).includes(s);
                  return <button key={s} type="button" disabled={dup}
                    className={"chip cs-skill-pick" + (on ? " on" : "") + (dup ? " dup" : "")}
                    title={dup ? "Už z pozadí" : ""}
                    onClick={() => up("dovednosti", on ? d.dovednosti.filter((x: string) => x !== s) : [...d.dovednosti, s])}>
                    {s}</button>;
                })}
              </div>
              <small>Vybráno {(d.dovednosti || []).length}/{skillVolba.pocet}</small>
            </F>) : <p className="text-[13px] text-[var(--ink-3)]">Třída nemá výběr dovedností — přeskoč.</p>}
        </>}

        {krok === 6 && <>
          {pendingVolby.map((v) => (
            <F key={`${v.zdroj}|${v.volba}`} l={`${v.zdroj}: ${v.volba}`}>
              <select className="inp" value={d.volby[`${v.zdroj}|${v.volba}`] || ""}
                onChange={(e) => up("volby", { ...d.volby, [`${v.zdroj}|${v.volba}`]: e.target.value })}>
                <option value="">— vyber —</option>
                {v.moznosti.map((m) => <option key={m} value={m}>{m}</option>)}
              </select></F>))}
          <F l="Featy navíc" hint="Origin feat dává pozadí; zde přidej další (např. z rysů s volbou featu).">
            <div className="flex flex-wrap gap-2 items-center">
              {(d.featy || []).map((f: any, i: number) => (
                <span key={i} className="chip">{f.nazev || f}
                  <button type="button" onClick={() => up("featy", d.featy.filter((_: any, j: number) => j !== i))}>×</button></span>))}
              <ContentPicker kind="feat" value="" placeholder="+ přidat feat…"
                onChange={(name) => name && up("featy", [...d.featy, { nazev: name }])} />
            </div></F>
        </>}

        {krok === 7 && <>
          {kouzloList && (cantripCount || prepCount) ? (
            <>
              <p className="text-[12px] text-[var(--ink-3)] mb-2">
                {d.tridy[0].trida} 1: Cantrips {cantripCount}, Prepared Spells {prepCount}. Kouzla vybírej ze seznamu (oficiální + vlastní).</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {d.kouzla.map((k: any, i: number) => (
                  <span key={i} className="chip">{k.nazev || k}
                    <button type="button" onClick={() => up("kouzla", d.kouzla.filter((_: any, j: number) => j !== i))}>×</button></span>))}
              </div>
              <ContentPicker kind="spell" value="" placeholder="+ přidat kouzlo…"
                filter={(it) => {
                  const tr = String(it.data?.tridy || "");
                  if (tr && d.tridy[0]?.trida && !tr.split(",").map((s) => s.trim()).includes(d.tridy[0].trida)) return false;
                  const maxL = Math.max(1, ...[1,2,3,4,5,6,7,8,9].filter((l) => Number(lvl1[`${l}st`] ?? lvl1[`${l}nd`] ?? lvl1[`${l}rd`] ?? lvl1[`${l}th`]) > 0));
                  return Number(it.data?.uroven ?? 0) <= maxL;
                }}
                onChange={(name, it) => name && up("kouzla", [...d.kouzla, { nazev: name, uroven: it?.data?.uroven ?? it?.data?.level }])} />
            </>
          ) : <p className="text-[13px] text-[var(--ink-3)]">{tridaData ? "Tato třída na 1. úrovni nekouzlí." : "Vyber nejdřív povolání."}</p>}
        </>}

        {krok === 8 && <>
          {pozadiData?.vybava && <p className="text-[12px] text-[var(--ink-3)]">Výbava z pozadí: {pozadiData.vybava}</p>}
          <F l="Výbava" hint="Počáteční výbavu doplň ručně nebo z rejstříku předmětů.">
            <div className="flex flex-wrap gap-2 mb-2">
              {d.vybava.map((v: any, i: number) => (
                <span key={i} className="chip">{v.nazev || v}
                  <button type="button" onClick={() => up("vybava", d.vybava.filter((_: any, j: number) => j !== i))}>×</button></span>))}
            </div>
            <div className="flex gap-2">
              <ContentPicker kind="item" value="" placeholder="+ přidat předmět…"
                onChange={(name) => name && up("vybava", [...d.vybava, { nazev: name, pocet: 1 }])} />
              <input className="inp" style={{ maxWidth: 220 }} placeholder="…nebo volný text + Enter"
                onKeyDown={(e) => {
                  const t = (e.target as HTMLInputElement).value.trim();
                  if (e.key === "Enter" && t) { up("vybava", [...d.vybava, { nazev: t, pocet: 1 }]); (e.target as HTMLInputElement).value = ""; }
                }} />
            </div></F>
        </>}

        {krok === 9 && <>
          <div className="flex gap-2 mb-2">
            <button className="btn" onClick={spocitej} disabled={busy}>{busy ? "…" : "Spočítat náhled"}</button>
          </div>
          {nahled && (
            <div className="card-in text-[13px]">
              <p><b>{d.jmeno}</b> — {d.druh} {d.tridy[0]?.trida} {d.tridy[0]?.uroven}{d.pozadi ? ` · ${d.pozadi}` : ""}</p>
              <p>AC <b>{nahled.ac}</b> · HP <b>{nahled.hp}</b> · Init <b>{nahled.init >= 0 ? "+" : ""}{nahled.init}</b> · Speed {nahled.speed} ft · PB +{nahled.pb}</p>
              <p>Záchrany: {AB.map((a) => `${a} ${nahled.saves?.[a] >= 0 ? "+" : ""}${nahled.saves?.[a]}`).join(" · ")}</p>
              {!!nahled.chybejici_volby?.length && (
                <p className="text-[var(--warn,#b00)]">Nevyřešené volby: {nahled.chybejici_volby.map((v: any) => `${v.zdroj}: ${v.volba}`).join("; ")}</p>)}
            </div>)}
          <p className="text-[12px] text-[var(--ink-3)] mt-2">Soubor se vytvoří v <code>{d.slozka}</code> se stavem „návrh“.</p>
        </>}
      </div>

      {/* živý mini-sheet napravo – z /api/postava/nahled (na mobilu rozbalitelný) */}
      <details className="wi-prevbox" open={wide}>
        <summary className="wi-prevsum">Náhled postavy</summary>
      <aside className="wi-prev card p-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-2">Náhled postavy</h4>
        {nahledLive ? (
          <div className="wi-prev-body">
            <p className="wi-prev-name">{d.jmeno || "—"}</p>
            <p className="text-[11px] text-[var(--ink-3)] mb-2">
              {[d.druh, d.tridy?.[0]?.trida && `${d.tridy[0].trida} ${d.tridy[0].uroven}`, d.pozadi].filter(Boolean).join(" · ") || "—"}</p>
            <div className="wi-prev-vitals">
              <span><b>{nahledLive.ac ?? "—"}</b>AC</span>
              <span><b>{nahledLive.hp ?? "—"}</b>HP</span>
              <span><b>{(nahledLive.init ?? 0) >= 0 ? "+" : ""}{nahledLive.init ?? "—"}</b>Init</span>
              <span><b>{nahledLive.speed ?? "—"}</b>ft</span>
              <span><b>+{nahledLive.pb ?? "—"}</b>PB</span>
            </div>
            <div className="wi-prev-abs">
              {AB.map((a) => (
                <div key={a}>
                  <small>{a}{(nahledLive.save_prof || []).includes(a) ? " ●" : ""}</small>
                  <b>{nahledLive.atributy?.[a] ?? "—"}</b>
                  <span>{(nahledLive.mods?.[a] ?? 0) >= 0 ? "+" : ""}{nahledLive.mods?.[a] ?? "—"}</span>
                </div>))}
            </div>
            {(() => {
              const profs = Object.entries(nahledLive.skills || {}).filter(([, v]: any) => v?.prof || v?.exp).map(([k]) => k);
              return !!profs.length && (
                <p className="text-[11px] mt-1"><b className="text-[var(--ink-3)]">Dovednosti:</b> {profs.join(", ")}</p>);
            })()}
            {!!nahledLive.overview?.smysly?.length && (
              <p className="text-[11px]"><b className="text-[var(--ink-3)]">Smysly:</b> {nahledLive.overview.smysly.join(", ")}</p>)}
            {!!nahledLive.casting?.length && (
              <p className="text-[11px]"><b className="text-[var(--ink-3)]">Kouzlení:</b> {nahledLive.casting.map((x: any) => `${x.trida} DC ${x.dc}`).join(" · ")}</p>)}
            {!!pendingVolby.length && (
              <p className="text-[11px] mt-1" style={{ color: "#a05a10" }}>⚠ {pendingVolby.length} nevyřešených voleb</p>)}
          </div>
        ) : <p className="text-[12px] italic text-[var(--ink-3)]">Vyplň druh a povolání…</p>}
      </aside>
      </details>
      </div>

      <div className="wi-nav flex justify-between mt-3">
        <button className="btn" onClick={back} disabled={krok === 0}>← Zpět</button>
        {krok < KROKY.length - 1
          ? <button className="btn btn-primary" onClick={next} disabled={!krokValid(krok)}>Další →</button>
          : <button className="btn btn-primary" onClick={vytvor} disabled={busy || !krokValid(0)}>Vytvořit postavu</button>}
      </div>
    </div>
  );
}

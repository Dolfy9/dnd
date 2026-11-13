import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sword, Star, BookOpen, ScrollText, Package, User, Activity, Shield, History } from "lucide-react";
import { get, put, upload } from "../api";

const AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const AB_CZ: Record<string, string> = { STR: "Síla", DEX: "Obratnost", CON: "Odolnost", INT: "Inteligence", WIS: "Moudrost", CHA: "Charisma" };
const SKILLS: [string, string][] = [
  ["Acrobatics", "DEX"], ["Animal Handling", "WIS"], ["Arcana", "INT"], ["Athletics", "STR"],
  ["Deception", "CHA"], ["History", "INT"], ["Insight", "WIS"], ["Intimidation", "CHA"],
  ["Investigation", "INT"], ["Medicine", "WIS"], ["Nature", "INT"], ["Perception", "WIS"],
  ["Performance", "CHA"], ["Persuasion", "CHA"], ["Religion", "INT"], ["Sleight of Hand", "DEX"],
  ["Stealth", "DEX"], ["Survival", "WIS"]];
const CONDITIONS = ["Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Grappled",
  "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained",
  "Stunned", "Unconscious"];
const SR_RES: Record<string, string> = { "Focus Points": "all", "Second Wind": "1", "Channel Divinity": "1", "Wild Shape": "1", "Rages": "1" };

const sg = (n: number) => (n >= 0 ? "+" : "") + n;

type Tab = "boj" | "dovednosti" | "kouzla" | "rysy" | "vybava" | "pribeh" | "log";
const TABS: { id: Tab; label: string; icon: typeof Sword }[] = [
  { id: "boj", label: "Boj", icon: Sword },
  { id: "dovednosti", label: "Dovednosti", icon: Star },
  { id: "kouzla", label: "Kouzla", icon: BookOpen },
  { id: "rysy", label: "Rysy", icon: Activity },
  { id: "vybava", label: "Výbava", icon: Package },
  { id: "pribeh", label: "Příběh", icon: ScrollText },
  { id: "log", label: "Log", icon: History },
];

/* ---------- session stav (localStorage) ---------- */
type Session = {
  hp?: number; tmp?: number; hd?: number; exh?: number;
  ds?: number; df?: number; conds?: string[]; conc?: boolean; concSpell?: string;
  insp?: boolean; slots?: Record<string, number>; res?: Record<string, number>;
};
function loadSess(key: string): Session {
  try { return JSON.parse(localStorage.getItem(key + ":s2") || "{}") || {}; } catch { return {}; }
}
function saveSess(key: string, s: Session) {
  try { localStorage.setItem(key + ":s2", JSON.stringify(s)); } catch {}
}

function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"card-in" + (className ? " " + className : "")}>
      {title && <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3)] mb-1.5">{title}</h4>}
      {children}
    </div>
  );
}

function Det({ head, text }: { head: React.ReactNode; text?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cs-feat">
      <button type="button" className="cs-feat-head" onClick={() => setOpen(!open)}>
        <span className="cs-feat-name">{head}</span>
        <span className="cs-feat-src">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="cs-feat-text">{text || "Popis chybí."}</div>}
    </div>
  );
}

function Pips({ n, used, onUse }: { n: number; used: number; onUse: (u: number) => void }) {
  return (
    <span className="p2-pips">
      {Array.from({ length: n }, (_, i) => (
        <button key={i} type="button"
          className={"p2-pip" + (i < used ? " off" : "")}
          title="Klikni = použít/obnovit"
          onClick={() => onUse(i < used ? i : i + 1)} />
      ))}
    </span>
  );
}

export default function CharSheet({ sheet, ent, hpKey, editor, edit: editProp, onEditToggle }:
  { sheet: any; ent?: any; hpKey: string; editor?: boolean; edit?: boolean; onEditToggle?: (v: boolean) => void }) {
  const [tab, setTab] = useState<Tab | "all">("boj");
  const [delta, setDelta] = useState("");
  const [sess, setSess] = useState<Session>(() => loadSess(hpKey));
  const upd = (p: Partial<Session>) => setSess((s) => { const n = { ...s, ...p }; saveSess(hpKey, n); return n; });

  /* ---------- inline editace (auto-save) ---------- */
  const qc = useQueryClient();
  const [editInner, setEditInner] = useState(false);
  const edit = editProp ?? editInner;
  const setEdit = (v: boolean) => { if (onEditToggle) onEditToggle(v); else setEditInner(v); };
  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [nm, setNm] = useState("");
  const [saved, setSaved] = useState("");
  const tSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEdit = !!editor && !!ent?.id;
  const cur: Record<string, any> = draft || ent?.data || {};
  useEffect(() => {
    if (edit) { setDraft(JSON.parse(JSON.stringify(ent?.data || {}))); setNm(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);
  const getk = (path: string, fb: any = "") => {
    let o: any = cur;
    for (const k of path.split(".")) o = o?.[k];
    return o ?? fb;
  };
  const commit = (next: any, name?: string) => {
    setDraft(next);
    setSaved("ukládám…");
    if (tSave.current) clearTimeout(tSave.current);
    tSave.current = setTimeout(async () => {
      try {
        await put(`/api/entities/${ent.id}`, { data: next, name: name ?? (nm || ent.name) });
        setSaved("✓ uloženo");
        qc.invalidateQueries({ queryKey: ["page"] });
        setTimeout(() => setSaved(""), 1400);
      } catch { setSaved("✕ chyba"); }
    }, 600);
  };
  const setk = (path: string, v: any) => {
    const next = JSON.parse(JSON.stringify(cur));
    const ks = path.split(".");
    let o = next;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] ??= {};
    o[ks[ks.length - 1]] = v;
    commit(next);
  };
  const setName = (v: string) => {
    setNm(v);
    const next = JSON.parse(JSON.stringify(cur)); next.jmeno = v;
    commit(next, v);
  };
  const logQ = useQuery({
    queryKey: ["entity-log", ent?.id],
    queryFn: () => get<{ items: { ts: string; user: string; action: string; detail: string }[] }>(`/api/entities/${ent.id}/log`),
    enabled: canEdit && (tab === "log" || tab === "all"),
  });

  /* ---------- inline editační prvky ---------- */
  const Txt = ({ k, v, w, ph }: { k: string; v?: any; w?: string; ph?: string }) =>
    edit
      ? <input className="cs-e" style={w ? { width: w } : undefined} value={getk(k, v ?? "")} placeholder={ph || "—"} onChange={(e) => setk(k, e.target.value)} />
      : <>{v ?? getk(k) ?? "—"}</>;
  const Tags = ({ k, items }: { k: string; items?: any }) => {
    const arr: string[] = edit ? (getk(k) || []) : (items || []);
    if (!edit) return <>{arr.length ? arr.join(", ") : "—"}</>;
    return (
      <span className="cs-etags">
        {arr.map((x, i) => (
          <span key={i} className="cs-etag">{x}<button type="button" onClick={() => setk(k, arr.filter((_, j) => j !== i))}>×</button></span>
        ))}
        <input className="cs-e" placeholder="+ přidat" onKeyDown={(e) => {
          const t = (e.target as HTMLInputElement).value.trim();
          if (e.key === "Enter" && t) { setk(k, [...arr, t]); (e.target as HTMLInputElement).value = ""; }
        }} />
      </span>
    );
  };
  const Dicts = ({ k, keys }: { k: string; keys: [string, string][] }) => {
    const arr: any[] = getk(k) || [];
    return (
      <div className="cs-edicts">
        {arr.map((it, i) => (
          <div key={i} className="cs-edict">
            {keys.map(([key, ph]) => (
              <input key={key} className="cs-e" placeholder={ph} value={typeof it === "object" ? it?.[key] ?? "" : (key === "nazev" ? String(it) : "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const val = raw !== "" && !isNaN(Number(raw)) && raw.trim() === String(Number(raw)) ? Number(raw) : raw;
                  const n = [...arr]; n[i] = { ...(typeof n[i] === "object" ? n[i] : {}), [key]: val }; setk(k, n);
                }} />
            ))}
            <button type="button" className="cs-edel" onClick={() => setk(k, arr.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn sm" onClick={() => setk(k, [...arr, {}])}>+ přidat</button>
      </div>
    );
  };
  /* click-to-edit hodnota (pro nederivované staty) — funguje i mimo edit mód */
  const EdV = ({ k, v, fb, num = true, w = "46px", fbClick }: {
    k: string; v: React.ReactNode; fb?: any; num?: boolean; w?: string; fbClick?: () => void;
  }) => {
    const [on, setOn] = useState(false);
    const [val, setVal] = useState("");
    if (!canEdit) return <>{v}</>;
    if (!on) return (
      <span className="cs-edv" role="button" title="Klik = upravit hodnotu"
        onClick={() => { if (fbClick) return fbClick(); setVal(String(getk(k, "") || fb || "")); setOn(true); }}>
        {v}
      </span>);
    const done = (save: boolean) => {
      if (save) setk(k, num ? (val === "" ? null : Number(val)) : val);
      setOn(false);
    };
    return <input className="cs-e cs-edvi" style={{ width: w }} autoFocus value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); }} />;
  };

  /* portrét: šířka = výška × poměr stran obrázku (poměr vždy zachován) */
  const crestRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(2 / 3);
  const [crestW, setCrestW] = useState(150);
  useEffect(() => {
    const el = crestRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 40) setCrestW(Math.max(100, Math.min(320, Math.round(h * ratio))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);

  /* level up/down dialog — funguje i pro multiclass */
  const [lvlOpen, setLvlOpen] = useState(false);
  const adjLvl = (i: number, d: number) => {
    const arr = ((cur.tridy || []) as any[]).map((t, j) =>
      j === i ? { ...t, uroven: Math.max(1, Math.min(20, (Number(t.uroven) || 0) + d)) } : t);
    setk("tridy", arr);
  };

  /* upload portrétu */
  const fileRef = useRef<HTMLInputElement>(null);
  const [upl, setUpl] = useState(false);
  const onPic = async (f?: File | null) => {
    if (!f) return;
    setUpl(true);
    try {
      const r = await upload<{ path: string }>(`/api/media/upload?dir=${encodeURIComponent("04_Postavy/obrazky")}`, f, f.name);
      setk("portret", r.path);
      setSaved("✓ portrét nahrán");
    } catch { setSaved("✕ upload selhal"); }
    setUpl(false);
  };

  const Lines = ({ k }: { k: string }) => {
    const v = getk(k);
    const txt = Array.isArray(v) ? v.map((x: any) => typeof x === "object" ? Object.values(x).join(" ") : String(x)).join("\n") : (v || "");
    return <textarea className="cs-e cs-ea" value={txt} rows={Math.max(3, txt.split("\n").length + 1)}
      onChange={(e) => setk(k, e.target.value.split("\n"))} />;
  };
  const Area = ({ k }: { k: string }) =>
    <textarea className="cs-e cs-ea" value={getk(k)} rows={3} onChange={(e) => setk(k, e.target.value)} />;

  const exh = sess.exh ?? sheet.exhaustion ?? 0;
  const pen = -2 * exh;
  const hpNow = sess.hp ?? sheet.hp;
  const tmp = sess.tmp ?? 0;
  const hdLeft = sess.hd ?? sheet.lvl;
  const ds = sess.ds ?? 0, df = sess.df ?? 0;
  const conds = sess.conds ?? [];
  const conc = sess.conc ?? false;
  const insp = sess.insp ?? false;
  const usedSlots = sess.slots ?? {};
  const usedRes = sess.res ?? {};

  const ov = sheet.overview || {};
  const bj = sheet.bj || {};
  const casting = sheet.casting || [];
  const kouzla = sheet.kouzla || [];
  const features = sheet.features || [];
  const speciesRysy = sheet.species_rysy || [];
  const feats = sheet.feats_info || [];
  const osob = sheet.osobnost || {};
  const res = sheet.res || [];
  const cr = sheet.cr || {};
  const concSpells = sheet.concentration_spells || [];
  const portrait = ent?.portret ? "/repo/" + encodeURI(ent.portret) : "";
  const initials = (ent?.name || "?").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  // kouzla dle úrovně
  const spellByLvl = useMemo(() => {
    const g: Record<number, any[]> = {};
    kouzla.forEach((k: any) => {
      const l = k.uroven == null ? "?" : Number(k.uroven);
      if (l === "?" || Number.isNaN(l)) { (g[-1] = g[-1] || []).push(k); return; }
      (g[l] = g[l] || []).push(k);
    });
    return g;
  }, [kouzla]);

  const applyDelta = (sign: number) => {
    const dn = Number(delta) || 0;
    if (!dn) return;
    upd({ hp: Math.max(0, Math.min(sheet.hp, hpNow + sign * dn)) });
    setDelta("");
  };
  const shortRest = () => {
    const s: Session = { ...sess };
    // pact sloty + res se sr=all se obnoví
    const sl = { ...usedSlots }; delete sl["pact"];
    const rs = { ...usedRes };
    res.forEach((r: any) => { if (SR_RES[String(r.nazev).replace(/^.*?: /, "")] === "all") delete rs[r.nazev]; });
    upd({ slots: sl, res: rs });
  };
  const longRest = () =>
    upd({ hp: sheet.hp, tmp: 0, hd: sheet.lvl, ds: 0, df: 0, slots: {}, res: {}, conc: false, concSpell: "" });

  const availableConds = CONDITIONS.filter((x) => !conds.includes(x));
  const defenses = ([["Resistance", ov.odolnosti || []], ["Immunity", ov.imunity || []], ["Vulnerability", ov.zranitelnosti || []]] as [string, string[]][]).filter((x) => x[1].length);

  /* ---------- sekce tabů ---------- */
  const paneBoj = (
    <div className="cs-2col">
      <div>
        <Card title="Útoky">
          {edit ? (
            <Dicts k="utoky" keys={[["nazev", "Útok"], ["atribut", "At."], ["kostka", "Kostka"], ["typ", "Typ"], ["bonus", "+hit"], ["bonus_zraneni", "+dmg"], ["dosah", "Dosah"], ["mastery", "Mastery"], ["poznamka", "Pozn."]]} />
          ) : sheet.attacks?.length ? (
            <table className="cs-tab2">
              <thead><tr><th>Útok</th><th>Zásah</th><th>Zranění</th><th>Mastery / pozn.</th></tr></thead>
              <tbody>
                {sheet.attacks.map((u: any, i: number) => (
                  <tr key={i}>
                    <td><b>{u.nazev}</b>{u.dosah && <><br /><small>{u.dosah}</small></>}</td>
                    <td><span className="p2-pill">{sg(u.atk + pen - sheet.exhaust_penalty)}</span></td>
                    <td>{u.dmg && <span className="p2-pill p2-dmg">{u.dmg}</span>} <small>{u.typ}</small></td>
                    <td><small>{[u.mastery].filter(Boolean).join(" · ") || "—"}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-[var(--ink-3)] italic text-sm">—</p>}
        </Card>
        {(defenses.length || !!ov.smysly?.length || edit) && (
          <Card title="Obrany a smysly">
            {edit ? (
              <div className="cs-esec">
                <label>Resistance</label><Tags k="odolnosti" items={getk("odolnosti")} />
                <label>Immunity</label><Tags k="imunity" items={getk("imunity")} />
                <label>Vulnerability</label><Tags k="zranitelnosti" items={getk("zranitelnosti")} />
              </div>
            ) : (
              <dl className="cs-dl">
                {defenses.map(([t, l]) => <span key={t}><dt>{t}</dt><dd>{l.join(", ")}</dd></span>)}
                {!!ov.smysly?.length && <span><dt>Senses</dt><dd>{ov.smysly.join(", ")}</dd></span>}
              </dl>
            )}
          </Card>
        )}
        {!!res.length && (
          <Card title="Zdroje povolání">
            <ul className="cs-res">
              {res.map((r: any, i: number) => {
                const n = /^\d+$/.test(r.hodnota) ? Number(r.hodnota) : 0;
                return (
                  <li key={i}><span>{r.nazev}</span><b>{r.hodnota}</b>
                    {n > 0 && n <= 20 && <Pips n={n} used={usedRes[r.nazev] || 0}
                      onUse={(u) => upd({ res: { ...usedRes, [r.nazev]: u } })} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
      <div>
        <Card title="V tahu">
          {edit ? (
            <div className="cs-esec">
              <label>Akce</label><Dicts k="boj.akce" keys={[["nazev", "Název"], ["text", "Text"]]} />
              <label>Bonusové akce</label><Dicts k="boj.bonusove_akce" keys={[["nazev", "Název"], ["text", "Text"]]} />
              <label>Reakce</label><Dicts k="boj.reakce" keys={[["nazev", "Název"], ["text", "Text"]]} />
              <label>Legendární akce</label><Dicts k="boj.legendarni" keys={[["nazev", "Název"], ["text", "Text"]]} />
              <label>Taktika</label>
              <textarea className="cs-e cs-ea" value={getk("boj.taktika")} rows={2} onChange={(e) => setk("boj.taktika", e.target.value)} />
            </div>
          ) : !bj.akce?.length && !bj.bonusove_akce?.length && !bj.reakce?.length && !bj.legendarni?.length && !bj.taktika
            ? <p className="text-[var(--ink-3)] italic text-sm">Bez akcí – viz útoky a rysy.</p>
            : <>
              {!!bj.akce?.length && <ActList t="Akce" arr={bj.akce} />}
              {!!bj.bonusove_akce?.length && <ActList t="Bonusové akce" arr={bj.bonusove_akce} />}
              {!!bj.reakce?.length && <ActList t="Reakce" arr={bj.reakce} />}
              {!!bj.legendarni?.length && <ActList t="Legendární akce" arr={bj.legendarni} />}
              {!!bj.taktika && <p className="cs-tactic">{bj.taktika}</p>}
            </>}
        </Card>
      </div>
    </div>
  );

  const paneDovednosti = (
    <div className="cs-2col">
      <Card title="Dovednosti">
        <ul className="cs-skills2">
          {SKILLS.map(([s, ab]) => {
            const k = sheet.skills?.[s]; if (!k) return null;
            return (
              <li key={s} className={k.exp ? "e" : k.prof ? "p" : ""}>
                <i /> <span>{s} <small>{ab}</small></span>
                <b>{sg(k.val + pen - sheet.exhaust_penalty)}</b>
              </li>
            );
          })}
        </ul>
        {edit && (
          <div className="cs-esec">
            <label>Proficiency (názvy skills)</label><Tags k="dovednosti" items={getk("dovednosti")} />
            <label>Expertise</label><Tags k="expertiza" items={getk("expertiza")} />
            <label>Záchrany navíc</label><Tags k="zachrany_navic" items={getk("zachrany_navic")} />
            <label>Původ atributů</label><input className="cs-e" value={getk("puvod_atributu")} onChange={(e) => setk("puvod_atributu", e.target.value)} />
          </div>
        )}
      </Card>
      <div>
        <Card title="Výcvik a zdatnosti">
          <dl className="cs-dl">
            <dt>Zbroj</dt><dd>{sheet.train?.armor || "—"}</dd>
            <dt>Zbraně</dt><dd>{sheet.train?.weapons || "—"}</dd>
            {!!sheet.mastery?.length && <><dt>Weapon Mastery</dt><dd>{sheet.mastery.join(", ")}</dd></>}
            <dt>Nástroje</dt><dd>{(ov.nastroje || []).join(", ") || "—"}</dd>
            <dt>Jazyky</dt><dd>{(ov.jazyky || []).join(", ") || "—"}</dd>
            <dt>Smysly</dt><dd>{(ov.smysly || []).join(", ") || "—"}</dd>
            {sheet.zbroj_info?.nazev && <><dt>Zbroj na sobě</dt><dd>{sheet.zbroj_info.nazev}{sheet.zbroj_info.stit ? " + Shield" : ""}</dd></>}
          </dl>
          {edit && (
            <div className="cs-esec">
              <label>Weapon Mastery</label><Tags k="mastery" items={getk("mastery")} />
              <label>Nástroje</label><Tags k="nastroje" items={getk("nastroje")} />
              <label>Jazyky</label><Tags k="jazyky" items={getk("jazyky")} />
              <label>Smysly</label><Tags k="smysly" items={getk("smysly")} />
              <label>Zbroj na sobě</label>
              <div className="cs-erow">
                <input className="cs-e" placeholder="Název" value={getk("zbroj.nazev")} onChange={(e) => setk("zbroj.nazev", e.target.value)} />
                <input className="cs-e" placeholder="Typ" value={getk("zbroj.typ")} onChange={(e) => setk("zbroj.typ", e.target.value)} />
                <input className="cs-e" placeholder="AC" value={getk("zbroj.zakladni_ac")} onChange={(e) => setk("zbroj.zakladni_ac", e.target.value === "" ? null : Number(e.target.value))} />
                <label className="cs-echeck"><input type="checkbox" checked={!!getk("zbroj.stit")} onChange={(e) => setk("zbroj.stit", e.target.checked)} /> štít</label>
                <input className="cs-e" placeholder="Bonus" value={getk("zbroj.bonus")} onChange={(e) => setk("zbroj.bonus", e.target.value)} />
              </div>
            </div>
          )}
        </Card>
        {sheet.pozadi_info && (
          <Card title={`Pozadí – ${ov.pozadi || ""}`}>
            <dl className="cs-dl">
              {sheet.pozadi_info.feat && <><dt>Origin feat</dt><dd>{sheet.pozadi_info.feat}</dd></>}
              {sheet.pozadi_info.dovednosti && <><dt>Dovednosti</dt><dd>{sheet.pozadi_info.dovednosti}</dd></>}
              {sheet.pozadi_info.nastroj && <><dt>Nástroj</dt><dd>{sheet.pozadi_info.nastroj}</dd></>}
            </dl>
          </Card>
        )}
      </div>
    </div>
  );

  const paneKouzla = (
    <div>
      {edit && (
        <Card title="Kouzla — ruční seznam">
          <Dicts k="kouzla" keys={[["nazev", "Kouzlo"], ["uroven", "Úr."], ["trida", "Třída"], ["poznamka", "Pozn."]]} />
        </Card>
      )}
      {casting.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {casting.map((x: any, i: number) => (
            <div key={i} className="cs-castbox">
              <div className="text-[10px] uppercase tracking-wide text-[var(--ink-3)]">{x.trida} · ability {x.ab}</div>
              <div className="text-[13px]"><b>Spell save DC {x.dc}</b> · attack {sg(x.atk + pen - sheet.exhaust_penalty)}</div>
            </div>
          ))}
        </div>
      )}
      {kouzla.length ? (
        <div className="cs-spellgrid">
          {Array.from({ length: 10 }, (_, l) => {
            const list = spellByLvl[l];
            const slots = l > 0 ? (sheet.slots?.[l - 1] || 0) : 0;
            const pactN = sheet.pact && l === sheet.pact.uroven ? Number(sheet.pact.pocet) || 0 : 0;
            if (!list?.length && !slots && !pactN) return null;
            return (
              <div key={l} className="card-in">
                <div className="cs-slh">
                  <span>{l ? `${l}. úroveň` : "Cantripy"}</span>
                  {!!slots && <Pips n={slots} used={usedSlots["s" + l] || 0}
                    onUse={(u) => upd({ slots: { ...usedSlots, ["s" + l]: u } })} />}
                  {!!pactN && <em className="cs-pact" title="Pact Magic (obnova po Short i Long Rest)">
                    pakt <Pips n={pactN} used={usedSlots.pact || 0}
                      onUse={(u) => upd({ slots: { ...usedSlots, pact: u } })} />
                  </em>}
                </div>
                <ul className="cs-spells">
                  {(list || []).map((k: any, i: number) => {
                    const markers = (/ritual/i.test(k.cas || "") ? " · R" : "") + (/concentration/i.test(k.trvani || "") ? " · C" : "");
                    const timing = [k.cas, k.dosah].filter(Boolean).join(" · ");
                    return (
                      <li key={i}>
                        <Det head={<>
                          <span className={k.text ? "" : "text-[var(--warn,#c00)]"}>{k.nazev}</span>
                          <small className="cs-feat-src"> {k.skola || "mimo seznam 2024?"}</small>
                        </>}
                          text={[timing + markers, k.trvani && `Trvání: ${k.trvani}`, k.slozky && `Složky: ${k.slozky}`]
                            .filter(Boolean).join("\n") + (k.text ? `\n\n${k.text}` : "") + (k.poznamka ? `\n\n— ${k.poznamka}` : "")} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {!!spellByLvl[-1]?.length && (
            <div className="card-in"><div className="cs-slh"><span>Neznámá úroveň</span></div>
              <ul className="cs-spells">{spellByLvl[-1].map((k: any, i: number) => <li key={i}>{k.nazev}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[var(--ink-3)] italic text-sm">
          Postava nemá rys Spellcasting. Kouzla jí může přidat PJ v režimu úprav.
        </p>
      )}
    </div>
  );

  const paneRysy = (
    <div className="cs-2col">
      <div>
        {!!features.length && (
          <Card title="Rysy povolání">
            {features.map((f: any, i: number) => (
              <Det key={i} head={<>{f.nazev} <small className="cs-feat-src">{f.zdroj} {f.uroven}</small></>} text={f.text} />
            ))}
          </Card>
        )}
        {(!!feats.length || edit) && (
          <Card title="Featy">
            {edit ? <Dicts k="featy" keys={[["nazev", "Feat"], ["zdroj", "Zdroj"]]} />
              : feats.map((f: any, i: number) => (
                <Det key={i} head={<>{f.nazev} <small className="cs-feat-src">{f.zdroj}{f.poznamka ? ` · ${f.poznamka}` : ""}</small></>} text={f.text} />
              ))}
          </Card>
        )}
      </div>
      <div>
        {!!speciesRysy.length && (
          <Card title={`Rysy druhu – ${ov.druh || ""}`}>
            {speciesRysy.map((r: any, i: number) => <Det key={i} head={r.nazev} text={r.text} />)}
            {ov.druh_volby && <p className="text-[11px] text-[var(--ink-3)] mt-1">Volba: {ov.druh_volby}</p>}
          </Card>
        )}
        {(!!sheet.vlastni_rysy?.length || edit) && (
          <Card title="Zvláštní a božské rysy">
            {edit ? <Dicts k="vlastni_rysy" keys={[["nazev", "Název"], ["text", "Text"]]} />
              : sheet.vlastni_rysy.map((f: any, i: number) => <Det key={i} head={f.nazev || String(f)} text={f.text} />)}
          </Card>
        )}
      </div>
    </div>
  );

  const attunement = sheet.naladeni || [];
  const paneVybava = (
    <div className="cs-2col">
      <div>
        <Card title="Výbava">
          {edit ? <Lines k="vybava" />
            : sheet.vybava ? (Array.isArray(sheet.vybava)
              ? <ul className="cs-gear">{sheet.vybava.map((v: any, i: number) => <li key={i}>{typeof v === "object" ? Object.values(v).join(" ") : String(v)}</li>)}</ul>
              : <p className="text-[13px] whitespace-pre-line">{String(sheet.vybava)}</p>) : "—"}
        </Card>
        <Card title="Attunement">
          {edit ? <Tags k="naladeni" items={attunement} /> : (
            <>
              <ol className="cs-attune">
                {[0, 1, 2].map((i) => <li key={i} className={attunement[i] ? "filled" : ""}>{attunement[i] || "Empty"}</li>)}
              </ol>
              {attunement.length > 3 && <p className="cs-warn2">More than 3 items are attuned; the limit is three.</p>}
            </>
          )}
        </Card>
      </div>
      <div>
        {((sheet.penize && !!Object.keys(sheet.penize).length) || edit) && (
          <Card title="Peníze">
            {edit ? (
              <div className="cs-erow">
                {["PP", "GP", "SP", "CP"].map((m) => (
                  <label key={m} className="cs-echeck">{m}
                    <input type="number" className="cs-e" style={{ width: 60 }} value={getk(`penize.${m}`)} onChange={(e) => setk(`penize.${m}`, e.target.value === "" ? null : Number(e.target.value))} />
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(sheet.penize).map(([k, v]: any) => <span key={k} className="chip"><b>{v}</b> {k}</span>)}
              </div>
            )}
          </Card>
        )}
        {sheet.zbroj_info && (
          <Card title="Zbroj">
            <p className="text-[13px]">{[sheet.zbroj_info.nazev || sheet.zbroj_info.typ, sheet.zbroj_info.stit ? "+ Shield" : "", sheet.zbroj_info.bonus ? `bonus ${sheet.zbroj_info.bonus}` : ""].filter(Boolean).join(" · ")}</p>
          </Card>
        )}
      </div>
    </div>
  );

  const panePribeh = (
    <div className="cs-2col">
      <div>
        <Card title="Osobnost">
          {edit ? (
            <div className="cs-esec">
              {[["osobnost.rysy", "Rysy"], ["osobnost.idealy", "Ideály"], ["osobnost.pouta", "Pouta"], ["osobnost.vady", "Vady"]].map(([k, l]) => (
                <span key={k}><label>{l}</label><textarea className="cs-e cs-ea" rows={2} value={getk(k)} onChange={(e) => setk(k, e.target.value)} /></span>
              ))}
            </div>
          ) : (
            <dl className="cs-dl">
              <dt>Rysy</dt><dd>{osob.rysy || "—"}</dd>
              <dt>Ideály</dt><dd>{osob.idealy || "—"}</dd>
              <dt>Pouta</dt><dd>{osob.pouta || "—"}</dd>
              <dt>Vady</dt><dd>{osob.vady || "—"}</dd>
            </dl>
          )}
        </Card>
        {(sheet.vzhled || edit) && (
          <Card title="Vzhled">
            {edit ? <Area k="vzhled" /> : <p className="text-[13px] whitespace-pre-line">{sheet.vzhled}</p>}
          </Card>
        )}
        {edit && (
          <Card title="Vazby a štítky">
            <div className="cs-esec">
              <label>Město</label><input className="cs-e" value={getk("mesto")} onChange={(e) => setk("mesto", e.target.value)} />
              <label>Země</label><input className="cs-e" value={getk("zeme")} onChange={(e) => setk("zeme", e.target.value)} />
              <label>Frakce</label><Tags k="frakce" items={getk("frakce")} />
              <label>Zvířata</label><Tags k="zvirata" items={getk("zvirata")} />
              <label>Kampaně</label><Tags k="kampane" items={getk("kampane")} />
              <label>Štítky</label><Tags k="stitky" items={getk("stitky")} />
            </div>
          </Card>
        )}
      </div>
      <div>
        {(sheet.prevod_2024 || edit) && (
          <Card title="Převod na 2024">
            {edit ? <Area k="prevod_2024" /> : <p className="text-[12px] whitespace-pre-line">{sheet.prevod_2024}</p>}
          </Card>
        )}
        {(sheet.statblok || edit) && (
          <Card title="Statblok">
            {edit ? <input className="cs-e" value={getk("statblok")} onChange={(e) => setk("statblok", e.target.value)} /> : <p className="text-[12px]">{sheet.statblok}</p>}
          </Card>
        )}
      </div>
    </div>
  );

  const paneLog = (
    <Card title="Historie změn">
      {logQ.isLoading && <p className="text-[12px] text-[var(--ink-3)]">Načítám…</p>}
      {logQ.error && <p className="text-[12px] text-[var(--warn,#c00)]">Log se nepodařilo načíst.</p>}
      {!logQ.isLoading && !logQ.data?.items?.length && <p className="text-[12px] text-[var(--ink-3)] italic">Zatím žádné záznamy.</p>}
      <ul className="cs-log">
        {(logQ.data?.items || []).map((r, i) => (
          <li key={i}>
            <span className="cs-log-ts">{String(r.ts || "").slice(0, 16).replace("T", " ")}</span>
            <b className="cs-log-u">{r.user}</b>
            <span className="cs-log-d">{r.detail || r.action}</span>
          </li>
        ))}
      </ul>
    </Card>
  );

  const panes: [Tab, React.ReactNode][] = [
    ["boj", paneBoj], ["dovednosti", paneDovednosti], ["kouzla", paneKouzla],
    ["rysy", paneRysy], ["vybava", paneVybava], ["pribeh", panePribeh], ["log", paneLog]];

  const diceCompact = Object.entries(sheet.dice || {}).map(([k, n]) => `${n}×${k}`).join(" · ");

  return (
    <div className="cs">
      {/* ===== HERO — portrét + horizontální pásy ===== */}
      <div className="cs-hero">
        <div className="cs-crest" ref={crestRef} style={{ width: crestW }}>
          {portrait
            ? <img src={portrait} alt={ent?.name || ""}
                onLoad={(e) => { const im = e.target as HTMLImageElement; if (im.naturalWidth) setRatio(im.naturalWidth / im.naturalHeight); }} />
            : <span className="cs-crest-init">{initials}</span>}
          <div className="cs-lvl" title={canEdit ? "Úroveň — klik = level up/down" : "Celková úroveň"}
            onClick={() => canEdit && setLvlOpen(!lvlOpen)} role={canEdit ? "button" : undefined}>
            {sheet.lvl || "—"}
          </div>
          {lvlOpen && canEdit && (
            <div className="cs-lvlpop">
              <div className="cs-lvlpop-h"><b>Úrovně</b><button type="button" onClick={() => setLvlOpen(false)}>✕</button></div>
              {((cur.tridy || []) as any[]).map((t: any, i: number) => (
                <div key={i} className="cs-lvlrow">
                  <span>{t.trida}{t.podtrida ? ` · ${t.podtrida}` : ""}</span>
                  <button type="button" className="btn sm" onClick={() => adjLvl(i, -1)}>−</button>
                  <b>{t.uroven}</b>
                  <button type="button" className="btn sm" onClick={() => adjLvl(i, 1)}>+</button>
                </div>
              ))}
              {!(cur.tridy || []).length && <p className="text-[11px] text-[var(--ink-3)]">Postava nemá třídu — přidej ji v editaci.</p>}
            </div>
          )}
          {canEdit && (
            <button type="button" className="cs-picbtn" title="Změnit portrét — nahraje obrázek a uloží"
              onClick={() => fileRef.current?.click()}>{upl ? "…" : "📷"}</button>
          )}
          {edit && <input className="cs-e cs-portrait-e" placeholder="portrét (cesta)" value={getk("portret")} onChange={(e) => setk("portret", e.target.value)} title="Cesta k portrétu, např. 04_Postavy/obrazky/baldrok.webp" />}
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={(e) => { onPic(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div className="cs-hero-body">
          {/* pás 1: identita + CR/inspirace */}
          <div className="cs-hero-top">
            <div className="cs-hero-id">
              {edit
                ? <input className="cs-e cs-name-e" value={nm || ent?.name || ""} onChange={(e) => setName(e.target.value)} />
                : <h2 className="cs-name">{ent?.name || ""}</h2>}
              <div className="cs-hero-sub">
                {edit
                  ? <Txt k="titul" ph="Titul" />
                  : ov.titul && <span className="cs-title">{ov.titul}</span>}
                {edit ? (
                  <div className="cs-echips">
                    <Dicts k="tridy" keys={[["trida", "Třída"], ["uroven", "Úr."], ["podtrida", "Subclass"]]} />
                    <div className="cs-erow">
                      <input className="cs-e" placeholder="Druh" value={getk("druh")} onChange={(e) => setk("druh", e.target.value)} />
                      <input className="cs-e" placeholder="Volba druhu" value={getk("druh_volby")} onChange={(e) => setk("druh_volby", e.target.value)} />
                      <input className="cs-e" placeholder="Pozadí" value={getk("pozadi")} onChange={(e) => setk("pozadi", e.target.value)} />
                      <input className="cs-e" placeholder="Zarovnání" value={getk("zarovnani")} onChange={(e) => setk("zarovnani", e.target.value)} />
                      <input className="cs-e" placeholder="Velikost" value={getk("velikost")} onChange={(e) => setk("velikost", e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <span className="cs-chips">
                    {(ent?.data?.tridy || []).map((t: any, i: number) => (
                      <span key={i} className="p2-chip p2-class">{t.trida} {t.uroven}{t.podtrida ? ` · ${t.podtrida}` : ""}</span>
                    ))}
                    {!ent?.data?.tridy?.length && <span className="p2-chip p2-class">{sheet.statblok || "Bez povolání"}</span>}
                    <span className="p2-chip">{ov.druh || "—"}{ov.druh_volby ? ` (${ov.druh_volby})` : ""}</span>
                    <span className="p2-chip">{ov.pozadi || "—"}</span>
                    <span className="p2-chip">{ov.zarovnani || "—"}</span>
                    <span className="p2-chip">{ov.velikost || "Medium"}</span>
                  </span>
                )}
              </div>
              <div className="cs-overview">
                {sheet.xp != null && (
                  <span className="cs-xp">
                    XP <EdV k="xp" v={sheet.xp.toLocaleString("cs-CZ")} fb={sheet.xp} w="70px" />
                    {sheet.xp_next ? ` / ${sheet.xp_next.toLocaleString("cs-CZ")}` : " · L20"}
                  </span>
                )}
              </div>
            </div>
            {/* konec řádku: Init | Speed | Hit Dice | CR | Inspirace */}
            <div className="cs-hero-side">
              <div className="cs-side"><b>{sg(sheet.init + pen - sheet.exhaust_penalty)}</b><span>Init.</span></div>
              <div className="cs-side">
                <b><EdV k="rychlost_rucne" v={`${sheet.speed} ft`} fb={sheet.speed} w="56px" /></b><span>Rychlost</span>
              </div>
              <div className="cs-side" title={diceCompact}>
                <b><button className="btn sm" onClick={() => upd({ hd: Math.max(0, hdLeft - 1) })}>−</button>
                  {hdLeft}<button className="btn sm" onClick={() => upd({ hd: Math.min(sheet.lvl, hdLeft + 1) })}>+</button>
                </b><span>Hit Dice</span>
              </div>
              <div className="cs-cr" title={`obrana CR ${cr.def || "?"} · útok CR ${cr.off || "?"}`}>
                <strong><EdV k="boj.cr_rucne" v={cr.cr || "—"} fb={cr.cr} w="44px" /></strong><span>CR</span>
                {cr.xp != null && <small>{cr.xp} XP</small>}
                {!canEdit && bj.cr_rucne && <small>{bj.cr_rucne}</small>}
              </div>
              <button type="button" className={"p2-insp" + (insp ? " on" : "")} onClick={() => upd({ insp: !insp })}>
                <span>{insp ? "★" : "☆"}</span> Insp.
              </button>
            </div>
          </div>
          {/* pás 2: atributy — 6 boxů vedle sebe */}
          <div className="cs-abil-row">
            {AB.map((a) => (
              <div key={a} className="cs-ab2" title={a}>
                <b className="cs-ab2-mod">{sg(sheet.check_mods[a] + pen - sheet.exhaust_penalty)}</b>
                <span className="cs-ab2-i">
                  <b className="cs-ab2-name">{AB_CZ[a]}</b>
                  <span className="cs-ab2-sv" title={`Záchrana ${a}`}>
                    <b className="cs-ab2-score"><EdV k={`atributy.${a}`} v={sheet.atributy?.[a] ?? 10} fb={sheet.atributy?.[a]} w="42px" /></b>
                    <span className={sheet.save_prof?.includes(a) ? " p" : ""}>sv {sg(sheet.saves[a] + pen - sheet.exhaust_penalty)}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
          {/* pás 3: AC + HP — Death Saves místo baru při 0 HP */}
          <div className="cs-vitals">
            <div className="cs-shield">
              <b><EdV k="ac_rucne" v={sheet.ac} fb={sheet.ac} w="44px" /></b>
              <span>AC</span>
            </div>
            <div className="cs-hp">
              <div className="cs-hp-row">
                <span className="cs-l">HP</span>
                <button className="btn sm" onClick={() => upd({ hp: Math.max(0, hpNow - 1) })}>−</button>
                <input type="number" value={hpNow} onChange={(e) => upd({ hp: Number(e.target.value) || 0 })} />
                <span>/ <EdV k="hp_rucne" v={sheet.hp} fb={sheet.hp} w="44px" /></span>
                <button className="btn sm" onClick={() => upd({ hp: Math.min(sheet.hp, hpNow + 1) })}>+</button>
                <label className="cs-hp-l" title="Temporary Hit Points — zasáhnou se dřív než HP">Tmp <input type="number" value={tmp || ""} onChange={(e) => upd({ tmp: Number(e.target.value) || 0 })} /></label>
                <label className="cs-hp-l" title="Rychlé zranění/léčení: zadej číslo — Enter = zranění, Shift+Enter = léčení">± <input type="number" placeholder="dmg" value={delta} onChange={(e) => setDelta(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyDelta(e.shiftKey ? 1 : -1); }} /></label>
                <button className="btn sm" title="Plné HP" onClick={() => upd({ hp: sheet.hp })}>↺</button>
              </div>
              {hpNow <= 0 ? (
                <div className="cs-ds-line">
                  <span className="cs-l">Death Saves</span>
                  <div className="cs-ds">
                    <span title="Úspěchy">✓</span>{[1, 2, 3].map((i) => <button key={"s" + i} className={"p2-pip" + (i <= ds ? " on" : "")} onClick={() => upd({ ds: i === ds ? i - 1 : i })} />)}
                    <span title="Neúspěchy">✕</span>{[1, 2, 3].map((i) => <button key={"f" + i} className={"p2-pip fail" + (i <= df ? " on" : "")} onClick={() => upd({ df: i === df ? i - 1 : i })} />)}
                  </div>
                </div>
              ) : (
                <div className="cs-hpbar"><i style={{ width: Math.max(0, Math.min(100, (hpNow / sheet.hp) * 100)) + "%" }} /></div>
              )}
            </div>
            {/* trackery ve stejné řadě jako HP */}
            <div className="cs-tr">
              <b>Exhaustion</b>
              <div className="flex items-center gap-1">
                <button className="btn sm" onClick={() => upd({ exh: Math.max(0, exh - 1) })}>−</button>
                <strong className="w-4 text-center">{exh}</strong>
                <button className="btn sm" onClick={() => upd({ exh: Math.min(6, exh + 1) })}>+</button>
              </div>
            </div>
            <div className="cs-tr">
              <b>Concentration</b>
              <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={conc} onChange={(e) => upd({ conc: e.target.checked, concSpell: e.target.checked ? sess.concSpell : "" })} /> Aktivní</label>
              <input className="inp !py-0.5 !text-[11px] mt-1" list={`conc-${hpKey}`}
                placeholder="— kouzlo / schopnost —" value={sess.concSpell || ""}
                onChange={(e) => upd({ concSpell: e.target.value, conc: e.target.value ? true : conc })} />
              <datalist id={`conc-${hpKey}`}>
                {concSpells.map((s: string) => <option key={s} value={s} />)}
                {(sheet.features || []).map((f: any) => <option key={"f" + f.nazev} value={f.nazev} />)}
              </datalist>
            </div>
            <div className="cs-tr cs-conds">
              <b>Conditions</b>
              <div className="flex flex-wrap gap-1 items-center">
                {conds.length ? conds.map((cn) => (
                  <span key={cn} className="cs-cond">
                    <button type="button" onClick={() => upd({ conds: conds.filter((x) => x !== cn) })} title="Odebrat">{cn} ×</button>
                  </span>
                )) : <span className="text-[11px] text-[var(--ink-3)]">Žádné</span>}
                {!!availableConds.length && (
                  <select className="inp !py-0.5 !text-[11px] w-auto" value="" onChange={(e) => e.target.value && upd({ conds: [...conds, e.target.value] })}>
                    <option value="">+ Stav</option>
                    {availableConds.map((cn) => <option key={cn} value={cn}>{cn}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="cs-tr cs-rest">
              <button className="btn sm" onClick={shortRest} title="Short Rest: obnovit Pact Magic a krátké zdroje">☀ Short</button>
              <button className="btn sm btn-primary" onClick={longRest} title="Long Rest: plné HP, sloty, zdroje, Hit Dice">☾ Long</button>
            </div>
          </div>
        </div>
      </div>
      {exh > 0 && <div className="cs-warn">Exhaustion {exh} · {pen} na D20 hody · −{exh * 5} ft Speed{exh === 6 ? " · Smrt" : ""}</div>}

      {/* ===== TABS na celou šířku ===== */}
      <div className="cs-main">
          {!!casting.length && (
            <div className="flex flex-wrap gap-2 mb-2">
              {casting.map((x: any, i: number) => (
                <div key={i} className="cs-castbox">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--ink-3)]">{x.trida} · ability {x.ab}</div>
                  <div className="text-[13px]"><b>Spell save DC {x.dc}</b> · attack {sg(x.atk + pen - sheet.exhaust_penalty)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="cs-tabbar">
            <div className="cs-tabs">
              {TABS.filter((t) => t.id !== "log" || canEdit).map((t) => (
                <button key={t.id} className={"cs-tab" + (tab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>
                  <t.icon size={13} /> {t.label}
                  {t.id === "kouzla" && kouzla.length > 0 && <span className="cs-tab-n">{kouzla.length}</span>}
                  {t.id === "rysy" && (features.length + speciesRysy.length + feats.length) > 0 &&
                    <span className="cs-tab-n">{features.length + speciesRysy.length + feats.length}</span>}
                </button>
              ))}
              <button className={"cs-tab" + (tab === "all" ? " on" : "")} onClick={() => setTab("all")} title="Zobrazit vše (i pro tisk)">☰ Vše</button>
            </div>
            {/* PB | PP | DPR napravo od záložek */}
            <div className="cs-tab-stats">
              <div className="cs-stat"><b>{sg(sheet.pb)}</b><span>PB</span></div>
              <div className="cs-stat"><b title="Passive Perception">{sheet.passive}</b><span>Pas. Perc.</span></div>
              <div className="cs-stat" title={sheet.dpr_popis ? `Odhad: ${sheet.dpr_popis}` : ""}>
                <b><EdV k="boj.dpr" v={bj.dpr ? bj.dpr : `~${sheet.dpr_auto || "—"}`} w="48px" /></b><span>DPR</span>
              </div>
              {canEdit && (
                <button type="button"
                  className={"cs-tab cs-editbtn" + (edit ? " on" : "")}
                  title={edit ? "Vypnout inline úpravy" : "Zapnout inline úpravy — klik a piš, ukládá se samo"}
                  onClick={() => setEdit(!edit)}>
                  ✎ {edit ? "Hotovo" : "Upravit"}
                </button>
              )}
              {edit && saved && <span className="cs-saved">{saved}</span>}
            </div>
          </div>
          {tab === "all"
            ? panes.filter(([id]) => id !== "log" || canEdit).map(([id, p]) => <section key={id} className="cs-pane"><h3 className="cs-pane-h">{TABS.find((t) => t.id === id)?.label}</h3>{p}</section>)
            : <section className="cs-pane">{panes.find(([id]) => id === tab)?.[1]}</section>}
      </div>
    </div>
  );
}

function ActList({ t, arr }: { t: string; arr: any[] }) {
  return (
    <div className="cs-act">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] mt-2 first:mt-0">{t}</div>
      {arr.map((a: any, i: number) => (
        <p key={i} className="text-[12.5px] my-0.5">
          {typeof a === "string" ? a : <><b>{a.nazev}.</b> {a.text}</>}
        </p>
      ))}
    </div>
  );
}

import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ScrollText, Users, BookOpen, Swords, FileText,
  ExternalLink, Trash2, Layers, Plus, LayoutGrid, X,
  ImagePlus, UserRound, Scroll, Book, Package, Link2,
} from "lucide-react";
import { get, del, post, put, upload } from "../api";
import { useApp, isEditor } from "../store";
import EntityForm from "../components/EntityForm";
import EntityPicker, { useEntityIndex } from "../components/EntityPicker";
import Markdown from "../components/Markdown";
import type { PageData, BattleSummary } from "../types";

type Tab = "prehled" | "popis" | "postavy" | "questy" | "sezeni" | "boje" | "materialy";

const TABS: { id: Tab; label: string; icon: typeof ScrollText }[] = [
  { id: "prehled", label: "Přehled", icon: LayoutGrid },
  { id: "popis", label: "Popis", icon: FileText },
  { id: "postavy", label: "Postavy", icon: Users },
  { id: "questy", label: "Questy", icon: ScrollText },
  { id: "sezeni", label: "Sezení", icon: BookOpen },
  { id: "boje", label: "Boje", icon: Swords },
  { id: "materialy", label: "Materiály", icon: Layers },
];

const BATTLE_STAV: Record<string, string> = {
  priprava: "příprava", aktivni: "probíhá", hotovo: "ukončen",
};

// typ → adresář, šablona, kampan-side pole (back-compat) a typ entity pro vazby_in
const LINKED: Partial<Record<Tab, {
  type: string; dir: string; field: string; label: string; tpl?: string;
}>> = {
  postavy: { type: "postava", dir: "04_Postavy", field: "postavy", label: "postavu", tpl: "_Sablony/Sablona_Postava.md" },
  questy: { type: "quest", dir: "08_Questy", field: "questy", label: "quest", tpl: "_Sablony/Sablona_Quest.md" },
  sezeni: { type: "sezeni", dir: "10_Sezeni", field: "sezeni", label: "sezení", tpl: "_Sablony/Sablona_Sezeni.md" },
  materialy: { type: "kniha", dir: "06_Knihy_a_Dokumenty", field: "materialy", label: "materiál" },
};

const strip = (p: string) => p.replace(/\.md$/, "");
const pageLink = (p: string) => "/p/" + strip(p);
const human = (p: string) => strip(p).split("/").pop()!.replace(/_/g, " ");
const stemOf = (p: string) => strip(p).split("/").pop()!;

const TYPE_ICON: Record<string, typeof ScrollText> = {
  postavy: UserRound, questy: Scroll, sezeni: Book, materialy: Package, boje: Swords,
};
// placeholder obrázky podle typu položky (v repo, servírované přes /repo)
const PLACEHOLDER: Record<string, string> = {
  postavy: "/repo/_System/placeholders/placeholder_postava.webp",
  questy: "/repo/_System/placeholders/placeholder_quest.webp",
  sezeni: "/repo/_System/placeholders/placeholder_sezeni.webp",
  materialy: "/repo/_System/placeholders/placeholder_kniha.webp",
  boje: "/repo/_System/placeholders/placeholder_boj.webp",
};

interface RelItem { pred: string; name: string; path: string; type: string; url: string }

/** Kartička entity – 2:3 portrét/placeholder + jméno v pruhu. */
function EntCard({ path, label, icon: Icon, img, ph, onRemove }:
  { path: string; label?: string; icon: typeof ScrollText; img?: string; ph: string; onRemove?: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const src = imgErr || !img ? PLACEHOLDER[ph] : img;
  return (
    <Link to={pageLink(path)} className="kampan-entcard group">
      <div className="kampan-entcard-img">
        <img src={src} alt="" loading="lazy"
          onError={(e) => { img ? setImgErr(true) : e.currentTarget.style.display = "none"; }} />
      </div>
      <div className="kampan-entcard-name">{label || human(path)}</div>
      {onRemove && (
        <button type="button" title="Odebrat z kampaně" className="kampan-entcard-del"
          onClick={(e) => { e.preventDefault(); onRemove(); }}>✕</button>
      )}
    </Link>
  );
}

export default function KampanDetail() {
  const params = useParams();
  const id = params["*"] || "";
  const { user } = useApp();
  const editor = isEditor(user);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("prehled");
  const [delConfirm, setDelConfirm] = useState(false);
  const [createTab, setCreateTab] = useState<Tab | null>(null);
  const [newName, setNewName] = useState("");
  const [pickPath, setPickPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const index = useEntityIndex();

  const entityQ = useQuery({
    queryKey: ["entity", id],
    queryFn: () => get<any>(/^\d+$/.test(id)
      ? `/api/entities/${id}`
      : `/api/entities/by-path?path=${encodeURIComponent(id)}`),
  });
  const e = entityQ.data;
  const pageQ = useQuery({
    queryKey: ["page", e?.path],
    queryFn: () => get<PageData>(`/api/page?path=${encodeURIComponent(e.path)}`),
    enabled: !!e?.path,
  });
  const battlesQ = useQuery({
    queryKey: ["battles"],
    queryFn: () => get<{ battles: BattleSummary[] }>("/api/battles"),
    refetchInterval: 30_000,
  });

  const d: Record<string, any> = e?.data || {};
  const page = pageQ.data;
  const myBattles = useMemo(
    () => (battlesQ.data?.battles || []).filter((b: any) =>
      b.kampan === e?.path || b.kampan === e?.name
      || (Array.isArray(b.kampane) && b.kampane.includes(e?.path))),
    [battlesQ.data, e]);
  const backlinks = page?.backlinks;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["entity", id] });
    qc.invalidateQueries({ queryKey: ["page", e?.path] });
    qc.invalidateQueries({ queryKey: ["kampane", "nav", "battles", "entity-index", "entities"] });
  };

  const setField = async (field: string, list: string[]) =>
    put(`/api/entities/${e.id}`, { data: { ...d, [field]: list } }).then(refresh);

  /** Položky tabu: entity navázané přes kampane (vazby_in) ∪ kampan-side seznam. */
  const tabItems = (spec: { type: string; field: string }): RelItem[] => {
    const viaRels = (page?.entity?.vazby_in || [])
      .filter((r: RelItem) => r.pred === "v_kampani" && r.type === spec.type);
    const viaField: RelItem[] = (Array.isArray(d[spec.field]) ? d[spec.field] : [])
      .filter((p: string) => !viaRels.some((r) => r.path === p))
      .map((p: string) => ({
        pred: "v_kampani", path: p, type: spec.type,
        name: index.data?.get(p)?.name || human(p),
        url: pageLink(p),
      }));
    return [...viaRels, ...viaField];
  };

  /** Připojení existující položky (nebo nové) do kampaně – item-side kampane. */
  const linkItem = async (itemPath: string, itemId?: number) => {
    const it = itemId != null ? { id: itemId } : index.data?.get(itemPath);
    if (!it) throw new Error("Entita nenalezena");
    await post(`/api/entities/${it.id}/links`, { field: "kampane", path: e.path, op: "add" });
    refresh();
  };

  /** Odebrání položky z kampaně – z item-side kampane i z kampan-side listu. */
  const unlinkItem = async (itemPath: string, spec: { field: string }) => {
    const it = index.data?.get(itemPath);
    if (it) {
      await post(`/api/entities/${it.id}/links`, { field: "kampane", path: e.path, op: "remove" });
    }
    if (Array.isArray(d[spec.field]) && d[spec.field].includes(itemPath)) {
      await put(`/api/entities/${e.id}`, {
        data: { ...d, [spec.field]: d[spec.field].filter((x: string) => x !== itemPath) },
      });
    }
    refresh();
  };

  // obálka kampaně – náhrání (1600×720 webp, uloženo jako Obalka_<slug>.webp)
  const toWebp = (file: File) => new Promise<Blob>((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const W = 1600, H = 720;
      const sc = Math.max(W / img.width, H / img.height);
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      c.getContext("2d")!.drawImage(img,
        (W - img.width * sc) / 2, (H - img.height * sc) / 2, img.width * sc, img.height * sc);
      c.toBlob((b) => (b ? res(b) : rej(new Error("konverze selhala"))), "image/webp", .88);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });

  const onCoverFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    const blob = await toWebp(f);
    await upload(`/api/media/upload?dir=${encodeURIComponent("07_Kampane/obrazky")}`,
      blob, `Obalka_${e.slug}.webp`);
    setVer((v) => v + 1);
  };

  // vytvoření entity už napojené na kampaň – JEDEN request (data.kampane)
  const createLinked = async () => {
    const spec = createTab && LINKED[createTab];
    if (!spec || !newName.trim()) return;
    setBusy(true); setErr("");
    try {
      await post("/api/entities", {
        type: spec.type, dir: spec.dir, name: newName.trim(),
        template: spec.tpl || "", data: { kampane: [e.path] },
      });
      refresh();
      setCreateTab(null); setNewName("");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Vytvoření selhalo");
    } finally { setBusy(false); }
  };

  // připojení vybrané existující entity
  const attachPicked = async () => {
    if (!pickPath || !createTab || createTab === "boje") return;
    setBusy(true); setErr("");
    try {
      await linkItem(pickPath);
      setCreateTab(null); setPickPath("");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Připojení selhalo");
    } finally { setBusy(false); }
  };

  const createBattle = async () => {
    if (!newName.trim()) return;
    setBusy(true); setErr("");
    try {
      const r = await post<{ id: string }>("/api/battles", {
        name: newName.trim(), kampane: [e.path],
      });
      refresh(); setCreateTab(null); setNewName("");
      nav(`/boj?boj=${r.id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Vytvoření selhalo");
      setBusy(false);
    }
  };

  const attachBattle = async () => {
    if (!pickPath) return;
    setBusy(true); setErr("");
    try {
      const b = (battlesQ.data?.battles || []).find((x: any) => x.id === pickPath);
      const kampane = [...new Set([...(b?.kampane || (b?.kampan ? [b.kampan] : [])), e.path])];
      await put(`/api/battles/${pickPath}/meta`, { kampane });
      refresh(); setCreateTab(null); setPickPath("");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Připojení selhalo");
    } finally { setBusy(false); }
  };

  const detachBattle = async (bid: string) => {
    const b = (battlesQ.data?.battles || []).find((x: any) => x.id === bid);
    const kampane = (b?.kampane || (b?.kampan ? [b.kampan] : [])).filter((x: string) => x !== e.path);
    await put(`/api/battles/${bid}/meta`, { kampane });
    refresh();
  };

  const remove = async () => {
    setBusy(true);
    try {
      await del(`/api/entities/${e.id}`);
      qc.invalidateQueries({ queryKey: ["kampane", "nav", "entity-index"] });
      nav("/kampane");
    } finally { setBusy(false); }
  };

  if (entityQ.isLoading) return <div className="p-8 text-[var(--ink-3)]">Načítám kampaň…</div>;
  if (!e) return <div className="p-8 text-[var(--ink-3)]">Kampaň nenalezena.</div>;

  const attr: [string, any][] = [
    ["Stav kampaně", d.stav], ["Úrovně postav", d.urovne], ["Hlavní region", d.region],
    ["Hlavní antagonista", d.antagonista], ["Témata a tón", d.temata],
  ];
  const linkedSpec = tab !== "boje" ? LINKED[tab] : null;
  const unlinkedBattles = (battlesQ.data?.battles || []).filter((b: any) =>
    b.kampan !== e.path && !(Array.isArray(b.kampane) && b.kampane.includes(e.path)));

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 fade-in">
        <Link to="/kampane" className="text-sm text-[var(--ink-3)] hover:text-[var(--ink)] flex items-center gap-1 w-fit">
          <ArrowLeft size={14} /> Kampaně
        </Link>

        <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
          <div>
            <h1 className="chapter-title !text-left !mb-0">{e.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {d.stav && <span className="chip border border-[var(--accent)]/50 text-[var(--accent-2)]">{d.stav}</span>}
              {e.status && <span className="chip">{e.status}</span>}
              {(e.tags || []).map((t: string) => <span key={t} className="chip">{t}</span>)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={e.url} className="btn flex items-center gap-1.5 !text-xs">
              <ExternalLink size={13} /> Wiki stránka
            </Link>
            {editor && (
              <button className="btn !text-xs !text-red-400 flex items-center gap-1" onClick={() => setDelConfirm(true)}>
                <Trash2 size={13} /> Smazat
              </button>
            )}
          </div>
        </div>
        <div className="chapter-rule"><i>✦</i></div>

        {/* obálka */}
        {e.slug && (
          <div className="relative h-44 rounded-md overflow-hidden mb-5 border border-[var(--line-2)]">
            <img src={`/repo/07_Kampane/obrazky/Obalka_${e.slug}.webp?v=${ver}`} alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent" />
            <div className="absolute bottom-3 left-4 text-2xl font-bold text-white drop-shadow-md"
              style={{ fontFamily: "var(--font-head)" }}>{e.name}</div>
          </div>
        )}

        {/* taby napříč */}
        <div className="card p-0">
          <div className="flex border-b border-[var(--line)] overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors
                  ${tab === t.id
                    ? "border-[var(--accent)] text-[var(--accent-2)] font-semibold"
                    : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]"}`}>
                <t.icon size={14} /> {t.label}
                {t.id === "boje" && myBattles.length > 0 &&
                  <span className="chip !py-0 !px-1.5 !text-[10px]">{myBattles.length}</span>}
              </button>
            ))}
            {/* akce „+ Nový" a „Připojit" vpravo v tabbaru */}
            {editor && (linkedSpec || tab === "boje") && (
              <div className="ml-auto mr-2 my-1.5 flex gap-1.5">
                <button
                  className="btn !py-1 !px-2.5 !text-xs flex items-center gap-1 whitespace-nowrap"
                  title={tab === "boje" ? "Připojit existující boj" : `Připojit existující ${linkedSpec!.label}`}
                  onClick={() => { setCreateTab(tab); setNewName(""); setPickPath(""); setErr(""); }}>
                  <Link2 size={13} /> Připojit
                </button>
                <button
                  className="btn chip-accent !py-1 !px-2.5 !text-xs flex items-center gap-1 whitespace-nowrap"
                  onClick={() => { setCreateTab(tab); setNewName(""); setPickPath(""); setErr(""); }}>
                  <Plus size={13} />
                  {tab === "boje" ? "Nový boj" : `Nová ${linkedSpec!.label}`}
                </button>
              </div>
            )}
          </div>

          <div className="p-5">
            {tab === "prehled" && (
              editor
                ? <>
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--line)]">
                      <div className="relative w-44 h-20 rounded overflow-hidden border border-[var(--line-2)] bg-[var(--bg-2)] shrink-0">
                        <img src={`/repo/07_Kampane/obrazky/Obalka_${e.slug}.webp?v=${ver}`} alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-1">Obálka kampaně</div>
                        <button className="btn !text-xs flex items-center gap-1.5" onClick={() => fileRef.current?.click()}>
                          <ImagePlus size={13} /> Nahradit obrázkem
                        </button>
                      </div>
                    </div>
                    <EntityForm type="kampan" entityId={e.id} entityPath={e.path}
                      initial={d} name={e.name} status={e.status} onSaved={refresh} />
                  </>
                : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {attr.filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="card !shadow-none p-3">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-0.5">{k}</div>
                        <div className="text-[13px]">
                          {typeof v === "string" && v.includes("/")
                            ? <Link to={pageLink(v)}>{human(v)}</Link>
                            : String(v)}
                        </div>
                      </div>
                    ))}
                    {!attr.some(([, v]) => v) && (
                      <div className="text-[var(--ink-3)] italic text-sm">Atributy kampaně zatím nejsou vyplněné.</div>
                    )}
                  </div>
                )
            )}

            {tab === "popis" && (
              <>
                {page?.html
                  ? <Markdown html={page.html} />
                  : <div className="text-[var(--ink-3)] italic text-sm">
                      Kampaň zatím nemá popis.{editor && <> Doplň ho na <Link to={e.url}>wiki stránce</Link>.</>}
                    </div>}
                {editor && page?.dm_html && (
                  <div className="mt-4 p-3 rounded border border-red-800/40 bg-red-950/20">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-red-300/80 mb-1">Pro DM (tajné)</div>
                    <Markdown html={page.dm_html} />
                  </div>
                )}
              </>
            )}

            {(tab === "postavy" || tab === "questy" || tab === "sezeni" || tab === "materialy") && linkedSpec && (
              <>
                {tabItems(linkedSpec).length
                  ? (
                      <div className="flex flex-wrap gap-3">
                        {tabItems(linkedSpec).map((r) => (
                          <EntCard key={r.path} path={r.path} label={r.name}
                            icon={TYPE_ICON[tab] || Scroll} ph={tab}
                            img={tab === "postavy"
                              ? `/repo/04_Postavy/obrazky/${stemOf(r.path)}.webp`
                              : undefined}
                            onRemove={editor ? () => unlinkItem(r.path, linkedSpec) : undefined} />
                        ))}
                      </div>
                    )
                  : <div className="text-[var(--ink-3)] italic text-sm py-1">
                      Zatím nic – {editor ? `vytvoř nebo připoj ${linkedSpec.label} tlačítky nahoře.` : "nic tu není."}
                    </div>}
                {tab === "materialy" && backlinks?.odkazy?.length ? (
                  <>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mt-5 mb-2">Stránky odkazující na kampaň</h3>
                    <div className="flex flex-wrap gap-2">
                      {backlinks.odkazy.map((b) => (
                        <Link key={b.path} to={b.url} className="chip">{b.title}</Link>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            )}

            {tab === "boje" && (
              myBattles.length ? (
                <div className="flex flex-wrap gap-3">
                  {myBattles.map((b) => (
                    <div key={b.id} className="kampan-entcard group !cursor-default relative">
                      <Link to={`/boj?boj=${b.id}`} className="contents">
                        <div className="kampan-entcard-img">
                          <img src={PLACEHOLDER.boje} alt="" loading="lazy"
                            onError={(ev) => { ev.currentTarget.style.display = "none"; }} />
                        </div>
                        <div className="kampan-entcard-name">
                          {b.name}{b.shared ? " 📡" : ""}
                          <div className="text-[10px] font-normal text-[var(--ink-3)]">
                            {BATTLE_STAV[b.status] || b.status} · kolo {b.kola || 0} · {b.ucastnici?.length || 0} účastníků
                          </div>
                        </div>
                      </Link>
                      {editor && (
                        <button type="button" title="Odebrat z kampaně" className="kampan-entcard-del"
                          onClick={(ev) => { ev.preventDefault(); detachBattle(b.id); }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : <div className="text-[var(--ink-3)] italic text-sm py-1">
                    Žádné boje.{editor ? " Nový boj založ tlačítkem nahoře – automaticky se přiřadí k této kampani." : ""}
                  </div>
            )}
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onCoverFile} />

      {/* dialog: nová položka / připojit existující */}
      {createTab && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center" onMouseDown={() => setCreateTab(null)}>
          <div className="card w-full max-w-sm p-5 fade-in" onMouseDown={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">
                {createTab === "boje" ? "Boj kampaně" : `${LINKED[createTab]?.label} do kampaně`}
              </h2>
              <button className="btn btn-ghost !px-2" onClick={() => setCreateTab(null)}><X size={16} /></button>
            </div>

            {/* připojení existující položky */}
            <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">Připojit existující</label>
            {createTab === "boje" ? (
              <select className="input w-full mb-2" value={pickPath} onChange={(e2) => setPickPath(e2.target.value)}>
                <option value="">— vyber boj —</option>
                {unlinkedBattles.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : (
              <EntityPicker
                target={LINKED[createTab]?.type}
                value={pickPath}
                onChange={setPickPath}
                placeholder={`Hledat ${LINKED[createTab]?.label}…`} />
            )}
            <button className="btn w-full mb-4" disabled={!pickPath || busy} onClick={createTab === "boje" ? attachBattle : attachPicked}>
              Připojit do kampaně
            </button>

            <div className="flex items-center gap-2 my-3 text-[10px] uppercase tracking-wider text-[var(--ink-3)]">
              <div className="flex-1 border-t border-[var(--line)]" /> nebo vytvořit novou <div className="flex-1 border-t border-[var(--line)]" />
            </div>

            <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">Název</label>
            <input className="input w-full mb-4" value={newName} autoFocus
              onChange={(e2) => setNewName(e2.target.value)}
              onKeyDown={(e2) => e2.key === "Enter" && (createTab === "boje" ? createBattle() : createLinked())} />
            {err && <div className="text-red-400 text-xs mb-3">{err}</div>}
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setCreateTab(null)}>Zrušit</button>
              <button className="btn chip-accent" disabled={!newName.trim() || busy}
                onClick={createTab === "boje" ? createBattle : createLinked}>
                Vytvořit a přiřadit
              </button>
            </div>
          </div>
        </div>
      )}

      {delConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center" onMouseDown={() => setDelConfirm(false)}>
          <div className="card w-full max-w-sm p-5 fade-in" onMouseDown={(ev) => ev.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2 text-red-400">
              <Trash2 size={16} />
              <h2 className="text-lg font-bold">Smazat kampaň?</h2>
            </div>
            <p className="text-sm text-[var(--ink-2)] mb-4">
              Smaže se soubor <b>{e.path}</b>. Navázané postavy, questy a boje zůstanou – ztratí jen vazbu na kampaň.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setDelConfirm(false)}>Zrušit</button>
              <button className="btn !text-red-400" disabled={busy} onClick={remove}>Smazat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

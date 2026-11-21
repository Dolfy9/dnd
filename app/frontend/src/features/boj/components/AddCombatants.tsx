/* Přidání účastníků: Postava (EntityPicker + sheet), Bestiář (SRD, filtry, počet, strana),
   Střetnutí z mapy (auto-nasazení na start), Vlastní. Ukazuje obtížnost střetnutí. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get } from "../../../api";
import EntityPicker from "../../../components/EntityPicker";
import type { BattleMapData, MonsterEntry, Side, StavBoje, Token } from "../types";
import { fromCharacter, fromMonster, custom } from "../rules/combatants";
import { difficulty } from "../rules/encounter";
import { mapSize, tileDef, tileAt } from "../rules/grid";
import { X } from "lucide-react";

const SIDES: { id: Side; n: string }[] = [
  { id: "druzina", n: "Družina" }, { id: "nepratele", n: "Nepřátelé" }, { id: "neutral", n: "Neutrální" },
];

export function freeSpot(S: StavBoje, map: BattleMapData, side: Side, s = 1): [number, number] | undefined {
  const { W, H } = mapSize(map);
  const start = map.start?.[side === "druzina" ? "druzina" : side === "nepratele" ? "nepratele" : "neutral"] || [];
  const taken = (x: number, y: number) =>
    S.tok.some((t) => t.x != null && x < t.x + t.s && x + s > t.x && y < t.y! + t.s && y + s > t.y!);
  const ok = (x: number, y: number) => {
    if (x < 0 || y < 0 || x + s > W || y + s > H) return false;
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
      const c = tileAt(map, x + i, y + j);
      if (!tileDef(c).cost || taken(x + i, y + j)) return false;
    }
    return true;
  };
  for (const [x, y] of start) if (ok(x, y)) return [x, y];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ok(x, y)) return [x, y];
  return undefined;
}

export const useBestiary = () =>
  useQuery({ queryKey: ["bestiar"], queryFn: () => get<MonsterEntry[]>("/repo/web/assets/srd/bestiar.json"), staleTime: 300_000 });

export default function AddCombatants({ S, map, onAdd, onClose }: {
  S: StavBoje; map: BattleMapData;
  onAdd: (t: Token) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"postava" | "bestiar" | "stretnuti" | "vlastni">("postava");
  const [side, setSide] = useState<Side>("nepratele");
  const [path, setPath] = useState("");
  const [q, setQ] = useState("");
  const [cnt, setCnt] = useState(1);
  const [cN, setCN] = useState(""); const [cHp, setCHp] = useState(10); const [cAc, setCAc] = useState(12);
  const [cS, setCS] = useState(1); const [cColor, setCColor] = useState("#8a6d3b"); const [cImg, setCImg] = useState("");
  const best = useBestiary();
  const diff = difficulty(S.tok);

  const mons = useMemo(() => {
    const list = best.data || [];
    const f = q.toLowerCase();
    return list.filter((m) => !f || m.nazev.toLowerCase().includes(f) || (m.typ || "").toLowerCase().includes(f)).slice(0, 60);
  }, [best.data, q]);

  const addChar = async () => {
    if (!path) return;
    const r = await get<any>(`/api/page?path=${encodeURIComponent(path)}`);
    const raw = r.entity?.name || r.entity?.nazev || path.split("/").pop()!.replace(/\.md$/, "").replace(/_/g, " ");
    const name = raw.replace(/^Postava[\s_]+/i, "");
    const t = fromCharacter(path, name, r.entity?.sheet || r.sheet || {}, side, r.entity?.portret || r.portret);
    onAdd(t);
  };

  const addMon = (m: MonsterEntry, n = cnt) => {
    for (let i = 0; i < n; i++) onAdd(fromMonster(m, side));
  };

  return (
    <div className="boj-modal" onClick={onClose}>
      <div className="boj-modal-in boj-add" onClick={(e) => e.stopPropagation()}>
        <div className="boj-modal-head">
          <b>Přidat účastníky</b>
          <span className={`boj-diff ${diff.cls}`}>{diff.label} · {diff.per}</span>
          <button className="boj-x" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="boj-tabs">
          {([["postava", "Postava"], ["bestiar", "Bestiář"], ["stretnuti", "Střetnutí mapy"], ["vlastni", "Vlastní"]] as const).map(([id, n]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{n}</button>
          ))}
        </div>
        <div className="boj-sidepick">
          {SIDES.map((s) => <button key={s.id} className={`boj-btn2 side-${s.id} ${side === s.id ? "on" : ""}`} onClick={() => setSide(s.id)}>{s.n}</button>)}
        </div>

        {tab === "postava" && (
          <div className="boj-add-body">
            <EntityPicker target="postava" value={path} onChange={setPath} placeholder="Hledat postavu…" />
            <button className="boj-btn2 acc" disabled={!path} onClick={addChar}>Přidat postavu</button>
          </div>
        )}

        {tab === "bestiar" && (
          <div className="boj-add-body">
            <div className="boj-add-search">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat (název / typ)…" autoFocus />
              <label>×<input type="number" min={1} max={12} value={cnt} onChange={(e) => setCnt(Math.max(1, Number(e.target.value) || 1))} /></label>
            </div>
            <div className="boj-monlist">
              {mons.map((m) => (
                <button key={m.nazev} className="boj-mon" onClick={() => addMon(m)} title={`${m.typ} · AC ${m.ac} · HP ${m.hp} · ${m.xp} XP`}>
                  <b>{m.nazev}</b><span>CR {m.cr} · {m.typ}</span><em>{m.xp} XP</em>
                </button>
              ))}
              {!mons.length && <i className="boj-none">{best.isLoading ? "načítám bestiář…" : "nic nenalezeno"}</i>}
            </div>
          </div>
        )}

        {tab === "stretnuti" && (
          <div className="boj-add-body">
            {(map.stretnuti || []).length ? map.stretnuti!.map((s, i) => {
              const m = (best.data || []).find((x) => x.nazev.toLowerCase() === s.nazev.toLowerCase());
              return (
                <div key={i} className="boj-enc">
                  <b>{s.nazev}</b><span>×{s.pocet}</span>
                  <button className="boj-btn2 acc" disabled={!m} onClick={() => m && addMon(m, s.pocet)}>
                    {m ? `Nasadit (${s.pocet}×)` : "nenalezen v SRD"}
                  </button>
                </div>
              );
            }) : <i className="boj-none">Mapa nemá definované střetnutí.</i>}
          </div>
        )}

        {tab === "vlastni" && (
          <div className="boj-add-body boj-custom">
            <input value={cN} onChange={(e) => setCN(e.target.value)} placeholder="Název…" />
            <label>HP <input type="number" value={cHp} onChange={(e) => setCHp(Number(e.target.value) || 1)} /></label>
            <label>AC <input type="number" value={cAc} onChange={(e) => setCAc(Number(e.target.value) || 10)} /></label>
            <label>Velikost <select value={cS} onChange={(e) => setCS(Number(e.target.value))}>
              <option value={1}>1×1</option><option value={2}>2×2</option><option value={3}>3×3</option><option value={4}>4×4</option>
            </select></label>
            <label>Barva <input type="color" value={cColor} onChange={(e) => setCColor(e.target.value)} /></label>
            <input value={cImg} onChange={(e) => setCImg(e.target.value)} placeholder="URL obrázku (volitelné)…" />
            <button className="boj-btn2 acc" disabled={!cN.trim()} onClick={() => onAdd(custom(cN.trim(), side, cHp, cAc, 30, { s: cS, color: cColor, obrazek: cImg.trim() || undefined }))}>Přidat</button>
          </div>
        )}
      </div>
    </div>
  );
}

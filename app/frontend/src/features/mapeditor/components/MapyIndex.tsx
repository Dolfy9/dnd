/* /boj/mapy — přehled bojových map: karty s náhledy, hledání, nová, duplikovat, smazat. */
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Map as MapIcon, Plus, Copy, Trash2, Search, ArrowLeft } from "lucide-react";
import { get, post, del } from "../../../api";
import { toast } from "../../../components/ui";
import type { MapV2 } from "../../boj/model/mapV2";

const PX = 24;
const TINT: Record<string, string> = { "#": "#57534e", "~": "#2e4f63", ",": "#5f8a9e", T: "#4a6038", g: "#6d8049", o: "#7d7466", l: "#b3400f", i: "#a8c8dd", f: "#55704a", F: "#3e5c3a", _: "#1c1917", ".": "#8a857c" };

function Thumb({ map }: { map: MapV2 }) {
  const W = map.mrizka?.[0]?.length || 1, H = map.mrizka?.length || 1;
  const cells = useMemo(() => {
    const out: React.ReactElement[] = [];
    map.mrizka?.forEach((row, y) => row.split("").forEach((c, x) => {
      out.push(<rect key={x + "," + y} x={x * PX} y={y * PX} width={PX + .5} height={PX + .5} fill={TINT[c] || TINT["."]} />);
    }));
    return out;
  }, [map.mrizka]);
  if (map.obrazek) return <image href={`/repo/11_Mapy/${map.obrazek}`} width={W * PX} height={H * PX} preserveAspectRatio="xMidYMid slice" />;
  return <>{cells}</>;
}

export default function MapyIndex() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["map-data"], queryFn: () => get<any>("/api/map/data") });
  const mapy: MapV2[] = (data?.bojove_mapy || []).map((r: any) => r.data);
  const filtered = mapy.filter((m) => !q || (m.nazev || "").toLowerCase().includes(q.toLowerCase()));

  const nova = async () => {
    const r = await post<any>("/api/map/bojove", { nazev: `Nová mapa ${mapy.length + 1}` });
    qc.invalidateQueries({ queryKey: ["map-data"] });
    nav(`/boj/mapa/${r.id}`);
  };
  const dupl = async (id: string) => {
    await post(`/api/map/bojove/${id}/duplikat`, {});
    qc.invalidateQueries({ queryKey: ["map-data"] });
    toast("Mapa duplikována", "ok");
  };
  const smaz = async (id: string) => {
    await del(`/api/map/bojove/${id}`);
    qc.invalidateQueries({ queryKey: ["map-data"] });
    setDelId(null);
    toast("Mapa smazána", "ok");
  };

  return (
    <div className="me-index">
      <header className="me-index-head">
        <Link to="/boje" className="me-btn ghost"><ArrowLeft size={16} /> Správa bojů</Link>
        <h1><MapIcon size={20} /> Bojové mapy</h1>
        <span className="me-sp" />
        <div className="me-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat mapu…" /></div>
        <button className="me-btn primary" onClick={nova}><Plus size={16} /> Nová mapa</button>
      </header>
      <div className="me-grid">
        {filtered.map((m) => {
          const W = m.mrizka?.[0]?.length || 1, H = m.mrizka?.length || 1;
          return (
            <div key={m.id} className="me-card">
              <Link to={`/boj/mapa/${m.id}`} className="me-thumb">
                <svg viewBox={`0 0 ${W * PX} ${H * PX}`} preserveAspectRatio="xMidYMid meet"><Thumb map={m} /></svg>
              </Link>
              <div className="me-card-body">
                <Link to={`/boj/mapa/${m.id}`} className="me-card-name">{m.nazev}</Link>
                <div className="me-card-meta">{W}×{H} · {m.podklad || "—"}{(m.steny?.length ? ` · ${m.steny.length} zdí` : "")}{(m.objekty?.length ? ` · ${m.objekty.length} obj.` : "")}</div>
                <div className="me-card-acts">
                  <Link className="me-btn sm" to={`/boj/mapa/${m.id}`}>Upravit</Link>
                  <button className="me-btn sm ghost" title="Duplikovat" onClick={() => dupl(m.id)}><Copy size={14} /></button>
                  <button className="me-btn sm ghost danger" title="Smazat" onClick={() => setDelId(m.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {!filtered.length && <p className="me-none">Žádná mapa{q ? " neodpovídá hledání" : ""}.</p>}
      </div>
      {delId && (
        <div className="me-modal-back" onClick={() => setDelId(null)}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Smazat mapu?</h3>
            <p>Mapa „{mapy.find((m) => m.id === delId)?.nazev}“ bude trvale odstraněna i s obrázkem. Boje, které ji používají, zůstanou, ale mapa se jim nenačte.</p>
            <div className="me-modal-acts">
              <button className="me-btn ghost" onClick={() => setDelId(null)}>Zrušit</button>
              <button className="me-btn danger" onClick={() => smaz(delId)}><Trash2 size={15} /> Smazat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

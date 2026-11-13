import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { get, put, post } from "../api";
import EntityPicker from "./EntityPicker";

interface Field {
  key: string; label: string; type: string; required?: boolean;
  options?: string[]; target?: string; fields?: Field[];
  help?: string; span?: number;
}
interface Section { title: string; fields: Field[] }
interface Schema { type: string; label: string; sections: Section[] }

type Data = Record<string, unknown>;

// ---------- jednotlivá pole ----------

function TextField({ f, v, set }: { f: Field; v: unknown; set: (x: unknown) => void }) {
  if (f.type === "textarea") {
    return <textarea className="input !py-1.5 !text-[13px] min-h-16" value={String(v ?? "")}
      onChange={(e) => set(e.target.value)} />;
  }
  if (f.type === "number") {
    return <input className="input !py-1 !text-[13px]" type="number" value={v == null || v === "" ? "" : Number(v)}
      onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))} />;
  }
  if (f.type === "select") {
    return (
      <select className="input !py-1 !text-[13px]" value={String(v ?? "")} onChange={(e) => set(e.target.value)}>
        {(f.options || []).map((o) => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    );
  }
  if (f.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 py-1 cursor-pointer">
        <input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} className="accent-[var(--accent)] w-4 h-4" />
        <span className="text-[13px] text-[var(--ink-2)]">{v ? "ano" : "ne"}</span>
      </label>
    );
  }
  if (f.type === "list" || f.type === "tags") {
    return <ChipEditor v={v} set={set} />;
  }
  return <input className="input !py-1 !text-[13px]" value={String(v ?? "")} onChange={(e) => set(e.target.value)} />;
}

function ChipEditor({ v, set, placeholder }: { v: unknown; set: (x: unknown) => void; placeholder?: string }) {
  const list = Array.isArray(v) ? (v as unknown[]).map(String) : [];
  const [txt, setTxt] = useState("");
  const add = () => {
    const t = txt.trim();
    if (!t) return;
    set([...list, t]);
    setTxt("");
  };
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {list.map((s, i) => (
        <span key={i} className="chip flex items-center gap-1">
          {s}
          <button type="button" className="text-[var(--ink-3)] hover:text-red-400" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </span>
      ))}
      <input
        className="input !py-0.5 !px-2 !text-[12px] !w-32 !border-dashed"
        placeholder={placeholder || "+ přidat"}
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
      />
    </div>
  );
}

function LinksField({ f, v, set }: { f: Field; v: unknown; set: (x: unknown) => void }) {
  const list = Array.isArray(v) ? (v as string[]) : (v ? [String(v)] : []);
  return (
    <div className="space-y-1.5">
      {list.map((p, i) => (
        <div key={i} className="flex gap-1 items-start">
          <div className="flex-1">
            <EntityPicker target={f.target} value={p}
              onChange={(np) => set(list.map((x, j) => (j === i ? np : x)).filter(Boolean))} />
          </div>
          <button type="button" className="btn !py-1 !px-2 !text-xs" onClick={() => set(list.filter((_, j) => j !== i))}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button type="button" className="btn !text-xs !py-1 !border-dashed"
        onClick={() => set([...list, ""])}>
        <Plus size={13} /> Přidat
      </button>
    </div>
  );
}

function DictField({ f, v, set }: { f: Field; v: unknown; set: (x: unknown) => void }) {
  const obj = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Data;
  const setKey = (k: string, x: unknown) => set({ ...obj, [k]: x });
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 border border-[var(--line)] rounded-md p-2.5 bg-[var(--bg-2)]">
      {(f.fields || []).map((sf) => (
        <div key={sf.key} className={sf.type === "textarea" ? "col-span-2" : ""}>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-0.5">
            {sf.label || sf.key}
          </label>
          <TextField f={sf} v={obj[sf.key]} set={(x) => setKey(sf.key, x)} />
        </div>
      ))}
    </div>
  );
}

function DictListField({ f, v, set }: { f: Field; v: unknown; set: (x: unknown) => void }) {
  const list = Array.isArray(v) ? (v as Data[]) : [];
  const setRow = (i: number, row: Data) => set(list.map((r, j) => (j === i ? row : r)));
  return (
    <div className="space-y-2">
      {list.map((row, i) => (
        <div key={i} className="border border-[var(--line)] rounded-md p-2.5 bg-[var(--bg-2)] relative">
          <button type="button" onClick={() => set(list.filter((_, j) => j !== i))}
            className="absolute top-1.5 right-1.5 text-[var(--ink-3)] hover:text-red-400" title="Smazat řádek">
            <Trash2 size={14} />
          </button>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 pr-6">
            {(f.fields || []).map((sf) => (
              <div key={sf.key} className={sf.type === "textarea" || (f.fields!.length === 1) ? "col-span-2" : ""}>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-0.5">
                  {sf.label || sf.key}
                </label>
                <TextField f={sf} v={row[sf.key]} set={(x) => setRow(i, { ...row, [sf.key]: x })} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn !text-xs !py-1 !border-dashed"
        onClick={() => set([...list, {}])}>
        <Plus size={13} /> Přidat řádek
      </button>
    </div>
  );
}

function FieldControl({ f, v, set }: { f: Field; v: unknown; set: (x: unknown) => void }) {
  switch (f.type) {
    case "link": return <EntityPicker target={f.target} value={String(v ?? "")} onChange={set} />;
    case "links": return <LinksField f={f} v={v} set={set} />;
    case "list":
    case "tags": return <ChipEditor v={v} set={set} />;
    case "dict": return <DictField f={f} v={v} set={set} />;
    case "dictlist": return <DictListField f={f} v={v} set={set} />;
    default: return <TextField f={f} v={v} set={set} />;
  }
}

// ---------- formulář ----------

interface Props {
  type: string;
  entityId: number;
  entityPath: string;
  initial: Data;
  name: string;
  status: string;
  onSaved?: () => void;
}

export default function EntityForm({ type, entityId, entityPath, initial, name, status, onSaved }: Props) {
  const qc = useQueryClient();
  const schema = useQuery({
    queryKey: ["schema", type],
    queryFn: () => get<Schema>(`/api/schemas/${type}`),
    staleTime: 30_000,
  });
  const [data, setData] = useState<Data>({});
  const [title, setTitle] = useState(name);
  const [stat, setStat] = useState(status);
  const [msg, setMsg] = useState("");
  const [openSec, setOpenSec] = useState<Record<number, boolean>>({ 0: true });

  useEffect(() => { setData(initial || {}); setTitle(name); setStat(status); },
    [initial, name, status]);

  const save = useMutation({
    mutationFn: () => put(`/api/entities/${entityId}`, { data, name: title, status: stat }),
    onSuccess: () => {
      setMsg("Uloženo ✓");
      qc.invalidateQueries({ queryKey: ["page"] });
      qc.invalidateQueries({ queryKey: ["entity-index"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      onSaved?.();
    },
    onError: (e) => setMsg(e.message),
  });

  const sections = schema.data?.sections || [];
  const knownKeys = useMemo(
    () => new Set(sections.flatMap((s) => s.fields.map((f) => f.key))),
    [sections]);
  const extra = Object.entries(data).filter(([k]) => !knownKeys.has(k));

  if (schema.isLoading) return <div className="p-4 text-sm text-[var(--ink-3)] font-ui">Načítám schéma…</div>;

  return (
    <div className="font-ui">
      <div className="mb-4">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-0.5">Zobrazované jméno</label>
        <input className="input !py-1 !text-[13px]" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      {!sections.length && (
        <div className="text-sm text-[var(--ink-3)] mb-3">
          Typ „{type}“ nemá schéma (app/schemas/{type}.json) – zobrazují se jen volná pole níže.
        </div>
      )}

      {sections.map((sec, si) => (
        <div key={si} className="mb-3 border border-[var(--line)] rounded-[var(--radius)] overflow-hidden">
          <button type="button" onClick={() => setOpenSec((s) => ({ ...s, [si]: !s[si] }))}
            className="w-full flex items-center justify-between px-3 py-2 bg-[var(--panel-2)] text-left">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--ink-2)]">{sec.title}</span>
            <span className="text-[var(--ink-3)] text-xs">{openSec[si] !== false ? "▾" : "▸"}</span>
          </button>
          {openSec[si] !== false && (
            <div className="p-3 space-y-3">
              {sec.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-[11px] font-semibold text-[var(--ink-2)] mb-1">
                    {f.label}{f.required && <span className="text-[var(--accent)]"> *</span>}
                  </label>
                  <FieldControl f={f} v={data[f.key]} set={(x) => setData((d) => ({ ...d, [f.key]: x }))} />
                  {f.help && <div className="text-[11px] text-[var(--ink-3)] mt-0.5">{f.help}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {!!extra.length && (
        <details className="mb-3">
          <summary className="text-[11px] font-semibold text-[var(--ink-3)] cursor-pointer">
            Další atributy ({extra.length})
          </summary>
          <div className="mt-2 space-y-2">
            {extra.map(([k]) => (
              <div key={k}>
                <label className="block text-[11px] font-semibold text-[var(--ink-2)] mb-1">{k}</label>
                <FieldControl f={{ key: k, label: k, type: guessType(data[k]) }}
                  v={data[k]} set={(x) => setData((d) => ({ ...d, [k]: x }))} />
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--line)]">
        <button className="btn btn-primary !text-sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Ukládám…" : "Uložit atributy"}
        </button>
        <span className="text-xs text-[var(--ink-3)]">{entityPath}</span>
        {msg && <span className={`ml-auto text-xs ${msg.includes("✓") ? "text-emerald-500" : "text-red-400"}`}>{msg}</span>}
      </div>
    </div>
  );
}

function guessType(v: unknown): string {
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "checkbox";
  if (Array.isArray(v)) return v.every((x) => typeof x === "string") ? "list" : "dictlist";
  if (v && typeof v === "object") return "dict";
  return "text";
}

// ---------- vytvoření nové entity ----------

export function useNewEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { type: string; dir: string; name: string; template?: string }) =>
      post<{ ok: boolean; id: number | null; path: string; url: string }>("/api/entities", b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nav"] });
      qc.invalidateQueries({ queryKey: ["entity-index"] });
    },
  });
}

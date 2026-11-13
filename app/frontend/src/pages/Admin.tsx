import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put, del } from "../api";
import { useApp } from "../store";

const ROLES = ["player", "editor", "admin"];
const ROLE_LABELS: Record<string, string> = { player: "Hráč", editor: "Editor", admin: "DM (admin)" };

interface AdminUser {
  id: number; login: string; name: string; role: string;
  disabled: number; created_at: string;
}

export function AdminUsers() {
  const qc = useQueryClient();
  const me = useApp((s) => s.user);
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => get<{ users: AdminUser[] }>("/api/admin/users"),
  });
  const [nl, setNl] = useState("");
  const [nn, setNn] = useState("");
  const [nr, setNr] = useState("player");
  const [np, setNp] = useState("");

  const create = useMutation({
    mutationFn: () => post("/api/admin/users", { login: nl, name: nn, role: nr, password: np }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setNl(""); setNn(""); setNp("");
    },
  });
  const update = useMutation({
    mutationFn: (v: { u: AdminUser; role?: string; disabled?: boolean }) =>
      put(`/api/admin/users/${v.u.id}`, {
        login: v.u.login, name: v.u.name,
        role: v.role ?? v.u.role,
        disabled: v.disabled ?? !!v.u.disabled,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => del(`/api/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-4">Uživatelé</h1>
      <div className="card p-4 mb-4 font-ui">
        <div className="text-sm font-semibold mb-2">Nový účet</div>
        <div className="flex gap-2 flex-wrap">
          <input className="input !w-40 !text-sm" placeholder="login" value={nl} onChange={(e) => setNl(e.target.value)} />
          <input className="input !w-48 !text-sm" placeholder="Jméno" value={nn} onChange={(e) => setNn(e.target.value)} />
          <select className="input !w-28 !text-sm" value={nr} onChange={(e) => setNr(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <input className="input !w-44 !text-sm" type="password" placeholder="heslo" value={np} onChange={(e) => setNp(e.target.value)} />
          <button className="btn btn-primary !text-sm" disabled={!nl || !np || create.isPending} onClick={() => create.mutate()}>
            Vytvořit
          </button>
        </div>
        {create.error && <div className="text-red-400 text-xs mt-2">{create.error.message}</div>}
      </div>
      <div className="card overflow-x-auto font-ui">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left">
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Účet</th>
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Jméno</th>
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Role</th>
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Stav</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(users.data?.users || []).map((u) => (
              <tr key={u.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-3 py-2 font-semibold">{u.login}</td>
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">
                  {u.id === me?.id ? ROLE_LABELS[u.role] : (
                    <select className="input !py-0.5 !text-xs !w-28" value={u.role}
                      onChange={(e) => update.mutate({ u, role: e.target.value })}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-3 py-2">{u.disabled ? "zakázaný" : "aktivní"}</td>
                <td className="px-3 py-2 text-right">
                  {u.id !== me?.id && (
                    <span className="flex gap-1 justify-end">
                      {!u.disabled && (
                        <button className="btn !text-xs !py-1" onClick={() => update.mutate({ u, disabled: true })}>Zakázat</button>
                      )}
                      <button className="btn btn-danger !text-xs !py-1"
                        onClick={() => confirm(`Smazat účet ${u.login}?`) && remove.mutate(u.id)}>
                        Smazat
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminAudit() {
  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => get<{ items: { ts: string; user: string; action: string; target: string; detail: string }[] }>("/api/admin/audit"),
  });
  return (
    <div className="p-6 max-w-5xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-4">Audit</h1>
      <div className="card overflow-x-auto font-ui">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left">
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Čas</th>
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Uživatel</th>
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Akce</th>
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Cíl</th>
              <th className="px-3 py-2 text-xs uppercase tracking-wider text-[var(--ink-3)]">Detail</th>
            </tr>
          </thead>
          <tbody>
            {(audit.data?.items || []).map((a, i) => (
              <tr key={i} className="border-b border-[var(--line)] last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-xs">{a.ts}</td>
                <td className="px-3 py-2">{a.user}</td>
                <td className="px-3 py-2"><span className="chip">{a.action}</span></td>
                <td className="px-3 py-2 text-xs">{a.target}</td>
                <td className="px-3 py-2 text-xs text-[var(--ink-3)] max-w-xs truncate">{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSystem() {
  const status = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => get<Record<string, unknown>>("/api/admin/status"),
  });
  const reindex = useMutation({
    mutationFn: () => post<{ ok: boolean; stats: Record<string, unknown> }>("/api/admin/reindex", {}),
  });
  const backup = useMutation({
    mutationFn: () => post<{ ok: boolean; file: string }>("/api/admin/backup", {}),
  });

  return (
    <div className="p-6 max-w-3xl mx-auto fade-in">
      <h1 className="text-2xl font-bold mb-4">Systém</h1>
      <div className="card p-4 font-ui text-sm mb-4">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--ink-3)] mb-2">Stav indexu</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {Object.entries(status.data || {}).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dashed border-[var(--line)] py-1">
              <span className="text-[var(--ink-2)]">{k}</span><span className="font-semibold">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 font-ui">
        <button className="btn" disabled={reindex.isPending} onClick={() => reindex.mutate()}>
          {reindex.isPending ? "Reindexuji…" : "Přeindexovat obsah"}
        </button>
        <button className="btn" disabled={backup.isPending} onClick={() => backup.mutate()}>
          {backup.isPending ? "Zálohuji…" : "Vytvořit zálohu"}
        </button>
      </div>
      {reindex.data && <pre className="card p-3 mt-3 text-xs overflow-x-auto">{JSON.stringify(reindex.data, null, 2)}</pre>}
      {backup.data && <pre className="card p-3 mt-3 text-xs overflow-x-auto">{JSON.stringify(backup.data, null, 2)}</pre>}
    </div>
  );
}

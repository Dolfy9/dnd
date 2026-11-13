import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Castle } from "lucide-react";
import { login } from "../api";
import { useApp } from "../store";

export default function Login() {
  const [l, setL] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const setUser = useApp((s) => s.setUser);
  const nav = useNavigate();
  const qc = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const user = await login(l, p);
      qc.setQueryData(["me"], user);
      setUser(user);
      nav("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Přihlášení selhalo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full grid place-items-center" style={{
      background: "radial-gradient(80% 60% at 50% 0%, var(--accent-soft), transparent), var(--bg)",
    }}>
      <form onSubmit={submit} className="card p-8 w-80 fade-in">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <Castle size={26} className="text-[var(--accent)]" />
          <span className="text-2xl font-bold">Montelien</span>
        </div>
        <label className="block font-ui text-xs font-semibold text-[var(--ink-3)] mb-1">Přihlašovací jméno</label>
        <input className="input mb-3" value={l} onChange={(e) => setL(e.target.value)} autoFocus autoComplete="username" />
        <label className="block font-ui text-xs font-semibold text-[var(--ink-3)] mb-1">Heslo</label>
        <input className="input mb-4" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
        {err && <div className="text-red-400 text-sm font-ui mb-3">{err}</div>}
        <button className="btn btn-primary w-full justify-center" disabled={busy || !l || !p}>
          {busy ? "Přihlašuji…" : "Přihlásit"}
        </button>
      </form>
    </div>
  );
}

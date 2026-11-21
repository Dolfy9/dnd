import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Music2, Pencil, Play, Plus, Trash2, Youtube } from "lucide-react";
import { del, get, put } from "../api";
import { useApp, isEditor } from "../store";
import { Modal, confirmDialog, toast, PageHeader } from "../components/ui";

interface Preset { id: string; name: string; video_id: string; list_id: string; note: string }

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "preset";
// URL nebo ID → video_id / list_id
function parseYt(input: string): { video_id: string; list_id: string } {
  const t = input.trim();
  if (!t) return { video_id: "", list_id: "" };
  const list = t.match(/[?&]list=([\w-]+)/)?.[1] || "";
  const vid = t.match(/[?&]v=([\w-]+)/)?.[1]
    || t.match(/youtu\.be\/([\w-]+)/)?.[1]
    || (!/[/:?&]/.test(t) ? t : "");
  return { video_id: vid, list_id: list };
}

function PresetForm({ preset, onClose }: { preset: Preset | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = !preset;
  const [name, setName] = useState(preset?.name || "");
  const [yt, setYt] = useState(
    preset ? (preset.list_id ? `https://youtube.com/playlist?list=${preset.list_id}` : preset.video_id) : "");
  const [note, setNote] = useState(preset?.note || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const { video_id, list_id } = parseYt(yt);
    if (!name.trim()) return toast("Chybí název.", "err");
    if (!video_id && !list_id) return toast("Zadej YouTube odkaz, ID videa nebo playlistu.", "err");
    setBusy(true);
    try {
      await put("/api/admin/music", {
        id: preset?.id || slug(name), name: name.trim(), video_id, list_id, note: note.trim(),
      });
      qc.invalidateQueries({ queryKey: ["music"] });
      toast("Preset uložen.", "ok");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Uložení selhalo", "err");
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? "Nový hudební preset" : `Upravit preset „${preset?.name}“`} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Zrušit</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Ukládám…" : "Uložit"}
          </button>
        </>
      }>
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">Název</label>
          <input className="input !py-1.5" value={name} onChange={(e) => setName(e.target.value)} autoFocus
            onKeyDown={(e) => e.key === "Enter" && save()} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">YouTube odkaz nebo ID</label>
          <input className="input !py-1.5 font-mono !text-[12px]" value={yt}
            onChange={(e) => setYt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="https://youtube.com/watch?v=… nebo ?list=…" />
          <div className="text-[11px] text-[var(--ink-3)] mt-0.5">
            Rozpozná se ID videa (<code>v=</code>, <code>youtu.be/</code>) i playlistu (<code>list=</code>).
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[var(--ink-3)] mb-1">Poznámka</label>
          <input className="input !py-1.5" value={note} onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()} placeholder="např. na podzimní Miria" />
        </div>
      </div>
    </Modal>
  );
}

export default function Hudba() {
  const { user, playMusic } = useApp();
  const editor = isEditor(user);
  const qc = useQueryClient();
  const [form, setForm] = useState<Preset | null | "new">(null);

  const presets = useQuery({
    queryKey: ["music"],
    queryFn: () => get<{ items: Preset[] }>("/api/admin/music"),
  });
  const items = presets.data?.items || [];

  const remove = async (p: Preset) => {
    if (!await confirmDialog({
      title: "Smazat preset", text: `Smazat preset „${p.name}“?`, okLabel: "Smazat", danger: true,
    })) return;
    try {
      await del(`/api/admin/music/${encodeURIComponent(p.id)}`);
      qc.invalidateQueries({ queryKey: ["music"] });
      toast("Preset smazán.", "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Smazání selhalo", "err");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto fade-in">
      <PageHeader icon={<Music2 size={20} />} title="Hudba"
        subtitle="Presety z YouTube pro nálady a scény. „Přehrát“ spustí skladbu v přehrávači vpravo dole."
        actions={editor && (
          <button className="btn sm" onClick={() => setForm("new")}>
            <Plus size={14} /> Nový preset
          </button>
        )} />

      {presets.isLoading && <div className="text-sm font-ui text-[var(--ink-3)]">Načítám…</div>}
      {presets.error && <div className="text-sm font-ui text-red-400">{presets.error.message}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <div key={p.id} className="card p-4 font-ui flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Youtube size={18} className="text-[var(--accent)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-[11px] text-[var(--ink-3)]">
                  {p.list_id ? "playlist" : "skladba"}{p.note ? ` · ${p.note}` : ""}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 mt-auto">
              <button className="btn btn-primary sm flex-1 justify-center" onClick={() => playMusic(p.id)}>
                <Play size={13} /> Přehrát
              </button>
              {editor && (
                <>
                  <button className="btn sm" title="Upravit" onClick={() => setForm(p)}><Pencil size={13} /></button>
                  <button className="btn btn-danger sm" title="Smazat" onClick={() => remove(p)}><Trash2 size={13} /></button>
                </>
              )}
            </div>
          </div>
        ))}
        {!items.length && !presets.isLoading && (
          <div className="card p-6 font-ui text-sm text-[var(--ink-3)] sm:col-span-2 lg:col-span-3">
            Žádné presety.{editor ? " Přidej první tlačítkem „Nový preset“." : ""}
          </div>
        )}
      </div>

      {form && (
        <PresetForm preset={form === "new" ? null : form} onClose={() => setForm(null)} />
      )}
    </div>
  );
}

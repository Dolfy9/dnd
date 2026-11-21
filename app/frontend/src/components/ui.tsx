import { useEffect, type ReactNode } from "react";
import { create } from "zustand";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";

// ---------- Modal ----------

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
}

export function Modal({ title, onClose, children, footer, width }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4 fade-in"
      onMouseDown={onClose}>
      <div className="card w-full max-h-[90dvh] flex flex-col fade-in"
        style={{ maxWidth: width || 480 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--line)]">
          <h2 className="text-lg font-bold truncate">{title}</h2>
          <button className="btn btn-ghost !px-2" onClick={onClose} title="Zavřít" aria-label="Zavřít">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto font-ui">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--line)]">{footer}</div>
        )}
      </div>
    </div>
  );
}

// ---------- Toasty ----------

type ToastKind = "ok" | "err" | "info";
interface Toast { id: number; msg: string; kind: ToastKind }

interface ToastState {
  items: Toast[];
  push: (msg: string, kind?: ToastKind) => void;
  drop: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (msg, kind = "info") => {
    const id = nextId++;
    set((s) => ({ items: [...s.items.slice(-4), { id, msg, kind }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3500);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export const toast = (msg: string, kind: ToastKind = "info") => useToasts.getState().push(msg, kind);

const TOAST_ICON = {
  ok: <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />,
  err: <AlertTriangle size={15} className="text-red-400 shrink-0" />,
  info: <Info size={15} className="text-[var(--accent-2)] shrink-0" />,
};

export function Toaster() {
  const items = useToasts((s) => s.items);
  const drop = useToasts((s) => s.drop);
  return (
    <div className="fixed left-4 bottom-4 z-[800] space-y-2 max-w-sm">
      {items.map((t) => (
        <button key={t.id} onClick={() => drop(t.id)}
          className="card w-full flex items-center gap-2 px-3.5 py-2.5 font-ui text-sm text-left fade-in cursor-pointer">
          {TOAST_ICON[t.kind]}
          <span className="flex-1">{t.msg}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- PageHeader ----------

interface PageHeaderProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-head">
      {icon && <span className="ph-ico">{icon}</span>}
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle && <div className="ph-sub">{subtitle}</div>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </div>
  );
}

// ---------- confirmDialog ----------

interface ConfirmReq {
  title: string;
  text?: string;
  okLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface ConfirmState {
  req: ConfirmReq | null;
  ask: (r: Omit<ConfirmReq, "resolve">) => Promise<boolean>;
  settle: (ok: boolean) => void;
}

const useConfirm = create<ConfirmState>((set, get) => ({
  req: null,
  ask: (r) => new Promise<boolean>((resolve) => set({ req: { ...r, resolve } })),
  settle: (ok) => { get().req?.resolve(ok); set({ req: null }); },
}));

export function confirmDialog(opts: { title: string; text?: string; okLabel?: string; danger?: boolean }) {
  return useConfirm.getState().ask(opts);
}

export function ConfirmHost() {
  const req = useConfirm((s) => s.req);
  const settle = useConfirm((s) => s.settle);
  if (!req) return null;
  return (
    <Modal title={req.title} onClose={() => settle(false)} width={420}
      footer={
        <>
          <button className="btn" onClick={() => settle(false)}>Zrušit</button>
          <button className={"btn" + (req.danger ? " btn-danger" : " btn-primary")} autoFocus
            onClick={() => settle(true)}>
            {req.okLabel || "Potvrdit"}
          </button>
        </>
      }>
      <p className="text-sm text-[var(--ink-2)]">{req.text || "Opravdu?"}</p>
    </Modal>
  );
}

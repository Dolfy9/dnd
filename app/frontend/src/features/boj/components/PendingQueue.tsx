import { orderedDecisions, type PendingKind } from "../rules/pending";

export interface QueueRow { id: string; kind: PendingKind; label: string; detail?: string; resolve: () => void; skip: () => void }
export default function PendingQueue({ rows, requests }: { rows: QueueRow[]; requests?: React.ReactNode }) {
  if (!rows.length && !requests) return null;
  return <section className="combat-pending" aria-label="Čekající rozhodnutí">
    {requests}
    {!!rows.length && <header><b>Čeká na rozhodnutí</b><span>{rows.length}</span></header>}
    {orderedDecisions(rows).map((row, i) => <article key={row.id} data-kind={row.kind}>
      <span className="combat-pending-index">{i + 1}</span><div><b>{row.label}</b>{row.detail && <small>{row.detail}</small>}
      <div><button className="boj-mini" onClick={row.resolve}>Vyřešit</button><button className="boj-mini" onClick={row.skip}>Přeskočit</button></div></div>
    </article>)}
  </section>;
}

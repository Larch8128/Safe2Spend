import { useState } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { money, parse, transactionHistory, type State, type Txn } from "@/lib/budget";

/** Section-scoped destructive action: clears every logged transaction after a confirm. */
export function ClearSpendingButton({ s, up }: { s: State; up: (patch: Partial<State>) => void }) {
  return <Button variant="link" size="sm"
    onClick={() => { if (confirm("Clear every logged transaction? This cannot be undone.")) up({ txns: [] }); }}
    className="h-auto py-1 text-sm font-semibold text-destructive">
    Clear all spending
  </Button>;
}

export function RecentTransactions({ s, up }: { s: State; up: (patch: Partial<State>) => void }) {
  const [open, setOpen] = useState(false);
  const history = transactionHistory(s.txns);
  const list = (items: Txn[]) => <ul className="divide-y">
    {items.map((t) => <TxnRow key={t.id} t={t} s={s} up={up} />)}
  </ul>;
  return <section aria-label="Recent Transactions" className="mt-4">
    <div className="flex items-center justify-between gap-2">
      <h2 className="section-heading">Recent Transactions</h2>
      <div className="flex items-center gap-1">
        {history.length > 0 && <ClearSpendingButton s={s} up={up} />}
        <Button variant="link" size="sm" onClick={() => setOpen(true)}>View All</Button>
      </div>
    </div>
    <div className="mt-2 rounded-2xl border bg-card px-3 elevate">
      {history.length ? list(transactionHistory(s.txns, 3)) : <p className="py-3 text-sm text-muted-foreground">No transactions yet</p>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[80dvh] w-[calc(100%-2rem)] rounded-lg">
        <DialogTitle className="font-display text-xl">Transaction History</DialogTitle>
        <DialogDescription>{history.length} transaction{history.length === 1 ? "" : "s"}</DialogDescription>
        <div className="min-h-0 overflow-y-auto">{history.length ? list(history) : <p className="py-3 text-sm text-muted-foreground">No transactions yet</p>}</div>
      </DialogContent>
    </Dialog>
  </section>;
}

function TxnRow({ t, s, up }: { t: Txn; s: State; up: (patch: Partial<State>) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(t.amount));
  const category = s.categories.find((c) => c.id === t.catId)?.name ?? "Deleted category";
  const date = parse(t.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const save = () => {
    const n = parseFloat(draft);
    if (Number.isFinite(n) && n > 0) up({ txns: s.txns.map((x) => x.id === t.id ? { ...x, amount: n } : x) });
    setEditing(false);
  };
  const editAmount = () => { setDraft(String(t.amount)); setEditing(true); };
  return <li className="flex min-h-14 items-center gap-2 py-2">
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{category}</p><time dateTime={t.date} className="text-xs text-muted-foreground">{date}</time></div>
    {editing ? (
      <>
        <input autoFocus inputMode="decimal" aria-label={`Edit ${category} amount`} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          onFocus={(e) => e.target.select()}
          className="w-24 rounded-md border bg-background px-2 py-1 tnum text-right text-sm font-semibold outline-none ring-2 ring-ring" />
        <Button variant="ghost" size="icon" aria-label="Save amount" className="shrink-0 text-primary" onClick={save}><Check className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Cancel edit" className="shrink-0 text-muted-foreground" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
      </>
    ) : (
      <>
        <span className="tnum shrink-0 text-sm font-semibold">{money(t.amount)}</span>
        <Button variant="ghost" size="icon" aria-label={`Edit ${category} amount`} title="Edit amount" className="shrink-0 text-muted-foreground hover:text-primary" onClick={editAmount}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${category} transaction`} title="Delete transaction" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => up({ txns: s.txns.filter((x) => x.id !== t.id) })}><Trash2 className="h-4 w-4" /></Button>
      </>
    )}
  </li>;
}

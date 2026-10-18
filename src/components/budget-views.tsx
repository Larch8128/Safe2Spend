import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/budget-inline-edit";
import { LayoutEditor } from "@/components/budget-layout-editor";
import { useBudget } from "@/components/budget-provider";
import { RecentTransactions } from "@/components/budget-transactions";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Check, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  figures, iso, money, payPeriod, uid, editRemaining, summaryTotal, selectVisiblePeriod, resolveTopPeriod,
  overviewWeeks, THEMES, parse,
  type State, type LineItem, type TopMode,
} from "@/lib/budget";

const ALL = ["daily", "weekly", "monthly"] as const;
const TOP_MODES: TopMode[] = ["daily", "weekly", "monthly", "auto"];
const fmtD = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
// Fixed equal columns for daily/weekly/monthly — widths never change when toggled.
const COLS = "minmax(5.5rem, 1.4fr) repeat(3, minmax(0, 1fr))";

export function Dashboard() {
  const { s, up } = useBudget();
  const today = useMemo(() => new Date(), []);
  if (!s) return <div className="min-h-screen" />;

  const period = payPeriod(today, s.payDay);
  const rows = s.categories.map((c) => ({ c, f: figures(c, s.txns, today, s.payDay) }));
  const billsT = s.bills.reduce((a, b) => a + b.amount, 0);
  const potsT = s.pots.reduce((a, b) => a + b.amount, 0);
  const catT = s.categories.reduce((a, c) => a + (c.start ?? c.monthly), 0);
  const unalloc = s.income - billsT - potsT - catT;

  const top = resolveTopPeriod(s.topMode, s.show, s.activePeriod);
  const visible = ALL.filter((k) => s.show[k]);
  const toggle = (k: typeof ALL[number]) => {
    const show = { ...s.show, [k]: !s.show[k] };
    if (!Object.values(show).some(Boolean)) return;
    up({ show, activePeriod: selectVisiblePeriod(show, s.activePeriod) });
  };
  const chooseTop = (mode: TopMode) => {
    if (mode === "auto") { up({ topMode: "auto" }); return; }
    up({ topMode: mode, activePeriod: mode });
  };
  const blocks = {
    summary: <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{fmtD(period.start)} – {fmtD(period.end)}</p>
        <h1 className="font-display text-3xl font-bold">Safe to spend</h1>
        <p className="figure-num mt-2 text-5xl" aria-label="Safe to spend total">{money(summaryTotal(rows.map((r) => r.f), top))}</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Top figure period">
          {TOP_MODES.map((m) => <button key={m} type="button" onClick={() => chooseTop(m)} aria-pressed={s.topMode === m}
            className={`pill capitalize ${s.topMode === m ? "pill-on" : ""}`}>{m}</button>)}
        </div>
      </div>
    </header>,
    spend: <><Spend s={s} up={up} today={today} /><RecentTransactions s={s} up={up} /></>,
    table: <section aria-label="Safe to spend table" className="mt-10">
      <h2 className="section-heading mb-2">Safe to Spend</h2>
      <div className="overflow-hidden rounded-2xl border bg-card elevate">
        <div className="budget-grid grid items-center gap-1 border-b bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground" style={{ gridTemplateColumns: COLS }}>
          <span>SAFE TO SPEND</span>
          {ALL.map((k) => <span key={k} className="tnum px-1 capitalize text-center">{k}</span>)}
        </div>
        <div className="budget-grid grid items-center gap-1 border-b bg-muted px-3 py-2" style={{ gridTemplateColumns: COLS }}>
          <span className="text-xs text-muted-foreground">Show columns</span>
          {ALL.map((k) => <span key={k} className="flex justify-center">
            <button type="button" onClick={() => toggle(k)} aria-pressed={s.show[k]} aria-label={`${s.show[k] ? "Hide" : "Show"} ${k} column`}
              disabled={s.show[k] && visible.length === 1}
              className={`pill capitalize ${s.show[k] ? "pill-on" : ""}`}>{k}</button>
          </span>)}
        </div>
        {rows.map(({ c, f }) => <div key={c.id} className="border-b last:border-0">
          <div className="budget-grid grid items-center gap-1 px-3 py-2" style={{ gridTemplateColumns: COLS }}>
            <InlineEdit value={c.name} label={`Edit ${c.name} name`} onSave={(name) => up({ categories: s.categories.map((x) => x.id === c.id ? { ...x, name } : x) })} />
            {ALL.map((k) => !s.show[k]
              ? <span key={k} className="col-dash">—</span>
              : <InlineEdit key={k} numeric value={Number(f[k].toFixed(2))} negative={f[k] < 0} label={`Edit ${c.name} ${k}`} onSave={(value) => up({ categories: s.categories.map((x) => x.id === c.id ? editRemaining(x, s.txns, today, s.payDay, k, Number(value)) : x) })} />)}
          </div>
        </div>)}
      </div>
    </section>,
    breakdown: <section aria-label="Bottom Breakdown" className="mt-6">
      <h2 className="section-heading mb-2">Breakdown</h2>
      <div className="rounded-2xl border bg-secondary p-4 text-sm elevate">
        <Line label="Income" v={s.income} />
        <Line label="Bills" v={-billsT} />
        <Line label="Pots" v={-potsT} />
        <Line label="Spending categories" v={-catT} />
        <div className="mt-2 border-t border-border pt-2"><Line label="Unallocated" v={unalloc} bold /></div>
      </div>
    </section>,
  };
  return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24 pt-8">
    {s.layout.map((id) => <div key={id} data-block={id} className="mb-5">{blocks[id]}</div>)}
  </main>;
}

function Line({ label, v, bold }: { label: string; v: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className={`tnum ${v < 0 && bold ? "text-destructive" : ""}`}>{money(v)}</span>
    </div>
  );
}

function Spend({ s, up, today }: { s: State; up: (p: Partial<State>) => void; today: Date }) {
  const [cat, setCat] = useState(s.categories[0]?.id ?? "");
  const [amt, setAmt] = useState("");
  const [when, setWhen] = useState(iso(today));
  const add = () => {
    const a = parseFloat(amt);
    const c = s.categories.find((x) => x.id === cat) ?? s.categories[0];
    if (!a || !c) return;
    const d = when && when <= iso(today) ? when : iso(today);
    up({ txns: [{ id: uid(), catId: c.id, amount: a, date: d }, ...s.txns] });
    setAmt(""); setWhen(iso(today));
  };
  return (
    <section className="mt-4">
      <h2 className="section-heading mb-2">Add Transaction</h2>
      <div className="rounded-2xl border bg-card p-3 elevate">
        <div className="flex gap-2">
          <input inputMode="decimal" aria-label="Transaction amount" placeholder="£0.00" value={amt} onChange={(e) => setAmt(e.target.value)}
            className="w-24 rounded-xl border bg-background px-3 py-2 tnum font-semibold outline-none focus:ring-2 focus:ring-ring" />
          <select aria-label="Spending category" value={cat} onChange={(e) => setCat(e.target.value)} className="flex-1 rounded-xl border bg-background px-3 py-2 font-medium">
            {s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button onClick={add} className="rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Add</Button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0">Date</span>
          <input type="date" value={when} max={iso(today)} onChange={(e) => setWhen(e.target.value)}
            className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none" />
        </label>
      </div>
    </section>
  );
}

export function BudgetSettings() {
  const { s, up } = useBudget();
  if (!s) return <main className="min-h-screen" />;
  const num = (v: string) => parseFloat(v) || 0;
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">Settings</h1>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Pay day (1–31)">
            <input type="number" min={1} max={31} value={s.payDay} onChange={(e) => up({ payDay: Math.min(31, Math.max(1, num(e.target.value))) })} className="inp" />
          </Field>
          <Field label="Monthly income">
            <input inputMode="decimal" defaultValue={s.income} onBlur={(e) => up({ income: num(e.target.value) })} className="inp" />
          </Field>
        </div>

        <h3 className="mt-6 font-semibold">Appearance</h3>
        <p className="text-xs text-muted-foreground">Pick a colour scheme for the whole app.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {THEMES.map((t) => <button key={t.id} type="button" onClick={() => up({ theme: t.id })} aria-pressed={s.theme === t.id}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${s.theme === t.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}>
            <span className="size-4 rounded-full" style={{ background: t.swatch }} aria-hidden />
            {t.name}
          </button>)}
        </div>

        <LayoutEditor layout={s.layout} onSave={(layout) => up({ layout })} />

        <h3 className="mt-6 font-semibold">Spending categories</h3>
        <p className="text-xs text-muted-foreground">Starting balance overrides the monthly amount for this pay month (e.g. starting mid-month).</p>
        <div className="mt-2 space-y-2">
          {s.categories.map((c) => (
            <CatRow key={c.id} name={c.name} monthly={c.monthly} start={c.start ?? null}
              onChange={(p) => up({ categories: s.categories.map((x) => (x.id === c.id ? { ...x, ...p } : x)) })}
              onDelete={() => up({ categories: s.categories.filter((x) => x.id !== c.id) })} />
          ))}
          <Button variant="ghost" onClick={() => up({ categories: [...s.categories, { id: uid(), name: "New category", monthly: 0 }] })}
            className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Add category</Button>
        </div>

        <Items title="Bills" items={s.bills} set={(bills) => up({ bills })} />
        <Items title="Pots" items={s.pots} set={(pots) => up({ pots })} />

        <Button variant="ghost" onClick={() => { if (confirm("Clear all spending?")) up({ txns: [] }); }} className="mt-8 text-sm font-semibold text-destructive">Clear all spending</Button>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-muted-foreground">{label}<div className="mt-1 text-foreground">{children}</div></label>;
}

function CatRow({ name, monthly, start, onChange, onDelete }: {
  name: string; monthly: number; start: number | null;
  onChange: (p: { name?: string; monthly?: number; start?: number | null }) => void; onDelete: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [n, setN] = useState(name);
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        {edit ? (
          <>
            <input autoFocus value={n} onChange={(e) => setN(e.target.value)} className="inp flex-1" />
            <Button variant="ghost" aria-label="Save name" onClick={() => { onChange({ name: n.trim() || name }); setEdit(false); }}><Check className="h-4 w-4" /></Button>
          </>
        ) : (
          <>
            <span className="flex-1 font-semibold">{name}</span>
            <Button variant="ghost" aria-label="Rename" onClick={() => setEdit(true)} className="text-muted-foreground"><Pencil className="h-4 w-4" /></Button>
          </>
        )}
        <Button variant="ghost" aria-label="Delete" onClick={() => confirm(`Delete ${name}?`) && onDelete()} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="Monthly">
          <input inputMode="decimal" defaultValue={monthly} onBlur={(e) => onChange({ monthly: parseFloat(e.target.value) || 0 })} className="inp" />
        </Field>
        <Field label="Starting balance">
          <input inputMode="decimal" placeholder="—" defaultValue={start ?? ""} onBlur={(e) => onChange({ start: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })} className="inp" />
        </Field>
      </div>
    </div>
  );
}

function Items({ title, items, set }: { title: string; items: LineItem[]; set: (i: LineItem[]) => void }) {
  return (
    <>
      <h3 className="mt-6 font-semibold">{title}</h3>
      <div className="mt-2 space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2">
            <input defaultValue={it.name} onBlur={(e) => set(items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))} className="inp flex-1" />
            <input inputMode="decimal" defaultValue={it.amount} onBlur={(e) => set(items.map((x) => (x.id === it.id ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))} className="inp w-24" />
            <Button variant="ghost" aria-label="Delete" onClick={() => set(items.filter((x) => x.id !== it.id))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => set([...items, { id: uid(), name: `New ${title.toLowerCase().slice(0, -1)}`, amount: 0 }])}
          className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="h-4 w-4" /> Add</Button>
      </div>
    </>
  );
}

export function BudgetOverview() {
  const { s, up } = useBudget();
  const today = useMemo(() => new Date(), []);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  if (!s) return <main className="min-h-screen" />;

  const period = payPeriod(today, s.payDay);
  const rows = s.categories.map((c) => ({ c, f: figures(c, s.txns, today, s.payDay) }));
  const weeks = overviewWeeks(s.categories, s.txns, today, s.payDay);
  const top = resolveTopPeriod(s.topMode, s.show, s.activePeriod);
  const chooseTop = (mode: TopMode) => {
    if (mode === "auto") { up({ topMode: "auto" }); return; }
    up({ topMode: mode, activePeriod: mode });
  };
  const selected = openWeek !== null ? weeks[openWeek] ?? null : null;

  return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-8">
    <header className="mb-8">
      <p className="text-xs font-semibold text-muted-foreground">{fmtD(period.start)} – {fmtD(period.end)}</p>
      <h1 className="font-display text-3xl font-bold">Overview</h1>
      <p className="figure-num mt-2 text-5xl" aria-label="Safe to spend total">{money(summaryTotal(rows.map((r) => r.f), top))}</p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Overview top figure period">
        {TOP_MODES.map((m) => <button key={m} type="button" onClick={() => chooseTop(m)} aria-pressed={s.topMode === m}
          className={`pill capitalize ${s.topMode === m ? "pill-on" : ""}`}>{m}</button>)}
      </div>
    </header>

    <h2 className="section-heading mb-2">This pay period</h2>
    <p className="mb-3 text-sm text-muted-foreground">Tap a week to see its categories and transactions.</p>
    <div className="space-y-2">
      {weeks.map((w, i) => (
        <button key={iso(w.start)} type="button" onClick={() => setOpenWeek(i)}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors elevate ${w.current ? "border-primary bg-primary/5" : w.past ? "bg-muted/60" : "bg-card hover:border-primary/50"}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{fmtD(w.start)} – {fmtD(w.end)}</p>
              {w.current && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Current</span>}
              {w.past && <span className="text-xs font-semibold text-muted-foreground">Past</span>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{w.days} day{w.days > 1 ? "s" : ""} &middot; {w.txns.length} transaction{w.txns.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="figure-num text-2xl">{money(w.total)}</p>
              <p className="text-xs text-muted-foreground">available</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>

    <Dialog open={openWeek !== null} onOpenChange={(o) => { if (!o) setOpenWeek(null); }}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] rounded-lg">
        {selected && <WeekDetail week={selected} s={s} up={up} today={today} />}
      </DialogContent>
    </Dialog>
  </main>;
}

function WeekDetail({ week, s, up, today }: {
  week: ReturnType<typeof overviewWeeks>[number];
  s: State;
  up: (p: Partial<State>) => void;
  today: Date;
}) {
  const [cat, setCat] = useState(s.categories[0]?.id ?? "");
  const [amt, setAmt] = useState("");
  const add = () => {
    const a = parseFloat(amt);
    const c = s.categories.find((x) => x.id === cat) ?? s.categories[0];
    if (!a || !c) return;
    const d = iso(week.start);
    up({ txns: [{ id: uid(), catId: c.id, amount: a, date: d }, ...s.txns] });
    setAmt("");
  };
  const delTxn = (id: string) => up({ txns: s.txns.filter((x) => x.id !== id) });
  return (
    <>
      <DialogTitle className="font-display text-xl">{fmtD(week.start)} – {fmtD(week.end)}</DialogTitle>
      <DialogDescription>{week.days} day{week.days > 1 ? "s" : ""} &middot; {week.txns.length} transaction{week.txns.length === 1 ? "" : "s"}</DialogDescription>

      <div className="rounded-xl bg-secondary p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Available this week</span>
          <span className="figure-num text-2xl">{money(week.total)}</span>
        </div>
      </div>

      <h3 className="mt-4 text-sm font-semibold">Categories</h3>
      <div className="mt-2 space-y-1">
        {week.byCat.map(({ cat, left, budget, spent }) => (
          <div key={cat.id} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{cat.name}</p>
              <p className="text-xs text-muted-foreground">{money(spent)} spent of {money(budget)}</p>
            </div>
            <span className="figure-num ml-2 shrink-0 text-base">{money(left)}</span>
          </div>
        ))}
      </div>

      <h3 className="mt-4 text-sm font-semibold">Transactions this week</h3>
      <div className="mt-2 rounded-xl border bg-card px-3">
        {week.txns.length ? <ul className="divide-y">
          {week.txns.map((t) => {
            const category = s.categories.find((c) => c.id === t.catId)?.name ?? "Deleted category";
            const date = parse(t.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
            return <li key={t.id} className="flex min-h-12 items-center gap-2 py-2">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{category}</p><time dateTime={t.date} className="text-xs text-muted-foreground">{date}</time></div>
              <span className="tnum shrink-0 text-sm font-semibold">{money(t.amount)}</span>
              <Button variant="ghost" size="icon" aria-label={`Delete ${category} transaction`} className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => delTxn(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>;
          })}
        </ul> : <p className="py-3 text-sm text-muted-foreground">No transactions this week</p>}
      </div>

      <h3 className="mt-4 text-sm font-semibold">Add to this week</h3>
      <div className="mt-2 flex gap-2">
        <input inputMode="decimal" aria-label="Transaction amount" placeholder="£0.00" value={amt} onChange={(e) => setAmt(e.target.value)}
          className="w-24 rounded-xl border bg-background px-3 py-2 tnum font-semibold outline-none focus:ring-2 focus:ring-ring" />
        <select aria-label="Spending category" value={cat} onChange={(e) => setCat(e.target.value)} className="flex-1 rounded-xl border bg-background px-3 py-2 font-medium">
          {s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button onClick={add} className="rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Add</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Dated {fmtD(week.start)}. Past weeks can hold back-dated entries.</p>
    </>
  );
}

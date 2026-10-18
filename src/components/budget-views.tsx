import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/budget-inline-edit";
import { LayoutEditor } from "@/components/budget-layout-editor";
import { useBudget } from "@/components/budget-provider";
import { RecentTransactions } from "@/components/budget-transactions";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Check, ChevronRight, Lock, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  figures, iso, money, payPeriod, uid, editRemaining, summaryTotal, selectVisiblePeriod, resolveTopPeriod,
  overviewWeeks, THEMES, DENSITIES, safeToSpend, parse,
  type State, type LineItem, type Period, type TopMode,
} from "@/lib/budget";

const ALL = ["daily", "weekly", "monthly"] as const;
const TOP_MODES: TopMode[] = ["daily", "weekly", "monthly", "auto"];
const fmtD = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
// Fixed equal columns for daily/weekly/monthly — widths never change when toggled.
const COLS = "minmax(6.5rem, 1.5fr) repeat(3, minmax(0, 1fr))";

export function Dashboard() {
  const { s, up } = useBudget();
  const today = useMemo(() => new Date(), []);
  if (!s) return <div className="min-h-screen" />;

  const period = payPeriod(today, s.payDay);
  const rows = s.categories.map((c) => ({ c, f: figures(c, s.txns, today, s.payDay) }));
  const pot = safeToSpend(s);
  const leftToAllocate = Math.max(0, pot - s.categories.reduce((a, c) => a + (c.start ?? c.monthly), 0));
  const currentWeek = rows[0]?.f.weeks.find((w) => w.current);

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
  // Capped edit: the new allocation can never push the category total past the pot.
  const editCapped = (id: string, period: Period, value: number) => {
    const candidate = editRemaining(
      s.categories.find((c) => c.id === id)!, s.txns, today, s.payDay, period, value,
    );
    const total = s.categories.reduce((a, c) => a + (c.id === id ? 0 : (c.start ?? c.monthly)), 0)
      + (candidate.start ?? candidate.monthly);
    const excess = Math.max(0, total - pot);
    const start = Math.max(0, (candidate.start ?? candidate.monthly) - excess);
    up({ categories: s.categories.map((c) => c.id === id ? { ...candidate, start } : c) });
  };
  const addCategory = () =>
    up({ categories: [...s.categories, { id: uid(), name: "New category", monthly: 0 }] });
  const deleteCategory = (id: string, name: string) => {
    if (!confirm(`Delete ${name}? Its transactions stay in your history.`)) return;
    up({ categories: s.categories.filter((c) => c.id !== id) });
  };
  const blocks = {
    summary: <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{fmtD(period.start)} &ndash; {fmtD(period.end)}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text font-display text-3xl font-medium tracking-tight text-transparent">Safe to spend</h1>
          {currentWeek && <p className="tnum rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Week {fmtD(currentWeek.start)} &ndash; {fmtD(currentWeek.end)}
          </p>}
        </div>
        <p className="figure-num mt-3 text-5xl" aria-label="Safe to spend total">{money(summaryTotal(rows.map((r) => r.f), top))}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Top figure period">
          {TOP_MODES.map((m) => <button key={m} type="button" onClick={() => chooseTop(m)} aria-pressed={s.topMode === m}
            className={`pill capitalize ${s.topMode === m ? "pill-on" : ""}`}>{m}</button>)}
          {s.manualSpend !== null && <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Lock className="size-3" /> own amount</span>}
        </div>
      </div>
    </header>,
    spend: <><Spend s={s} up={up} today={today} /><RecentTransactions s={s} up={up} /></>,
    table: <section aria-label="Safe to spend table" className="mt-10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="section-heading">Safe to Spend</h2>
        {leftToAllocate > 0 && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
          {money(leftToAllocate)} left to allocate
        </span>}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card elevate">
        <div className="budget-grid grid items-center gap-1 border-b bg-muted px-3 py-2" style={{ gridTemplateColumns: COLS }}>
          <span className="text-xs font-semibold text-muted-foreground">Show columns</span>
          {ALL.map((k) => <span key={k} className="flex justify-center">
            <button type="button" onClick={() => toggle(k)} aria-pressed={s.show[k]} aria-label={`${s.show[k] ? "Hide" : "Show"} ${k} column`}
              disabled={s.show[k] && visible.length === 1}
              className={`pill capitalize ${s.show[k] ? "pill-on" : ""}`}>{k}</button>
          </span>)}
        </div>
        {rows.map(({ c }) => <div key={c.id} className="border-b last:border-0">
          <div className="budget-grid budget-row grid items-center gap-1 px-3" style={{ gridTemplateColumns: COLS }}>
            <div className="flex min-w-0 items-center gap-0.5">
              <div className="min-w-0 flex-1">
                <InlineEdit value={c.name} label={`Edit ${c.name} name`} onSave={(name) => up({ categories: s.categories.map((x) => x.id === c.id ? { ...x, name } : x) })} />
              </div>
              <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} title={`Delete ${c.name}`}
                className="size-8 shrink-0 text-muted-foreground/50 hover:text-destructive"
                onClick={() => deleteCategory(c.id, c.name)}><Trash2 className="size-3.5" /></Button>
            </div>
            {ALL.map((k) => !s.show[k]
              ? <span key={k} className="col-dash">—</span>
              : <InlineEdit key={k} numeric value={Number(figures(c, s.txns, today, s.payDay)[k].toFixed(2))} negative={figures(c, s.txns, today, s.payDay)[k] < 0} label={`Edit ${c.name} ${k}`} onSave={(value) => editCapped(c.id, k, Number(value))} />)}
          </div>
        </div>)}
        <div className="px-3 py-2">
          <Button variant="ghost" onClick={addCategory} className="flex items-center gap-1 text-sm font-semibold text-primary">
            <Plus className="size-4" /> Add category
          </Button>
        </div>
      </div>
      {leftToAllocate > 0 && <p className="mt-2 text-xs text-muted-foreground">
        Tap a figure to edit it. You have {money(leftToAllocate)} of your {money(pot)} pot still to hand out.
      </p>}
    </section>,
    breakdown: <section aria-label="Bottom Breakdown" className="mt-6">
      <h2 className="section-heading mb-2">Breakdown</h2>
      <div className="card-pad rounded-2xl border bg-secondary text-sm elevate">
        <Line label="Income" v={s.income} />
        <Line label="Bills" v={-s.bills.reduce((a, b) => a + b.amount, 0)} />
        <Line label="Pots" v={-s.pots.reduce((a, b) => a + b.amount, 0)} />
        <Line label="Safe to spend pot" v={pot} bold />
      </div>
    </section>,
  };
  return <main className="mx-auto min-h-screen max-w-2xl px-[var(--page-pad)] pb-24 pt-8">
    {s.layout.map((id) => <div key={id} data-block={id} className="mb-[var(--block-gap)]">{blocks[id]}</div>)}
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
      <div className="card-pad rounded-2xl border bg-card elevate">
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
  const { s, up, reset } = useBudget();
  if (!s) return <main className="min-h-screen" />;
  const num = (v: string) => parseFloat(v) || 0;
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-[var(--page-pad)] pb-28 pt-8">
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

        <h3 className="mt-6 font-semibold">Your Safe to Spend amount</h3>
        <p className="text-xs text-muted-foreground">Leave blank to work it out automatically from income minus bills and pots. Set a number to lock your own amount — bills can change later without touching it.</p>
        <div className="mt-2">
          <input inputMode="decimal" placeholder="Automatic" defaultValue={s.manualSpend ?? ""} onBlur={(e) => up({ manualSpend: e.target.value === "" ? null : num(e.target.value) })} className="inp" />
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

        <h3 className="mt-6 font-semibold">Spacing</h3>
        <p className="text-xs text-muted-foreground">How much breathing room you want around tables and cards. Changes page margins, gaps between sections and padding inside cards.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DENSITIES.map((d) => <button key={d.id} type="button" onClick={() => up({ density: d.id })} aria-pressed={s.density === d.id}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${s.density === d.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}>
            {d.name}
          </button>)}
        </div>

        <LayoutEditor layout={s.layout} onSave={(layout) => up({ layout })} />

        <Items title="Bills" items={s.bills} set={(bills) => up({ bills })} />
        <Items title="Pots" items={s.pots} set={(pots) => up({ pots })} />

        <div className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <h3 className="font-semibold text-destructive">Start over</h3>
          <p className="mt-1 text-sm text-muted-foreground">Erase everything — categories, transactions, bills, pots, pay day and income — and return to the welcome screen.</p>
          <Button variant="destructive"
            onClick={() => { if (confirm("Erase all data and start over? This cannot be undone.")) reset(); }}
            className="mt-3 rounded-xl font-semibold">
            Reset everything
          </Button>
        </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-foreground">{label}<div className="mt-1.5">{children}</div></label>;
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

export function Onboarding() {
  const { s, up } = useBudget();
  const [mode, setMode] = useState<"choose" | "simple" | "bills" | "payday" | "payday-bills" | "payday-simple">("choose");
  const [spend, setSpend] = useState("");
  const [income, setIncome] = useState("");
  const [payDay, setPayDay] = useState(25);
  const [bills, setBills] = useState<LineItem[]>([{ id: uid(), name: "Rent", amount: 0 }]);
  if (!s) return <main className="min-h-screen" />;
  const num = (v: string) => parseFloat(v) || 0;

  const doneSimple = () => {
    const v = num(spend);
    if (v <= 0) return;
    setMode("payday-simple");
  };
  const doneBills = () => {
    const inc = num(income);
    const clean = bills.filter((b) => b.name.trim() && b.amount > 0);
    if (inc <= 0) return;
    setMode("payday-bills");
  };
  const finish = (withManual: number | null) => {
    up({ payDay, manualSpend: withManual, onboarded: true,
      ...(withManual === null ? { income: num(income), bills: bills.filter((b) => b.name.trim() && b.amount > 0) } : {}) });
  };

  return <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 pb-16 pt-8">
    {mode === "choose" && <>
      <div className="flex items-center gap-2">
        <Sparkles className="size-6 text-primary" />
        <h1 className="font-display text-3xl font-bold">Welcome</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">There are two ways to use Safe to Spend. You can change your mind later in Settings.</p>
      <div className="mt-6 space-y-3">
        <button type="button" onClick={() => setMode("simple")}
          className="w-full rounded-2xl border bg-card p-4 text-left elevate transition-colors hover:border-primary/50">
          <p className="font-semibold">I know my safe to spend</p>
          <p className="mt-1 text-sm text-muted-foreground">Set one amount for the month. No bills needed — you can add them later without it changing.</p>
        </button>
        <button type="button" onClick={() => setMode("bills")}
          className="w-full rounded-2xl border bg-card p-4 text-left elevate transition-colors hover:border-primary/50">
          <p className="font-semibold">Work it out from my bills</p>
          <p className="mt-1 text-sm text-muted-foreground">Enter your pay and recurring bills for the month, and we work out what is safe to spend. Then hand it out to categories.</p>
        </button>
      </div>
    </>}

    {mode === "simple" && <>
      <h1 className="font-display text-3xl font-bold">Your monthly amount</h1>
      <p className="mt-2 text-sm text-muted-foreground">This becomes your Safe to Spend pot. You can hand it out to categories on the Dashboard.</p>
      <input autoFocus inputMode="decimal" placeholder="£0.00" value={spend} onChange={(e) => setSpend(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") doneSimple(); }}
        className="figure-num mt-6 w-full rounded-2xl border bg-card px-4 py-4 text-center text-4xl outline-none focus:ring-2 focus:ring-ring" />
      <Button onClick={doneSimple} className="mt-4 h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground">Next: set pay day</Button>
      <Button variant="ghost" onClick={() => setMode("choose")} className="mt-2 text-sm text-muted-foreground">Back</Button>
    </>}

    {mode === "payday-simple" && <>
      <h1 className="font-display text-3xl font-bold">When are you paid?</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pick the day of the month your pay lands. Weeks on the Dashboard line up from here.</p>
      <PayDayPicker value={payDay} onChange={setPayDay} />
      <Button onClick={() => finish(num(spend))} className="mt-4 h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground">Start budgeting</Button>
      <Button variant="ghost" onClick={() => finish(num(spend))} className="mt-2 text-sm text-muted-foreground">Set one later</Button>
    </>}

    {mode === "payday-bills" && <>
      <h1 className="font-display text-3xl font-bold">When are you paid?</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pick the day of the month your pay lands. Weeks on the Dashboard line up from here.</p>
      <PayDayPicker value={payDay} onChange={setPayDay} />
      <Button onClick={() => finish(null)} className="mt-4 h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground">Start budgeting</Button>
      <Button variant="ghost" onClick={() => finish(null)} className="mt-2 text-sm text-muted-foreground">Set one later</Button>
    </>}

    {mode === "bills" && <>
      <h1 className="font-display text-3xl font-bold">Pay and bills</h1>
      <p className="mt-2 text-sm text-muted-foreground">Everything you keep aside comes off the top — what is left is safe to spend.</p>
      <div className="mt-6">
        <Field label="Monthly pay">
          <input autoFocus inputMode="decimal" placeholder="£0.00" value={income} onChange={(e) => setIncome(e.target.value)} className="inp" />
        </Field>
      </div>
      <h3 className="mt-4 text-sm font-semibold">Recurring bills this month</h3>
      <div className="mt-2 space-y-2">
        {bills.map((b) => (
          <div key={b.id} className="flex items-center gap-2">
            <input placeholder="Name" defaultValue={b.name} onBlur={(e) => setBills(bills.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))} className="inp flex-1" />
            <input inputMode="decimal" placeholder="£0.00" defaultValue={b.amount || ""} onBlur={(e) => setBills(bills.map((x) => x.id === b.id ? { ...x, amount: num(e.target.value) } : x))} className="inp w-24" />
            <Button variant="ghost" size="icon" aria-label="Remove bill" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setBills(bills.filter((x) => x.id !== b.id))}><Trash2 className="size-4" /></Button>
          </div>
        ))}
        <Button variant="ghost" onClick={() => setBills([...bills, { id: uid(), name: "", amount: 0 }])}
          className="flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="size-4" /> Add bill</Button>
      </div>
      <Button onClick={doneBills} className="mt-4 h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground">Work out my safe to spend</Button>
      <Button variant="ghost" onClick={() => setMode("choose")} className="mt-2 text-sm text-muted-foreground">Back</Button>
    </>}
  </main>;
}

function PayDayPicker({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  return <div className="mt-4">
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
        <button key={day} type="button" onClick={() => onChange(day)} aria-pressed={value === day}
          className={`tnum rounded-lg border py-2 text-sm font-semibold transition-colors ${value === day
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card hover:border-primary/50"}`}>
          {day}
        </button>
      ))}
    </div>
  </div>;
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

  return <main className="mx-auto min-h-screen max-w-2xl px-[var(--page-pad)] pb-28 pt-8">
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
          className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all elevate ${w.current
            ? "border-primary bg-primary text-primary-foreground shadow-lg"
            : w.past ? "border-border bg-muted/60 text-muted-foreground" : "border-border bg-card hover:border-primary/50"}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-semibold ${w.current ? "text-base" : ""}`}>{fmtD(w.start)} – {fmtD(w.end)}</p>
              {w.current && <span className="rounded-full bg-primary-foreground/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">This week</span>}
              {w.past && <span className="text-xs font-semibold">Past</span>}
            </div>
            <p className={`mt-1 text-xs ${w.current ? "text-primary-foreground/80" : ""}`}>{w.days} day{w.days > 1 ? "s" : ""} &middot; {w.txns.length} transaction{w.txns.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className={`figure-num ${w.current ? "text-3xl" : "text-2xl"}`}>{money(w.total)}</p>
              <p className={`text-xs ${w.current ? "text-primary-foreground/80" : "text-muted-foreground"}`}>available</p>
            </div>
            <ChevronRight className="size-5 shrink-0 opacity-70" />
          </div>
        </button>
      ))}
    </div>

    <Dialog open={openWeek !== null} onOpenChange={(o) => { if (!o) setOpenWeek(null); }}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] rounded-lg">
        {selected && <WeekDetail week={selected} s={s} up={up} />}
      </DialogContent>
    </Dialog>
  </main>;
}

function WeekDetail({ week, s, up }: {
  week: ReturnType<typeof overviewWeeks>[number];
  s: State;
  up: (p: Partial<State>) => void;
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
              <Button variant="ghost" size="icon" aria-label={`Delete ${category} transaction`} className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => delTxn(t.id)}><Trash2 className="size-4" /></Button>
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

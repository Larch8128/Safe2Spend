export type Category = { id: string; name: string; monthly: number; start?: number | null };
export type Txn = { id: string; catId: string; amount: number; date: string; note?: string };
export type LineItem = { id: string; name: string; amount: number };
export type Period = "daily" | "weekly" | "monthly";
export type TopMode = Period | "auto";
export type ThemeId = "sage" | "ocean" | "sunset" | "slate" | "dark";
export type Theme = { id: ThemeId; name: string; swatch: string };
export const THEMES: Theme[] = [
  { id: "sage", name: "Sage", swatch: "oklch(0.34 0.08 160)" },
  { id: "ocean", name: "Ocean", swatch: "oklch(0.4 0.11 230)" },
  { id: "sunset", name: "Sunset", swatch: "oklch(0.6 0.18 30)" },
  { id: "slate", name: "Slate", swatch: "oklch(0.4 0.03 250)" },
  { id: "dark", name: "Midnight", swatch: "oklch(0.2 0.03 250)" },
];
export const BLOCKS = ["summary", "spend", "table", "breakdown"] as const;
export type Block = typeof BLOCKS[number];
export type Density = "comfortable" | "default" | "compact";
export const DENSITIES: { id: Density; name: string }[] = [
  { id: "comfortable", name: "Comfortable" },
  { id: "default", name: "Default" },
  { id: "compact", name: "Compact" },
];
export type State = {
  activePeriod: Period;
  topMode: TopMode;
  theme: ThemeId;
  density: Density;
  onboarded: boolean;
  manualSpend: number | null;
  layout: Block[];
  payDay: number;
  income: number;
  bills: LineItem[];
  pots: LineItem[];
  categories: Category[];
  txns: Txn[];
  show: { daily: boolean; weekly: boolean; monthly: boolean };
  showWeeks: boolean;
};

/** Safe to Spend pot: a locked manual amount, or income minus bills minus pots. */
export function safeToSpend(s: Pick<State, "income" | "bills" | "pots" | "manualSpend">) {
  if (s.manualSpend !== null) return s.manualSpend;
  const bills = s.bills.reduce((a, b) => a + b.amount, 0);
  const pots = s.pots.reduce((a, b) => a + b.amount, 0);
  return s.income - bills - pots;
}

/** Total monthly amount currently assigned to categories. */
export function allocatedTotal(cats: Category[]) {
  return cats.reduce((a, c) => a + (c.start ?? c.monthly), 0);
}

/** Cap a category edit so total allocation never exceeds the Safe to Spend pot. */
export function capAllocation(
  cats: Category[],
  editedId: string,
  desired: number,
  pot: number,
): Category[] {
  const others = cats.filter((c) => c.id !== editedId).reduce((a, c) => a + (c.start ?? c.monthly), 0);
  const max = Math.max(0, pot - others);
  return cats.map((c) => c.id === editedId ? { ...c, monthly: Math.min(desired, max) } : c);
}

const DAY = 86400000;
export const d0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parse = (s: string) => {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const days = (a: Date, b: Date) => Math.round((d0(b).getTime() - d0(a).getTime()) / DAY);

function clampDay(y: number, m: number, day: number) {
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}

/** Pay period containing `today`: [start, end] inclusive. */
export function payPeriod(today: Date, payDay: number) {
  const t = d0(today);
  let start = clampDay(t.getFullYear(), t.getMonth(), payDay);
  if (start > t) start = clampDay(t.getFullYear(), t.getMonth() - 1, payDay);
  const next = clampDay(start.getFullYear(), start.getMonth() + 1, payDay);
  return { start, end: new Date(next.getTime() - DAY), length: days(start, next) };
}

/** Monday–Sunday weeks clipped to the pay period (part weeks at the edges). */
export function weeksOf(start: Date, end: Date) {
  const out: { start: Date; end: Date; days: number }[] = [];
  let s = d0(start);
  while (s <= end) {
    const dow = (s.getDay() + 6) % 7;
    let e = new Date(s.getTime() + (6 - dow) * DAY);
    if (e > end) e = d0(end);
    out.push({ start: s, end: e, days: days(s, e) + 1 });
    s = new Date(e.getTime() + DAY);
  }
  return out;
}

export type Figures = {
  monthly: number;
  weekly: number;
  daily: number;
  weeks: { start: Date; end: Date; days: number; budget: number; spent: number; left: number; current: boolean }[];
};

/** Dynamic split: each week gets (balance left at its start) × its days / days remaining. */
export function figures(cat: Category, txns: Txn[], today: Date, payDay: number): Figures {
  const t = d0(today);
  const p = payPeriod(t, payDay);
  const budget = cat.start ?? cat.monthly;
  const mine = txns.filter((x) => x.catId === cat.id).map((x) => ({ ...x, d: parse(x.date) }))
    .filter((x) => x.d >= p.start && x.d <= p.end);
  const spentIn = (a: Date, b: Date) => mine.filter((x) => x.d >= a && x.d <= b).reduce((s, x) => s + x.amount, 0);
  const totalSpent = spentIn(p.start, p.end);
  let before = 0;
  const weeks = weeksOf(p.start, p.end).map((w) => {
    const remainingDays = days(w.start, p.end) + 1;
    const isPast = w.end < t;
    const isCurrent = w.start <= t && t <= w.end;
    // future weeks use balance after everything spent so far
    const base = isPast || isCurrent ? budget - before : budget - totalSpent;
    const daysFromNow = isPast || isCurrent ? remainingDays : remainingDays;
    let wb = (base * w.days) / daysFromNow;
    if (!isPast && !isCurrent) {
      const fromToday = days(t, p.end) + 1;
      const curWeekEnd = weeksOf(p.start, p.end).find((x) => x.start <= t && t <= x.end)?.end ?? p.end;
      const restDays = days(curWeekEnd, p.end);
      const curLeft = budget - totalSpent;
      wb = restDays > 0 ? (Math.max(0, curLeft - curWeekLeftShare(curLeft, days(t, curWeekEnd) + 1, fromToday)) * w.days) / restDays : 0;
    }
    const spent = spentIn(w.start, w.end);
    before += spent;
    return { ...w, budget: wb, spent, left: wb - spent, current: isCurrent };
  });
  const cur = weeks.find((w) => w.current);
  // Daily is always the (remaining) weekly figure divided by 7, so it moves
  // in lockstep with the week: a £20 spend drops weekly £20 and daily £20/7.
  const weekly = cur?.left ?? 0;
  const daily = weekly / 7;
  return { monthly: budget - totalSpent, weekly, daily, weeks };
}
/** Change the pay-period starting balance, retaining spending history. */
export function editRemaining(cat: Category, txns: Txn[], today: Date, payDay: number, period: Period, value: number): Category {
  if (!Number.isFinite(value)) return cat;
  const zero = figures({ ...cat, start: 0 }, txns, today, payDay)[period];
  const one = figures({ ...cat, start: 1 }, txns, today, payDay)[period];
  const slope = one - zero;
  if (Math.abs(slope) < Number.EPSILON) return cat;
  return { ...cat, start: (value - zero) / slope };
}

export function selectVisiblePeriod(show: State["show"], active: Period): Period {
  return show[active] ? active : (["daily", "weekly", "monthly"] as const).find((p) => show[p]) ?? active;
}

/** Resolve which period the top Safe to Spend figure should display. */
export function resolveTopPeriod(mode: TopMode, show: State["show"], active: Period): Period {
  if (mode !== "auto") return mode;
  const visible = (["daily", "weekly", "monthly"] as const).filter((k) => show[k]);
  return visible.length === 1 ? visible[0] : selectVisiblePeriod(show, active);
}

export function summaryTotal(rows: Figures[], period: Period) {
  return rows.reduce((sum, row) => sum + row[period], 0);
}

/** Newest transaction dates first; equal dates retain their logged order. */
export function transactionHistory(txns: Txn[], limit?: number) {
  const sorted = [...txns].sort((a, b) => b.date.localeCompare(a.date));
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

/** Pay-period weeks aggregated across all categories, for the Overview tab. */
export function overviewWeeks(
  cats: Category[],
  txns: Txn[],
  today: Date,
  payDay: number,
) {
  const t = d0(today);
  const p = payPeriod(t, payDay);
  const weeks = weeksOf(p.start, p.end);
  return weeks.map((w) => {
    const isPast = w.end < t;
    const isCurrent = w.start <= t && t <= w.end;
    let total = 0;
    const byCat: { cat: Category; left: number; budget: number; spent: number }[] = [];
    for (const c of cats) {
      const f = figures(c, txns, t, payDay);
      const wk = f.weeks.find((x) => x.start.getTime() === w.start.getTime());
      const left = wk?.left ?? 0;
      const budget = wk?.budget ?? 0;
      const spent = wk?.spent ?? 0;
      total += left;
      byCat.push({ cat: c, left, budget, spent });
    }
    const periodTxns = txns
      .filter((x) => { const d = parse(x.date); return d >= w.start && d <= w.end; })
      .sort((a, b) => b.date.localeCompare(a.date));
    return { ...w, total, byCat, txns: periodTxns, current: isCurrent, past: isPast };
  });
}

function curWeekLeftShare(left: number, curDays: number, totalDays: number) {
  return (left * curDays) / totalDays;
}

export const money = (n: number) =>
  (n < 0 ? "-£" : "£") + Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultState = (): State => ({
  activePeriod: "weekly",
  topMode: "auto",
  theme: "sage",
  density: "comfortable",
  onboarded: false,
  manualSpend: null,
  layout: [...BLOCKS],
  payDay: 25,
  income: 2500,
  bills: [{ id: uid(), name: "Rent", amount: 900 }, { id: uid(), name: "Utilities", amount: 180 }],
  pots: [{ id: uid(), name: "Savings", amount: 300 }],
  categories: [
    { id: uid(), name: "Food", monthly: 400 },
    { id: uid(), name: "Fuel", monthly: 150 },
    { id: uid(), name: "Other", monthly: 200 },
  ],
  txns: [],
  show: { daily: true, weekly: true, monthly: true },
  showWeeks: false,
});

import { describe, it, expect } from "vitest";
import { figures, payPeriod, weeksOf, editRemaining, summaryTotal, selectVisiblePeriod, transactionHistory } from "@/lib/budget";

describe("budget", () => {
  it("recent transactions shows the latest 3 by date without changing stored history", () => {
    const txns = [
      { id: "older", catId: "a", amount: 10, date: "2026-10-10" },
      { id: "newest", catId: "a", amount: 20, date: "2026-10-18" },
      { id: "third", catId: "a", amount: 30, date: "2026-10-16" },
      { id: "second", catId: "a", amount: 40, date: "2026-10-17" },
    ];
    expect(transactionHistory(txns, 3).map((t) => t.id)).toEqual(["newest", "second", "third"]);
    expect(txns[0]?.id).toBe("older");
    expect(transactionHistory(txns).map((t) => t.id)).toEqual(["newest", "second", "third", "older"]);
  });
  it("pay period runs from pay day to the day before next pay day", () => {
    const p = payPeriod(new Date(2026, 9, 18), 25);
    expect(p.start.getDate()).toBe(25);
    expect(p.start.getMonth()).toBe(8);
    expect(p.end.getDate()).toBe(24);
    expect(p.end.getMonth()).toBe(9);
  });
  it("splits into Mon-Sun weeks with part weeks at the edges", () => {
    const p = payPeriod(new Date(2026, 9, 18), 25);
    const w = weeksOf(p.start, p.end);
    expect(w.reduce((s, x) => s + x.days, 0)).toBe(p.length);
    expect(w[0]?.days).toBe(3); // Fri 25 Sep - Sun 27 Sep
  });
  it("spending reduces weekly and monthly by the same amount", () => {
    const cat = { id: "a", name: "Food", monthly: 300 };
    const today = new Date(2026, 9, 18);
    const before = figures(cat, [], today, 25);
    const after = figures(cat, [{ id: "1", catId: "a", amount: 20, date: "2026-10-18" }], today, 25);
    expect(before.monthly - after.monthly).toBeCloseTo(20);
    expect(before.weekly - after.weekly).toBeCloseTo(20);
  });
  it("daily is always the weekly figure divided by 7", () => {
    const cat = { id: "a", name: "Food", monthly: 300 };
    const today = new Date(2026, 9, 18);
    const before = figures(cat, [], today, 25);
    expect(before.daily).toBeCloseTo(before.weekly / 7);
    // £20 spend drops daily by 20/7 too
    const after = figures(cat, [{ id: "1", catId: "a", amount: 20, date: "2026-10-18" }], today, 25);
    expect(before.daily - after.daily).toBeCloseTo(20 / 7);
    expect(after.daily).toBeCloseTo(after.weekly / 7);
  });
  it.each(["daily", "weekly", "monthly"] as const)("editing %s to 70 recalculates linked values and keeps spending", (period) => {
    const cat = { id: "a", name: "Food", monthly: 300 };
    const txns = [{ id: "1", catId: "a", amount: 20, date: "2026-10-18" }];
    const today = new Date(2026, 9, 18);
    const edited = editRemaining(cat, txns, today, 25, period, 70);
    const result = figures(edited, txns, today, 25);
    expect(result[period]).toBeCloseTo(70);
    expect(result.daily).toBeCloseTo(result.weekly / 7);
    expect(result.monthly).toBeCloseTo((edited.start ?? 0) - 20);
    expect(cat.monthly).toBe(300);
    expect(txns).toEqual([{ id: "1", catId: "a", amount: 20, date: "2026-10-18" }]);
  });
  it("totals the selected column across categories", () => {
    const today = new Date(2026, 9, 18);
    const rows = [300, 150].map((monthly, i) => figures({ id: String(i), name: "Category", monthly }, [], today, 25));
    expect(summaryTotal(rows, "monthly")).toBe(450);
    expect(summaryTotal(rows, "daily")).toBeCloseTo(summaryTotal(rows, "weekly") / 7);
  });
  it("selects a visible period when the active column is hidden", () => {
    expect(selectVisiblePeriod({ daily: false, weekly: true, monthly: true }, "daily")).toBe("weekly");
    expect(selectVisiblePeriod({ daily: true, weekly: true, monthly: true }, "monthly")).toBe("monthly");
  });
});

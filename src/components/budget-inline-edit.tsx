import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/budget";

export function InlineEdit({ value, label, onSave, numeric = false, negative = false }: {
  value: string | number; label: string; onSave: (value: string) => void; numeric?: boolean; negative?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && (!numeric || Number.isFinite(Number(trimmed)))) onSave(trimmed);
    setEditing(false);
  };
  if (editing) return <input autoFocus aria-label={label} inputMode={numeric ? "decimal" : "text"}
    value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save}
    onFocus={(e) => e.target.select()}
    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false); }}
    className={`w-full min-w-0 rounded-md border bg-background px-1 py-2 text-center outline-none ring-2 ring-ring ${numeric ? "tnum" : "font-semibold"}`} />;
  return <Button variant="ghost" aria-label={label} title={label}
    onClick={() => { setDraft(String(value)); setEditing(true); }}
    className={`h-auto min-h-10 w-full min-w-0 whitespace-normal px-1 py-2 ${numeric ? "tnum justify-center text-center text-xs sm:text-sm" : "justify-start text-left font-semibold"} ${negative ? "text-destructive" : ""}`}>
    {numeric ? money(Number(value)) : value}
  </Button>;
}

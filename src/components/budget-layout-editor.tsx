import { useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Block } from "@/lib/budget";

const LABELS: Record<Block, string> = { summary: "Top Summary", table: "Safe to Spend", spend: "Add Transaction", breakdown: "Breakdown" };
function SortableBlock({ id }: { id: Block }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`relative flex items-center gap-3 rounded-lg border bg-card p-2 ${isDragging ? "z-10 ring-2 ring-ring" : ""}`}>
    <Button variant="ghost" size="icon" className="touch-none cursor-grab active:cursor-grabbing" aria-label={`Move ${LABELS[id]}`} title={`Move ${LABELS[id]}`} {...attributes} {...listeners}><GripHorizontal /></Button>
    <span className="font-medium">{LABELS[id]}</span>
  </li>;
}
export function LayoutEditor({ layout, onSave }: { layout: Block[]; onSave: (layout: Block[]) => void }) {
  const [draft, setDraft] = useState(layout);
  const [saved, setSaved] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const moved = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setDraft((current) => {
      const from = current.findIndex((id) => id === active.id);
      const to = current.findIndex((id) => id === over.id);
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
    setSaved(false);
  };
  return <section className="mt-6">
    <h3 className="font-semibold">Rearrange Layout</h3>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={moved}>
      <SortableContext items={draft} strategy={verticalListSortingStrategy}>
        <ul className="mt-3 space-y-2">{draft.map((id) => <SortableBlock key={id} id={id} />)}</ul>
      </SortableContext>
    </DndContext>
    <Button className="mt-3 w-full" onClick={() => { onSave([...draft]); setSaved(true); }}><Check />Save Layout</Button>
    {saved && <p role="status" className="mt-2 text-sm text-primary">Layout saved</p>}
  </section>;
}
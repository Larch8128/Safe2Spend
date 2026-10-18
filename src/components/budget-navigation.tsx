import { LayoutDashboard, CalendarDays, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Tab = "dashboard" | "overview" | "settings";

const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "overview", label: "Overview", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export function BudgetNavigation({ current, onNavigate }: { current: Tab; onNavigate: (t: Tab) => void }) {
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2 px-4 py-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            className="h-14"
            aria-current={current === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
            data-active={current === id}
          >
            <span className={`flex flex-col items-center gap-1 ${current === id ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="size-5" />
              <span className="text-xs">{label}</span>
            </span>
          </Button>
        ))}
      </div>
    </nav>
  );
}

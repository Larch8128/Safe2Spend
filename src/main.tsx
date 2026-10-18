import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { BudgetProvider, useBudget } from "@/components/budget-provider";
import { BudgetNavigation, type Tab } from "@/components/budget-navigation";
import { Dashboard, BudgetOverview, BudgetSettings, Onboarding } from "@/components/budget-views";

function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <BudgetProvider>
      <Gate tab={tab} onNavigate={setTab} />
      <BudgetNavigation current={tab} onNavigate={setTab} />
    </BudgetProvider>
  );
}

function Gate({ tab, onNavigate }: { tab: Tab; onNavigate: (t: Tab) => void }) {
  const { s } = useBudget();
  if (!s) return null;
  if (!s.onboarded) return <Onboarding />;
  if (tab === "dashboard") return <Dashboard />;
  if (tab === "overview") return <BudgetOverview />;
  return <BudgetSettings />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

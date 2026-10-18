import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { BudgetProvider } from "@/components/budget-provider";
import { BudgetNavigation, type Tab } from "@/components/budget-navigation";
import { Dashboard, BudgetOverview, BudgetSettings } from "@/components/budget-views";

function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <BudgetProvider>
      {tab === "dashboard" && <Dashboard />}
      {tab === "overview" && <BudgetOverview />}
      {tab === "settings" && <BudgetSettings />}
      <BudgetNavigation current={tab} onNavigate={setTab} />
    </BudgetProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

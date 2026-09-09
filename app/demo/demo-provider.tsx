"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import DemoWorkspace from "../earn-app";
export type DemoView = "setup" | "results" | "activity";
const DemoContext = createContext<{ openDemo: (view?: DemoView) => void } | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DemoView>("setup");
  const openDemo = useCallback((next: DemoView = "setup") => {
    setView(next);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openDemo }), [openDemo]);
  return (
    <DemoContext.Provider value={value}>
      {children}
      <DemoWorkspace
        open={open}
        view={view}
        onViewChange={setView}
        onClose={() => setOpen(false)}
      />
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw Error("useDemo requires DemoProvider");
  return context;
}

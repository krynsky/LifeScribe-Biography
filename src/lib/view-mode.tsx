import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ViewMode = "read" | "edit";

const STORAGE_KEY = "lifescribe.viewMode";

export function parseViewMode(value: string | null): ViewMode {
  return value === "read" ? "read" : "edit";
}

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextValue>({ mode: "edit", setMode: () => {} });

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(() => {
    try {
      return parseViewMode(localStorage.getItem(STORAGE_KEY));
    } catch {
      return "edit";
    }
  });

  const setMode = useCallback((next: ViewMode) => setModeState(next), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable — mode just won't persist */
    }
  }, [mode]);

  return <ViewModeContext.Provider value={{ mode, setMode }}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  return useContext(ViewModeContext);
}

/** Route component that renders `View` in read mode and `Edit` in edit mode. */
export function byMode(Edit: React.ComponentType, View: React.ComponentType): () => React.JSX.Element {
  return function ModeSwitch() {
    const { mode } = useViewMode();
    return mode === "read" ? <View /> : <Edit />;
  };
}

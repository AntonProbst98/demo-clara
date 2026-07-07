"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Promise as PromiseToPay } from "@/lib/types";

// In-memory promise store shared between the Workspace and the Dashboard.
// Lives in the root layout so it survives client-side route navigation.
// Intentionally NOT persisted (no localStorage) — this is a demo.

interface PromisesContextValue {
  promises: PromiseToPay[];
  addPromise: (
    p: Omit<PromiseToPay, "id" | "loggedAt">,
  ) => void;
  removePromise: (id: string) => void;
  promisesForAccount: (uuid: string) => PromiseToPay[];
}

const PromisesContext = createContext<PromisesContextValue | null>(null);

let seq = 0;
function nextId() {
  seq += 1;
  return `p_${Date.now().toString(36)}_${seq}`;
}

export function PromisesProvider({ children }: { children: ReactNode }) {
  const [promises, setPromises] = useState<PromiseToPay[]>([]);

  const addPromise = useCallback(
    (p: Omit<PromiseToPay, "id" | "loggedAt">) => {
      setPromises((prev) => [
        ...prev,
        { ...p, id: nextId(), loggedAt: new Date().toISOString() },
      ]);
    },
    [],
  );

  const removePromise = useCallback((id: string) => {
    setPromises((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const promisesForAccount = useCallback(
    (uuid: string) => promises.filter((p) => p.accountUuid === uuid),
    [promises],
  );

  const value = useMemo(
    () => ({ promises, addPromise, removePromise, promisesForAccount }),
    [promises, addPromise, removePromise, promisesForAccount],
  );

  return (
    <PromisesContext.Provider value={value}>
      {children}
    </PromisesContext.Provider>
  );
}

export function usePromises() {
  const ctx = useContext(PromisesContext);
  if (!ctx) {
    throw new Error("usePromises must be used within <PromisesProvider>.");
  }
  return ctx;
}

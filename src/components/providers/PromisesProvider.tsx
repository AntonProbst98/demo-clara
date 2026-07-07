"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Promise as PromiseToPay } from "@/lib/types";

// Promise store shared between the Workspace and the Dashboard. Lives in the
// root layout so it survives client-side route navigation, and is mirrored to
// localStorage so an accidental refresh mid-call never erases the day's work.

const STORAGE_KEY = "collections.promises.v1";

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

function loadStored(): PromiseToPay[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Tolerate a corrupt or hand-edited store rather than crashing the app.
    return Array.isArray(parsed) ? (parsed as PromiseToPay[]) : [];
  } catch {
    return [];
  }
}

export function PromisesProvider({ children }: { children: ReactNode }) {
  const [promises, setPromises] = useState<PromiseToPay[]>([]);

  // Hydrate from localStorage after mount to avoid an SSR/client mismatch, then
  // mirror every change back. `hydrated` gates the write so the initial empty
  // state can't clobber a stored list before the load completes.
  const hydrated = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    if (stored.length) setPromises(stored);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(promises));
    } catch {
      // Storage full or blocked (private mode) — keep working in memory.
    }
  }, [promises]);

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

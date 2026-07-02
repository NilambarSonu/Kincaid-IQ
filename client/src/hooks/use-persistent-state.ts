import { useState, useRef, useEffect, useCallback } from "react";

interface PersistOptions {
  urlParam?: string;
  debounceMs?: number;
}

type SetterArg<T> = T | ((prev: T) => T);

/**
 * Drop-in replacement for useState that persists to localStorage and optionally
 * syncs the primary value to/from a URL search param for shareability.
 *
 * Priority (highest → lowest):
 *   1. URL param (if urlParam option is set and param exists in current URL)
 *   2. localStorage value
 *   3. defaultValue
 *
 * Setter accepts both direct values and functional updaters: (prev) => next
 */
export function usePersistentState<T>(
  storageKey: string,
  defaultValue: T,
  options: PersistOptions = {}
): [T, (valOrUpdater: SetterArg<T>) => void] {
  const { urlParam, debounceMs = 300 } = options;

  const [value, setValueRaw] = useState<T>(() => {
    try {
      if (urlParam) {
        const p = new URLSearchParams(window.location.search);
        const v = p.get(urlParam);
        if (v !== null && v !== "") {
          try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
        }
      }
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {}
    return defaultValue;
  });

  const valueRef = useRef<T>(value);
  valueRef.current = value;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((val: T) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        if (val === null || val === undefined || val === "") {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(val));
        }
      } catch {}
    }, debounceMs);

    if (urlParam) {
      try {
        const url = new URL(window.location.href);
        if (val !== null && val !== undefined && val !== "" && (val as unknown) !== false) {
          url.searchParams.set(urlParam, String(val));
        } else {
          url.searchParams.delete(urlParam);
        }
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
  }, [storageKey, urlParam, debounceMs]);

  const setValue = useCallback((valOrUpdater: SetterArg<T>) => {
    setValueRaw(prev => {
      const next = typeof valOrUpdater === "function"
        ? (valOrUpdater as (prev: T) => T)(prev)
        : valOrUpdater;
      persist(next);
      return next;
    });
  }, [persist]);

  // On mount: if a urlParam is configured and the initial value came from
  // localStorage (URL had no param), push it into the URL so the address bar
  // reflects the restored entity and the link is immediately shareable.
  useEffect(() => {
    if (!urlParam) return;
    const val = valueRef.current;
    if (val === null || val === undefined || val === "") return;
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(urlParam)) {
        url.searchParams.set(urlParam, String(val));
        window.history.replaceState({}, "", url.toString());
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush pending write and clean up timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        try {
          const val = valueRef.current;
          if (val === null || val === undefined || val === "") {
            localStorage.removeItem(storageKey);
          } else {
            localStorage.setItem(storageKey, JSON.stringify(val));
          }
        } catch {}
      }
    };
  }, [storageKey]);

  return [value, setValue];
}

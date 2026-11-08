import { useCallback, useState } from "react";

/** A true/false choice remembered on this device. Falls back to memory only when storage is blocked. */
export function usePersistedFlag(key: string, initial = false): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        localStorage.setItem(key, v ? "1" : "0");
      } catch {}
    },
    [key],
  );
  return [value, set];
}

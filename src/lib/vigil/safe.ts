const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function isDay(s: unknown): s is string {
  return typeof s === "string" && DAY.test(s);
}

export function safeStorage(): Storage {
  try {
    const k = "__vigil_t";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      get length() {
        return mem.size;
      },
      clear: () => mem.clear(),
      getItem: (key) => mem.get(key) ?? null,
      key: (i) => [...mem.keys()][i] ?? null,
      removeItem: (key) => {
        mem.delete(key);
      },
      setItem: (key, value) => {
        mem.set(key, value);
      },
    };
  }
}

export function askPersist() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* private mode */
  }
}

export function haptic(ms = 14) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no haptic */
  }
}

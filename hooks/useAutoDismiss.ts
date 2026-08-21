import { useEffect } from "react";

export function useAutoDismiss(value: string, clear: () => void, delayMs = 8_000) {
  useEffect(() => {
    if (!value) return;
    const timer = window.setTimeout(clear, delayMs);
    return () => window.clearTimeout(timer);
  }, [clear, delayMs, value]);
}

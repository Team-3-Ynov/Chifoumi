import { useEffect, useState } from "react";

export function useDeadlineCountdown(deadline?: string): number {
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(deadline));

  useEffect(() => {
    setRemainingMs(getRemainingMs(deadline));
    if (!deadline) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingMs(getRemainingMs(deadline));
    }, 100);

    return () => window.clearInterval(interval);
  }, [deadline]);

  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function getRemainingMs(deadline?: string): number {
  if (!deadline) {
    return 0;
  }
  const deadlineMs = Date.parse(deadline);
  return Number.isNaN(deadlineMs) ? 0 : Math.max(0, deadlineMs - Date.now());
}

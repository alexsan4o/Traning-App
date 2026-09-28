import { useEffect, useState } from 'react';

/** Текущее время, обновляемое с заданным интервалом. Таймеры считают от меток времени, а не тиков. */
export function useNow(intervalMs = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}

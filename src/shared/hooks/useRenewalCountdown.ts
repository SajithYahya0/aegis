import { useEffect, useRef, useState } from 'react';

/** Poll resolution for `IDLE_THRESHOLD_MS` — see the header. Not a display rate. */
const TICK_MS = 1000;
const IDLE_THRESHOLD_MS = 30_000;
const ACTIVITY_EVENTS: readonly (keyof DocumentEventMap)[] = ['mousemove', 'keydown', 'click'];

export interface RenewalCountdown {
  daysRemaining: number;
  hoursRemaining: number;
  minutesRemaining: number;
  secondsRemaining: number;
  isExpired: boolean;
  isIdle: boolean;
}

function splitRemaining(ms: number): Pick<
  RenewalCountdown,
  'daysRemaining' | 'hoursRemaining' | 'minutesRemaining' | 'secondsRemaining' | 'isExpired'
> {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  return {
    daysRemaining: Math.floor(totalSeconds / 86_400),
    hoursRemaining: Math.floor((totalSeconds % 86_400) / 3_600),
    minutesRemaining: Math.floor((totalSeconds % 3_600) / 60),
    secondsRemaining: totalSeconds % 60,
    isExpired: ms <= 0,
  };
}

export function useRenewalCountdown(endDate: string): RenewalCountdown {
  const endMs = useRef(new Date(endDate).getTime());
  endMs.current = new Date(endDate).getTime();

  // Mutable bookkeeping the interval reads and the activity listeners write.
  // Written at pointer frequency, read once a second — see the header.
  const lastActivityRef = useRef<number>(Date.now());

  const [snapshot, setSnapshot] = useState(() => ({
    ...splitRemaining(endMs.current - Date.now()),
    isIdle: false,
  }));

  useEffect(() => {
    function onActivity(): void {
      lastActivityRef.current = Date.now();
    }

    for (const eventName of ACTIVITY_EVENTS) {
      document.addEventListener(eventName, onActivity);
    }

    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      setSnapshot({
        ...splitRemaining(endMs.current - Date.now()),
        isIdle: idleFor >= IDLE_THRESHOLD_MS,
      });
    }, TICK_MS);

    return () => {
      window.clearInterval(timer);
      for (const eventName of ACTIVITY_EVENTS) {
        document.removeEventListener(eventName, onActivity);
      }
    };
  }, []);

  return snapshot;
}

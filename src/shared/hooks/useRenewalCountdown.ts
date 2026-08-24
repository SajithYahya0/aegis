/**
 * WHY THIS EXISTS:
 *   Drives the renewal countdown on `/policies/:id` — a days/hours/minutes/
 *   seconds readout ticking down to a policy's `endDate` — and, sharing the
 *   same "how long since anything happened" machinery, an idle-session flag
 *   for the same view. Both are `setInterval` problems: one interval, two
 *   things it checks each tick.
 *
 * CONCEPTS: W2-D1-04, W2-D2-02
 *
 * WITHOUT THIS:
 *   No cleanup on the interval: `PolicyDetailPage` unmounts (the agent
 *   navigates back to `/policies`) but the `setInterval` callback keeps
 *   firing once a second forever, each tick calling `setState` on a
 *   component React has already thrown away. In development that logs
 *   "Can't perform a React state update on an unmounted component"; the
 *   interval itself is a real leak either way — open five policies in a
 *   session and there are five countdowns still ticking in memory behind
 *   the one currently on screen. `clearInterval` in the effect's cleanup is
 *   what stops that, and it has to run on *every* unmount, not just when
 *   the component happens to still be mounted when the countdown reaches
 *   zero.
 *
 *   `timerRef` and `lastActivityRef` as `useState` instead of `useRef`: the
 *   interval id is never read by JSX — it exists purely so the cleanup
 *   function can find the same interval to clear. Putting it in state would
 *   schedule a re-render every time the interval is (re)created for a value
 *   nothing on screen displays. `lastActivityRef` is worse if it were state:
 *   it updates on every `mousemove`, so idle tracking would re-render the
 *   whole policy detail page dozens of times a second while the mouse is
 *   simply resting on it — the opposite of what an idle detector is for.
 *   The tick-driven `useState` below exists precisely to be the *one*
 *   controlled place per second where a re-render is actually warranted.
 */

import { useEffect, useRef, useState } from 'react';

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
  // Neither is meant to cause a render on its own — see the header.
  const timerRef = useRef<number | null>(null);
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

    timerRef.current = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      setSnapshot({
        ...splitRemaining(endMs.current - Date.now()),
        isIdle: idleFor >= IDLE_THRESHOLD_MS,
      });
    }, TICK_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      for (const eventName of ACTIVITY_EVENTS) {
        document.removeEventListener(eventName, onActivity);
      }
    };
  }, []);

  return snapshot;
}

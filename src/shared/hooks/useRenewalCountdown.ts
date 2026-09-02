/**
 * WHY THIS EXISTS:
 *   Drives two things on `/policies/:id` off one `setInterval`: how long until
 *   a policy's `endDate`, and whether the session has gone idle. One interval,
 *   two things it checks each tick.
 *
 * CONCEPTS: W2-D1-04, W2-D2-02
 *
 * WHY THE TICK IS ONCE A SECOND:
 *   The idle flag, and only the idle flag. `RenewalCountdown` renders days —
 *   a figure that changes once a day — so nothing on screen needs a per-second
 *   interval to stay current. `IDLE_THRESHOLD_MS` does: going idle is the
 *   *absence* of events, and absence fires no event, so the only way to notice
 *   30s of nothing is to keep asking. The tick interval is the resolution of
 *   that question — at `TICK_MS = 1000` the badge appears within a second of
 *   the threshold; at a one-minute tick it would appear up to a minute late,
 *   and at an hourly one the flag would be decorative. A slower interval cannot
 *   detect a 30s threshold, which is the whole argument for this one.
 *
 *   The hook still returns hours/minutes/seconds. They are a correct split of
 *   the same remaining-milliseconds figure and cost nothing to compute; the
 *   display's decision not to show them is the display's.
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
 *   zero. The activity listeners are the same story: three `document`-level
 *   listeners per policy opened, never removed.
 *
 *   `lastActivityRef` as `useState` instead of `useRef`: it updates on every
 *   `mousemove`, so idle tracking would re-render the whole policy detail page
 *   dozens of times a second while the mouse is simply resting on it — an idle
 *   detector that makes the page busy while the user is idle has inverted its
 *   own purpose. The tick-driven `useState` below exists precisely to be the
 *   *one* controlled place where a re-render is allowed to happen, at a rate
 *   this file chooses rather than one the pointer chooses.
 *
 *   That is the whole rule, and it is worth stating as a rule because this file
 *   previously got it wrong in the other direction: ref when the write
 *   frequency and the render frequency differ, state when they are the same.
 *   An earlier version also kept the interval id in a `timerRef`, which fails
 *   that test — it is written once per effect run and read once per cleanup, by
 *   a closure that can see the effect's own scope. A plain `const timer` inside
 *   the effect is visible to the cleanup it returns and cannot be stale, since
 *   there is exactly one interval per effect run by construction. The ref added
 *   a mutable slot, a null check and a manual reset to re-derive what the
 *   closure already guaranteed — the ref equivalent of a cargo-cult `useMemo`,
 *   and worth naming as such rather than quietly deleting, because "a ref where
 *   a closure variable suffices" is the most common way `useRef` gets misused
 *   by someone who has just learned what it is for.
 */

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

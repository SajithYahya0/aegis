/**
 * WHY THIS EXISTS:
 *   The registered demonstration of a stale closure inside an interval
 *   (W2-D1-06) — the classic case where an effect's cleanup is correct but
 *   its dependency array is not, so the callback keeps referencing the value
 *   from the render that created it.
 *
 * CONCEPTS: W2-D1-06
 *
 * WITHOUT THIS:
 *   Nothing in the app otherwise has a long-lived interval reading component
 *   state, so this pitfall would have no live counterpart to point at —
 *   just a claim in prose that the reviewer has to take on faith.
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useLabFlag } from './useLabFlag';

export function StaleClosureDemo(): ReactElement {
  const broken = useLabFlag('stale-closure-interval');
  const [count, setCount] = useState(0);
  const [lastLogged, setLastLogged] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setLastLogged(count);
    }, 1000);
    return () => clearInterval(id);
    // DEFECT (W2-D1-06, off by default): with `broken` true the deps array
    // is `[]`, so this effect — and the closure the interval captured — runs
    // exactly once. `count` inside the callback is frozen at whatever it was
    // on mount, forever, no matter how many times `setCount` fires below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, broken ? [] : [count]);

  return (
    <div>
      <p>Count: {count}</p>
      <p>Last logged (via interval): {lastLogged ?? '—'}</p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        Increment
      </button>
    </div>
  );
}

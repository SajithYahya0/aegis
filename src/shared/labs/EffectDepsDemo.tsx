/**
 * WHY THIS EXISTS:
 *   The registered demonstration of the object-literal effect dependency
 *   pitfall (W2-D1-05) — an effect that never sees a "stable" dependency
 *   because the value in its deps array is a fresh object every render.
 *
 * CONCEPTS: W2-D1-05
 *
 * WITHOUT THIS:
 *   The matrix requires this pitfall to be demonstrated, not just named. A
 *   paragraph explaining "object literals in deps cause infinite loops" is
 *   not evidence; a component that actually loops when the toggle is on is.
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useLabFlag } from './useLabFlag';

const RUN_CAP = 500;

export function EffectDepsDemo(): ReactElement {
  const broken = useLabFlag('object-literal-effect-dep');
  const [runs, setRuns] = useState(0);

  // DEFECT (W2-D1-05, off by default): a fresh object every render. When it
  // sits in the deps array below, `Object.is` never considers it unchanged,
  // so the effect fires again, sets state, re-renders, and creates another
  // fresh object — forever, in a real occurrence of this bug.
  const query = { onlyActive: true };

  useEffect(() => {
    if (runs >= RUN_CAP) return;
    setRuns((r) => r + 1);
    // The array literal itself is always "new" — React only compares its
    // *elements*, not the array reference. Swapping which element sits at
    // index 0 is what turns this effect from "runs once" into "never stops".
  }, broken ? [query] : [true]);

  return (
    <div>
      <p>
        Effect runs: {runs}
        {runs >= RUN_CAP ? ' (capped — an unbounded version of this would freeze the tab)' : ''}
      </p>
    </div>
  );
}

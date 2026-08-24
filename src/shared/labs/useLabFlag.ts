/**
 * WHY THIS EXISTS:
 *   Bridges the plain-module lab registry into a React value that re-renders
 *   its caller when a toggle flips, without going through Context.
 *
 * CONCEPTS: (infrastructure — see registry.ts)
 *
 * WITHOUT THIS:
 *   Every demo component would read `isLabEnabled(id)` once, at first render,
 *   and never again. Flipping the checkbox in `LabPanel` would change the
 *   module state but nothing on screen — the demo would look broken rather
 *   than off.
 */

import { useEffect, useState } from 'react';
import { isLabEnabled, subscribeLab, type LabDefectId } from './registry';

export function useLabFlag(id: LabDefectId): boolean {
  const [flag, setFlag] = useState(() => isLabEnabled(id));

  useEffect(() => {
    setFlag(isLabEnabled(id));
    return subscribeLab(() => setFlag(isLabEnabled(id)));
  }, [id]);

  return flag;
}

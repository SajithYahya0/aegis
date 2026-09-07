import { useState, type ReactElement } from 'react';
import { useLabFlag } from './useLabFlag';

export function ConditionalHookDemo(): ReactElement {
  const broken = useLabFlag('conditional-hook');
  const [ticks, setTicks] = useState(0);

  if (broken && ticks % 2 === 1) {
    // DEFECT (W3-D2-01, off by default): this hook is only called on some
    // renders once `broken` is true — the number of hooks React sees changes
    // from one render to the next, which is exactly what the rules of hooks
    // forbid. React does not detect this by inspecting the code; it detects
    // it at runtime by counting hook calls, so the crash only happens on the
    // render where the count actually changes.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState('phantom');
  }

  return (
    <div>
      <p>Ticks: {ticks}</p>
      <button type="button" onClick={() => setTicks((t) => t + 1)}>
        Tick
      </button>
    </div>
  );
}

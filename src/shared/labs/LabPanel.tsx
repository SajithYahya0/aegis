/**
 * WHY THIS EXISTS:
 *   The dev-only control surface for every registered defect: a checkbox per
 *   toggle, its symptom described up front, and — for the two defects that
 *   are safe to sandbox in isolation — a live mini-demo right next to the
 *   switch. Mounted once, in `AppLayout`, so it is reachable from every route.
 *
 * CONCEPTS: (dev tooling — see registry.ts for the concepts each toggle claims)
 *
 * WITHOUT THIS:
 *   Flipping a defect on would mean editing `registry.ts`'s initial map and
 *   reloading, which is not what "runtime toggles" means. A reviewer asking
 *   "show me the stale closure bug" would have to be handed a code diff
 *   instead of a checkbox.
 */

import { useState, type ReactElement } from 'react';
import { ConditionalHookDemo } from './ConditionalHookDemo';
import { EffectDepsDemo } from './EffectDepsDemo';
import { StaleClosureDemo } from './StaleClosureDemo';
import { LAB_DEFECTS, setLabEnabled, type LabDefectId } from './registry';
import { useLabFlag } from './useLabFlag';
import styles from './LabPanel.module.css';

function DefectRow({ id, title, matrixId, summary, symptom }: (typeof LAB_DEFECTS)[number]): ReactElement {
  const enabled = useLabFlag(id);

  return (
    <div className={styles.defect}>
      <div className={styles.defectHead}>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setLabEnabled(id, event.target.checked)}
          />{' '}
          <span className={styles.defectTitle}>{title}</span>
        </label>
        <span className={styles.matrixId}>{matrixId}</span>
      </div>
      <p className={styles.summaryText}>{summary}</p>
      <p className={styles.symptom}>{symptom}</p>
      {enabled ? <div className={styles.sandbox}>{sandboxFor(id)}</div> : null}
    </div>
  );
}

function sandboxFor(id: LabDefectId): ReactElement | null {
  switch (id) {
    case 'conditional-hook':
      return <ConditionalHookDemo />;
    case 'object-literal-effect-dep':
      return <EffectDepsDemo />;
    case 'stale-closure-interval':
      return <StaleClosureDemo />;
    case 'mutating-reducer':
      // No inline sandbox: this defect lives in the real QuoteContext
      // reducer so it fires from an actual route (/quote), not a stand-in.
      return null;
  }
}

export function LabPanel(): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <details className={styles.panel} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={styles.summary}>Lab defects (dev only)</summary>
      <div className={styles.body}>
        {LAB_DEFECTS.map((defect) => (
          <DefectRow key={defect.id} {...defect} />
        ))}
      </div>
    </details>
  );
}

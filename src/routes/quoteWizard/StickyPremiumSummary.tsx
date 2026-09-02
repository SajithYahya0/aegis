/**
 * WHY THIS EXISTS:
 *   A premium readout that travels with the wizard content and pins near the
 *   top of the viewport once it reaches it, so the agent can see what each
 *   edit does to the price without scrolling back up. It is `position:
 *   sticky` — part of the wizard, in normal flow, sized by the wizard column
 *   — and every part of that positioning, the offset it pins at included,
 *   is stated in the stylesheet. This component passes no geometry of its
 *   own.
 *
 *   It renders a premium delta ("was ₹X"), which needs the value this
 *   component held on its *previous* render. That history lives in two refs
 *   written during render, not in state, because recording history is not
 *   itself something the screen reacts to — only the comparison between
 *   "current" and "previous" is ever rendered.
 *
 *   WHAT USED TO BE HERE, and why it is not: this component measured
 *   `QuoteWizardPage`'s title-and-steps block with `useLayoutEffect` and fed
 *   the measured bottom edge to an inline `style={{ top }}`. That was
 *   load-bearing while the bar was `position: fixed`, where `top` is *where
 *   the bar is drawn* — the measurement put it directly under a header whose
 *   height varies with viewport width. Under `sticky`, `top` means something
 *   else entirely: it is the viewport offset the bar clamps at once scrolling
 *   pushes it there. Handing that the header's bottom edge (~200px) pinned
 *   the bar a fifth of the way down the viewport, where it sat on top of the
 *   fields scrolling underneath it — the measurement was not merely useless,
 *   it was the bug. A sticky offset is a small design constant, so the
 *   stylesheet states it directly.
 *
 *   That left `dockTop`, `FALLBACK_TOP_PX`, `measure()`, the
 *   `useLayoutEffect`/`useEffect` pair and the `layout-effect-flicker` lab
 *   toggle computing a number nothing could read. CLAUDE.md does not allow
 *   that to stay in the tree as dead code dressed as a demo, so all of it was
 *   deleted and the lab defect deregistered. Matrix row W3-D4-04 went with
 *   it: `useLayoutEffect` no longer appears anywhere in shipped code, and no
 *   contrived replacement was invented to keep the row. It is recorded as an
 *   honest gap in `docs/coverage-matrix.md`.
 *
 * CONCEPTS: W2-D2-03
 *
 * WITHOUT THIS:
 *   The obvious-looking alternative to the two refs — `const [prev, setPrev]
 *   = useState(premium); useEffect(() => setPrev(premium), [premium])` —
 *   renders the *new* premium alongside a `prev` that has not caught up yet
 *   (the effect that would update it has not run), then immediately
 *   re-renders once it has. The delta indicator built that way flashes
 *   "was ₹0" (or the value two changes ago) for one frame on every change,
 *   because `setPrev` inside an effect is itself a state update that
 *   schedules another render rather than being available in the render that
 *   needs it. Writing to a ref during render has no such lag: by the time
 *   this render reads `previousPremiumRef.current`, it still holds what was
 *   written last render, and this render's write only takes effect for the
 *   *next* one.
 */

import { useRef, type ReactElement } from 'react';
import { formatCurrency } from '../../shared/format';
import styles from './StickyPremiumSummary.module.css';

export interface StickyPremiumSummaryProps {
  premium: number;
}

export function StickyPremiumSummary({ premium }: StickyPremiumSummaryProps): ReactElement {
  const currentPremiumRef = useRef(premium);
  const previousPremiumRef = useRef<number | undefined>(undefined);
  if (currentPremiumRef.current !== premium) {
    previousPremiumRef.current = currentPremiumRef.current;
    currentPremiumRef.current = premium;
  }
  const previousPremium = previousPremiumRef.current;

  const delta = previousPremium === undefined || previousPremium === premium ? null : premium - previousPremium;

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Indicative premium</span>
      <strong className={styles.amount}>{formatCurrency(premium)}</strong>
      {delta !== null ? (
        <span className={delta > 0 ? styles.up : styles.down}>
          {delta > 0 ? '▲' : '▼'} was {formatCurrency(previousPremium!)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * WHY THIS EXISTS:
 *   A premium readout pinned to the viewport, docked directly beneath the
 *   wizard's own title-and-steps block rather than overlapping it. That dock
 *   offset is measured from the real DOM node, not hard-coded, because the
 *   title-and-steps block's height is not a fixed constant — it wraps
 *   differently at different viewport widths, and a hard-coded offset would
 *   silently drift out of sync the next time that block's content changes.
 *
 *   Positioned with `position: fixed`, not `position: sticky`. An earlier
 *   version used `sticky`, and the `layout-effect-flicker` toggle was
 *   provably inert under it: a `position: sticky` element's `top` is a
 *   scroll-triggered *clamp* — it only affects rendering once the page has
 *   scrolled far enough that the element's normal-flow position would cross
 *   above that offset. This wizard never scrolls that far (it's four short
 *   steps), so the element sat at its ordinary in-flow position regardless
 *   of what `top` held; a Playwright probe confirmed the rendered rect was
 *   bit-for-bit identical with the toggle on and off, even though the two
 *   `top` *values* genuinely differed. `position: fixed`'s `top` is not
 *   scroll-gated — it applies on every paint unconditionally — so the same
 *   measured-vs-fallback gap that was invisible under `sticky` is now the
 *   only thing rendering the panel's position at all.
 *
 * CONCEPTS: W3-D4-04
 *
 * WITHOUT THIS (the toggle, not just the component):
 *   `useLayoutEffect` runs synchronously after the DOM is updated but before
 *   the browser paints, so the measured offset replaces `FALLBACK_TOP_PX`
 *   before the user ever sees a frame — React re-renders and re-commits
 *   inside the same layout-effect phase, so exactly one paint happens and it
 *   already shows the correct position. Swap it for `useEffect` — which the
 *   `layout-effect-flicker` lab toggle does — and the browser paints once
 *   with `FALLBACK_TOP_PX` (0, chosen because it's nowhere near the real
 *   offset — the panel renders flush against the top of the viewport,
 *   overlapping `AppLayout`'s own header), *then* the passive effect runs and
 *   a second paint snaps it down to its correct, measured position. Both
 *   effects eventually set the right value; the difference is entirely which
 *   side of the paint that assignment lands on. The console logs below print
 *   the gap between commit and correction in milliseconds, but that number is
 *   not the reliable signal — `getBoundingClientRect()` forces a synchronous
 *   layout, and on a busy first commit that reflow alone can cost several ms
 *   even inside a layout effect, so "before paint" is not "instant". The
 *   reliable signal is the explicit `before paint` / `after paint` tag on
 *   each log line, which reflects a guarantee the browser actually makes
 *   (layout effects always run and can re-commit before the next paint;
 *   passive effects never run before the first one) rather than a timing
 *   number that can vary with machine load.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from 'react';
import { useLabFlag } from '../../shared/labs';
import { formatCurrency } from '../../shared/format';
import { usePrevious } from '../../shared/hooks/usePrevious';
import styles from './StickyPremiumSummary.module.css';

export interface StickyPremiumSummaryProps {
  headerRef: RefObject<HTMLElement | null>;
  premium: number;
}

/**
 * Deliberately wrong: "no measurement has happened yet" defaults to zero
 * additional offset, which puts the panel flush against the top of the
 * viewport — nowhere near where the wizard's local header actually ends
 * (typically 150–220px down, depending on viewport width). The gap between
 * this and the measured value is the whole demo.
 */
const FALLBACK_TOP_PX = 0;

export function StickyPremiumSummary({ headerRef, premium }: StickyPremiumSummaryProps): ReactElement {
  const useEffectInstead = useLabFlag('layout-effect-flicker');
  const [dockTop, setDockTop] = useState(FALLBACK_TOP_PX);
  const previousPremium = usePrevious(premium);

  // Marks when this render's DOM was committed — always a layout effect, so
  // it runs before paint no matter which branch below is active, giving both
  // branches the same zero point to measure their own delta against.
  const committedAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    committedAt.current = performance.now();
  });

  const measure = (source: 'useLayoutEffect' | 'useEffect'): void => {
    if (!headerRef.current) return;
    const measured = headerRef.current.getBoundingClientRect().bottom;
    const elapsed = performance.now() - (committedAt.current ?? performance.now());
    console.log(
      `[StickyPremiumSummary] ${source} corrected top: ${FALLBACK_TOP_PX}px → ${measured.toFixed(1)}px, ` +
        `${elapsed.toFixed(2)}ms after commit (${source === 'useLayoutEffect' ? 'before paint' : 'after paint — the fallback was already on screen'})`,
    );
    setDockTop(measured);
  };

  // Exactly one of these two effects does anything on a given render — which
  // one is chosen by the lab toggle. Both hooks are called unconditionally
  // (as the rules of hooks require); the toggle only gates the body, the
  // same pattern EffectDepsDemo and StaleClosureDemo use for their defects.
  useLayoutEffect(() => {
    if (useEffectInstead) return;
    measure('useLayoutEffect');
    const onResize = (): void => measure('useLayoutEffect');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useEffectInstead]);

  useEffect(() => {
    // DEFECT (W3-D4-04, off by default): the same measurement, but running
    // after paint instead of before it — see this file's header.
    if (!useEffectInstead) return;
    measure('useEffect');
    const onResize = (): void => measure('useEffect');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useEffectInstead]);

  const delta = previousPremium === undefined || previousPremium === premium ? null : premium - previousPremium;

  return (
    <>
      <div className={styles.spacer} />
      <div className={styles.bar} style={{ top: dockTop }}>
        <span className={styles.label}>Indicative premium</span>
        <strong className={styles.amount}>{formatCurrency(premium)}</strong>
        {delta !== null ? (
          <span className={delta > 0 ? styles.up : styles.down}>
            {delta > 0 ? '▲' : '▼'} was {formatCurrency(previousPremium!)}
          </span>
        ) : null}
      </div>
    </>
  );
}

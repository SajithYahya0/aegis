/**
 * WHY THIS EXISTS:
 *   A premium readout that scrolls with the wizard and pins under the
 *   wizard's own title-and-steps block once it reaches it. That dock offset
 *   is measured from the real DOM node, not hard-coded, because the
 *   title-and-steps block's height is not a fixed constant — it wraps
 *   differently at different viewport widths, and a hard-coded offset would
 *   silently drift out of sync the next time that block's content changes.
 *
 *   Positioned with `position: sticky`, not `position: fixed`. The bar is
 *   part of the wizard, not part of the chrome: it belongs in the document
 *   flow, sized by the wizard column, travelling with the content and
 *   pinning only on arrival at the top. `fixed` cannot express "pin only on
 *   arrival" — a fixed bar is welded to the viewport from the first frame
 *   and slides over the content behind it. It also had to restate the
 *   column's geometry (`left`, `width`, `max-width`) in viewport terms and
 *   reserve its own vertical space with a hard-coded 45px spacer, both now
 *   deleted because an in-flow element needs neither.
 *
 *   THE COST, stated plainly: this makes the `layout-effect-flicker`
 *   toggle's *visual* effect inert. A `position: sticky` element's `top` is
 *   a scroll-triggered clamp — it changes nothing until the page has
 *   scrolled far enough that the element's normal-flow position would cross
 *   above that offset. This wizard is four short steps and never scrolls
 *   that far, so the bar sits at its ordinary in-flow position no matter
 *   what `top` holds. A Playwright probe against the earlier sticky version
 *   recorded rendered rects that were bit-for-bit identical with the toggle
 *   on and off, *even though the two `top` values genuinely differed*. That
 *   is exactly why `fixed` had been chosen; the product requirement
 *   overrides the demo, and the demo is downgraded rather than the layout
 *   being bent back to suit it.
 *
 *   What survives is the mechanism and its evidence: the measurement still
 *   runs, `dockTop` still holds the real value and is still wired to `top`,
 *   and the console logs below still print the `before paint` /
 *   `after paint` tag that is the actual proof of the difference.
 *   `docs/coverage-matrix.md` carries W3-D4-04 as `[~]` for exactly this
 *   reason, and `docs/failure-modes.md` points the drill at the console
 *   rather than at the screen.
 *
 *   It also renders a premium delta ("was ₹X"), which needs the value this
 *   component held on its *previous* render. That history lives in two refs
 *   written during render, not in state, because recording history is not
 *   itself something the screen reacts to — only the comparison between
 *   "current" and "previous" is ever rendered.
 *
 * CONCEPTS: W3-D4-04, W2-D2-03
 *
 * WITHOUT THIS (the toggle, not just the component):
 *   `useLayoutEffect` runs synchronously after the DOM is updated but before
 *   the browser paints, so the measured offset replaces `FALLBACK_TOP_PX`
 *   before the user ever sees a frame — React re-renders and re-commits
 *   inside the same layout-effect phase, so exactly one paint happens and it
 *   already carries the correct value. Swap it for `useEffect` — which the
 *   `layout-effect-flicker` lab toggle does — and the browser paints once
 *   with `FALLBACK_TOP_PX` (0), *then* the passive effect runs and a second
 *   paint carries the measured offset. Both effects eventually set the right
 *   value; the difference is entirely which side of the paint that
 *   assignment lands on.
 *
 *   Under `position: sticky` that difference reaches `top` but not the
 *   screen: `top` on a sticky element is a scroll-triggered clamp, and this
 *   wizard is too short to scroll past it, so both paints draw the bar at
 *   the same in-flow position. **The toggle no longer produces a visible
 *   jump.** That is not the toggle being broken, and it is not to be "fixed"
 *   by reverting the CSS — the in-flow layout is what product asked for, and
 *   the lab defect stays registered in `docs/failure-modes.md` regardless.
 *
 *   The observable that remains is the console. Each log line carries an
 *   explicit `before paint` / `after paint` tag, and that tag — not the
 *   millisecond figure printed beside it — is the reliable signal, for the
 *   same reason it always was: `getBoundingClientRect()` forces a
 *   synchronous layout, and on a busy first commit that reflow alone can
 *   cost several ms *inside* a layout effect, so "before paint" is not
 *   "instant". The tag reflects a guarantee the browser actually makes
 *   (layout effects always run and can re-commit before the next paint;
 *   passive effects never run before the first one) rather than a timing
 *   number that varies with machine load. With sticky in play the tag is now
 *   the *only* evidence rather than merely the trustworthy one.
 *
 * WITHOUT THIS (the previous-premium refs):
 *   The obvious-looking alternative — `const [prev, setPrev] =
 *   useState(premium); useEffect(() => setPrev(premium), [premium])` —
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

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement, type RefObject } from 'react';
import { useLabFlag } from '../../shared/labs';
import { formatCurrency } from '../../shared/format';
import styles from './StickyPremiumSummary.module.css';

export interface StickyPremiumSummaryProps {
  headerRef: RefObject<HTMLElement | null>;
  premium: number;
}

/**
 * Deliberately wrong: "no measurement has happened yet" defaults to zero
 * additional offset, nowhere near where the wizard's local header actually
 * ends (typically 150–220px down, depending on viewport width). The gap
 * between this and the measured value is what the `before paint` /
 * `after paint` logs report. Under `position: sticky` that gap is no longer
 * *drawn* — see this file's header — but it is still real, still measured,
 * and still the difference the two effect branches disagree about.
 */
const FALLBACK_TOP_PX = 0;

export function StickyPremiumSummary({ headerRef, premium }: StickyPremiumSummaryProps): ReactElement {
  const useEffectInstead = useLabFlag('layout-effect-flicker');
  const [dockTop, setDockTop] = useState(FALLBACK_TOP_PX);
  const currentPremiumRef = useRef(premium);
  const previousPremiumRef = useRef<number | undefined>(undefined);
  if (currentPremiumRef.current !== premium) {
    previousPremiumRef.current = currentPremiumRef.current;
    currentPremiumRef.current = premium;
  }
  const previousPremium = previousPremiumRef.current;

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

  // No spacer element. `.bar` is `position: sticky`, which leaves it in
  // normal flow occupying its own height — there is nothing to reserve. The
  // `fixed` version needed a hard-coded 45px stand-in, and that number went
  // stale the moment the bar's padding changed.
  return (
    <div className={styles.bar} style={{ top: dockTop }}>
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

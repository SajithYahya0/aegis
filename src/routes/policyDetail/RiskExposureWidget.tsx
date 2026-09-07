import { Suspense, use, type ReactElement } from 'react';
import { clearPolicyResource, getPolicyResource, getRiskFeedResource } from '../../shared/api';
import { ErrorBoundary } from '../../shared/components/ErrorBoundary';
import { Panel } from '../../shared/components/Panel';
import { Skeleton } from '../../shared/components/Skeleton';
import { formatCurrency, formatPercent } from '../../shared/format';
import { useLabFlag } from '../../shared/labs';
import styles from './RiskExposureWidget.module.css';

export interface RiskExposureProps {
  policyId: string;
}

/**
 * The public surface: Panel chrome, then boundary, then Suspense, then the
 * suspending component. See the header for why that nesting order is fixed.
 */
export function RiskExposurePanel({ policyId }: RiskExposureProps): ReactElement {
  return (
    <Panel title="Risk exposure">
      <ErrorBoundary
        label="Risk exposure"
        /*
         * The eviction half of the retry. `ErrorBoundary`'s key bump remounts
         * this subtree, but the rejected promise lives in a module-level Map
         * that no remount can reach — so without this the remounted widget
         * calls `getRiskFeedResource(policyId)`, gets the same settled
         * rejection back, and throws again before the browser paints. The
         * button would look broken in the most confusing possible way: nothing
         * at all would appear to happen.
         */
        onRetry={() => clearPolicyResource(policyId)}
      >
        <Suspense fallback={<Skeleton variant="panel" rows={3} label="Loading risk exposure" />}>
          <RiskExposureWidget policyId={policyId} />
        </Suspense>
      </ErrorBoundary>
    </Panel>
  );
}

function RiskExposureWidget({ policyId }: RiskExposureProps): ReactElement {
  const feedIsDown = useLabFlag('risk-feed-outage');

  /*
   * Reads the same cached promise `PolicySummaryCard` already read. A second
   * `use()` of the same resource costs one Map lookup and logs `⤳ cache hit`,
   * not a second request — which is the cache doing its job across two
   * unrelated components rather than within one.
   */
  const { policy, claims } = use(getPolicyResource(policyId));

  if (feedIsDown) {
    /*
     * The conditional call is safe for the same reason the context read in
     * `PolicySummaryCard` is: `use()` is not a hook and has no fixed call
     * order to preserve. Written with `useFetch` this branch would be
     * impossible — the hook would have to run on every render regardless.
     *
     * This promise is pending on the first render (Suspense catches it) and
     * rejected on the next (the ErrorBoundary catches it).
     */
    use(getRiskFeedResource(policyId));
  }

  /* Local exposure maths — no feed needed, and the reason the widget is still
     worth rendering when the vendor is up. */
  const incurred = claims.reduce((total, claim) => total + claim.amount, 0);
  const lossRatio = policy.sumInsured > 0 ? incurred / policy.sumInsured : 0;

  return (
    <div className={styles.widget}>
      <div className={styles.row}>
        <span className={styles.label}>Incurred to date</span>
        <span className={styles.value}>{formatCurrency(incurred)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Exposure remaining</span>
        <span className={styles.value}>
          {formatCurrency(Math.max(policy.sumInsured - incurred, 0))}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Burn against sum insured</span>
        <span className={styles.value}>{formatPercent(lossRatio)}</span>
      </div>
      <p className={styles.source}>
        Vendor risk feed nominal. Enable “Third-party risk feed outage” in the lab panel to see this
        widget fail on its own.
      </p>
    </div>
  );
}

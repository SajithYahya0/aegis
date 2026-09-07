import { Suspense, type ReactElement } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { clearPolicyResource } from '../shared/api';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { Skeleton } from '../shared/components/Skeleton';
import { policiesById } from '../shared/data';
import { PolicySummaryCard } from './policyDetail/PolicySummaryCard';
import { RenewalCountdown } from './policyDetail/RenewalCountdown';
import { RiskExposurePanel } from './policyDetail/RiskExposureWidget';
import styles from './PolicyDetailPage.module.css';

function tabClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? styles.tabActive : styles.tab;
}

export default function PolicyDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const policyId = id ?? '';
  const policy = policiesById.get(policyId);

  return (
    <div>
      <h1>Policy {policyId}</h1>

      {policy ? <RenewalCountdown endDate={policy.endDate} /> : null}

      <ErrorBoundary
        key={policyId}
        label={`Policy ${policyId}`}
        onRetry={() => clearPolicyResource(policyId)}
      >
        <Suspense fallback={<Skeleton variant="card" fields={6} label="Loading policy summary" />}>
          <PolicySummaryCard policyId={policyId} />
        </Suspense>
      </ErrorBoundary>

      <RiskExposurePanel key={`risk-${policyId}`} policyId={policyId} />

      {/*
        The `{' '}` separators that used to sit between these links are gone:
        they were the only thing keeping the three words apart, and a literal
        space between flex children becomes an anonymous flex item rather than
        a gap. `gap: var(--s-1)` on `.tabs` is the real spacing now.
      */}
      <nav className={styles.tabs} aria-label="Policy sections">
        <NavLink to="." end className={tabClassName}>
          Coverage
        </NavLink>
        <NavLink to="claims" className={tabClassName}>
          Claims
        </NavLink>
        <NavLink to="documents" className={tabClassName}>
          Documents
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}

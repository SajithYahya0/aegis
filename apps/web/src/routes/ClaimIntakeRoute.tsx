import { Suspense, lazy, useEffect, useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LinearProgress, Typography } from '@mui/material';
import { fetchPolicies } from '../shared/http/client';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useAppDispatch } from '../shared/store';
import { submitClaimThunk } from '../shared/store/claimsSlice';
import type { Policy } from '../shared/domain';

const ClaimIntake = lazy(() => import('claims/ClaimIntake'));

export default function ClaimIntakeRoute(): ReactElement {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const [policies, setPolicies] = useState<readonly Policy[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPolicies({ q: '', status: '', type: '', expiring: false }, controller.signal)
      .then(setPolicies)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <>
      <Typography variant="h1">New claim</Typography>
      <ErrorBoundary label="The claims-ops intake form">
        <Suspense fallback={<LinearProgress aria-label="Loading the claims form" />}>
          <ClaimIntake
            policies={policies}
            initialPolicyId={searchParams.get('policy') ?? ''}
            onFile={(draft) => dispatch(submitClaimThunk(draft)).unwrap()}
          />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

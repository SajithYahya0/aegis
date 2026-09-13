import { useEffect, useState, type ReactElement } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Card, CardContent, LinearProgress, Link, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { fetchClaims, fetchPolicies, fetchUnderwritingLimits } from '../shared/http/client';
import type { Decision, UnderwritingLimits } from '../shared/http/client';
import { formatCompactCurrency, formatCurrency, formatPercent } from '../shared/domain';
import type { Claim, Policy } from '../shared/domain';
import { UnderwritingDecisionForm } from './UnderwritingDecisionForm';

interface Referral {
  policy: Policy;
  lossRatio: number;
  reason: string;
}

function referralReason(
  policy: Policy,
  lossRatio: number,
  limits: UnderwritingLimits,
): string {
  if (policy.sumInsured > limits.autoBindLimit) {
    return `Above the ${formatCompactCurrency(limits.autoBindLimit)} auto-bind limit`;
  }
  if (lossRatio > limits.referralLossRatio) return `Loss ratio ${formatPercent(lossRatio)}`;
  return policy.status === 'pending' ? 'Awaiting underwriting' : '';
}

function buildReferrals(
  policies: readonly Policy[],
  claims: readonly Claim[],
  limits: UnderwritingLimits | null,
  recorded: readonly Decision[],
): readonly Referral[] {
  if (!limits) return [];
  const decided = new Set(recorded.map((decision) => decision.policyId));
  return policies
    .filter((policy) => !decided.has(policy.id))
    .map((policy) => {
      const incurred = claims
        .filter((claim) => claim.policyId === policy.id)
        .reduce((total, claim) => total + claim.amount, 0);
      const lossRatio = policy.sumInsured > 0 ? incurred / policy.sumInsured : 0;
      return { policy, lossRatio, reason: referralReason(policy, lossRatio, limits) };
    })
    .filter((referral) => referral.reason !== '')
    .sort((a, b) => b.policy.sumInsured - a.policy.sumInsured);
}

export default function UnderwritingPage(): ReactElement {
  const [policies, setPolicies] = useState<readonly Policy[]>([]);
  const [claims, setClaims] = useState<readonly Claim[]>([]);
  const [limits, setLimits] = useState<UnderwritingLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [recorded, setRecorded] = useState<readonly Decision[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchPolicies({ q: '', status: '', type: '', expiring: false }, controller.signal),
      fetchClaims(controller.signal),
      fetchUnderwritingLimits(controller.signal),
    ])
      .then(([book, allClaims, authority]) => {
        setPolicies(book);
        setClaims(allClaims);
        setLimits(authority);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const referrals = buildReferrals(policies, claims, limits, recorded);

  return (
    <>
      <Typography variant="h1">Underwriting</Typography>
      {loading ? <LinearProgress aria-label="Loading the referral queue" /> : null}
      <Card>
        <CardContent>
          <UnderwritingDecisionForm
            queue={referrals.map((referral) => referral.policy)}
            maxLoadingPct={limits?.maxLoadingPct ?? 0}
            onRecorded={(decision) => setRecorded((previous) => [decision, ...previous])}
          />
        </CardContent>
      </Card>
      <Card>
        <TableContainer>
          <Table size="small" aria-label="Referral queue">
            <TableHead>
              <TableRow>
                <TableCell>Policy</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Sum insured</TableCell>
                <TableCell align="right">Loss ratio</TableCell>
                <TableCell>Why it is referred</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {referrals.map(({ policy, lossRatio, reason }) => (
                <TableRow key={policy.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`/policies/${policy.id}`}>{policy.id}</Link>
                  </TableCell>
                  <TableCell>{policy.customerName}</TableCell>
                  <TableCell align="right">{formatCurrency(policy.sumInsured)}</TableCell>
                  <TableCell align="right">{formatPercent(lossRatio)}</TableCell>
                  <TableCell>{reason}</TableCell>
                </TableRow>
              ))}
              {!loading && referrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    Nothing is referred. The whole book is inside your authority.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      {recorded.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h2" sx={{ mb: 1 }}>Decisions recorded this session</Typography>
            {recorded.map((decision) => (
              <Typography key={decision.id} variant="body2">
                {decision.policyId} · {decision.outcome} · {decision.loadingPct}% —{' '}
                {decision.note}
              </Typography>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

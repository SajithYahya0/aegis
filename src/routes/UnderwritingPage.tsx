import { useMemo, useState, type ReactElement } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid2';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { customersById } from '../shared/data';
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  POLICY_TYPE_LABEL,
} from '../shared/format';
import {
  fetchAllClaims,
  fetchPolicies,
  fetchUnderwritingLimits,
  type UnderwritingDecision,
  type UnderwritingLimits,
} from '../shared/http/endpoints';
import { useFetch } from '../shared/hooks/useFetch';
import { useAppSelector } from '../shared/store';
import { selectExposureByCustomer } from '../shared/store/selectors';
import { useAuth } from '../shared/store/useAuth';
import { StatusChip } from '../shared/theme/StatusChip';
import type { Claim, Policy } from '../shared/types';
import { DecisionForm } from './underwriting/DecisionForm';

interface QueueBundle {
  policies: readonly Policy[];
  claims: readonly Claim[];
  limits: UnderwritingLimits;
}

interface Referral {
  policy: Policy;
  customerName: string;
  incurred: number;
  lossRatio: number;
  /** Why this policy is in the queue. Shown, because "why" is the decision. */
  reason: string;
}

/** How many referrals the queue shows. An underwriter works a page, not a book. */
const QUEUE_SIZE = 12;

export default function UnderwritingPage(): ReactElement {
  const { user } = useAuth();
  const exposure = useAppSelector(selectExposureByCustomer);
  const [recorded, setRecorded] = useState<readonly UnderwritingDecision[]>([]);

  /*
   * The burst. One fetcher, one signal, three requests in flight together —
   * see the header for why that shape is load-bearing rather than tidy.
   *
   * `[]` deps: none of the three depends on anything this component can
   * change. That is a genuine mount-only fetch, and it is the one place in the
   * app where a literal `[]` is correct — `useFetch`'s other caller
   * (`PolicyClaimsTab`) keys on `policyId` precisely because Router reuses its
   * instance across `:id` changes. This page has no such parameter.
   */
  const { data, error, loading } = useFetch<QueueBundle>(
    async (signal) => {
      const [policies, claims, limits] = await Promise.all([
        fetchPolicies(signal),
        fetchAllClaims(signal),
        fetchUnderwritingLimits(signal),
      ]);
      return { policies, claims, limits };
    },
    [],
  );

  /*
   * The queue, derived in a memo rather than in an effect + state. It is a
   * pure function of what the request returned and of which policies have
   * already been decided this session, so an effect would render once with the
   * old value, once with the new, and add a state variable that can disagree
   * with its own inputs (W2-D1-07).
   */
  const referrals = useMemo<readonly Referral[]>(() => {
    if (!data) return [];
    const { policies, claims, limits } = data;

    const incurredByPolicy = new Map<string, number>();
    for (const claim of claims) {
      incurredByPolicy.set(claim.policyId, (incurredByPolicy.get(claim.policyId) ?? 0) + claim.amount);
    }

    const decided = new Set(recorded.map((decision) => decision.policyId));

    return policies
      .filter((policy) => !decided.has(policy.id))
      .map((policy) => {
        const incurred = incurredByPolicy.get(policy.id) ?? 0;
        const lossRatio = policy.sumInsured > 0 ? incurred / policy.sumInsured : 0;
        // Checked in the order an underwriter would: size first, then
        // experience, then status. The first match wins, so the reason shown
        // is the most material one rather than the last one evaluated.
        const reason =
          policy.sumInsured > limits.autoBindLimit
            ? `Above the ${formatCompactCurrency(limits.autoBindLimit)} auto-bind limit`
            : lossRatio > limits.referralLossRatio
              ? `Loss ratio ${formatPercent(lossRatio)}`
              : policy.status === 'pending'
                ? 'Awaiting underwriting'
                : '';
        return { policy, customerName: customersById.get(policy.customerId)?.name ?? '—', incurred, lossRatio, reason };
      })
      .filter((referral) => referral.reason !== '')
      .sort((a, b) => b.policy.sumInsured - a.policy.sumInsured)
      .slice(0, QUEUE_SIZE);
  }, [data, recorded]);

  const totalSumInsured = exposure.reduce((sum, row) => sum + row.sumInsured, 0);
  const totalPremium = exposure.reduce((sum, row) => sum + row.annualPremium, 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h1">Underwriting</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {user.name} · {user.branch} · exposure across {exposure.length} customers
        </Typography>
      </Box>

      {/*
        One `Grid` container for the whole page, so the vertical gutter between
        the metric row and the panels below is the same 16px as the horizontal
        one. The `size` objects are resolved against `theme.breakpoints`; there
        is no hand-written media query in this file.
      */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Metric label="Sum insured" value={formatCompactCurrency(totalSumInsured)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Metric label="Annual premium" value={formatCompactCurrency(totalPremium)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Metric
            label="Rate on line"
            value={formatPercent(totalSumInsured > 0 ? totalPremium / totalSumInsured : 0)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Metric
            label="Auto-bind limit"
            value={data ? formatCompactCurrency(data.limits.autoBindLimit) : '—'}
            caption={data ? `Loading cap ${data.limits.maxLoadingPct}%` : 'From the server'}
          />
        </Grid>

        <Grid size={12}>
          <Card>
            <CardContent>
              {loading ? <LinearProgress aria-label="Loading the referral queue" /> : null}

              {error ? (
                <Alert severity="error">{error.message}</Alert>
              ) : null}

              {data ? (
                <DecisionForm
                  queue={referrals.map((referral) => referral.policy)}
                  maxLoadingPct={data.limits.maxLoadingPct}
                  onRecorded={(decision) => setRecorded((prev) => [decision, ...prev])}
                />
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h2" component="h2" sx={{ mb: 1 }}>
                Referral queue
              </Typography>
              <TableContainer>
                <Table size="small" aria-label="Referral queue">
                  <TableHead>
                    <TableRow>
                      <TableCell>Policy</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        Customer
                      </TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Sum insured</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        Why
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {referrals.map(({ policy, customerName, reason }) => (
                      <TableRow key={policy.id} hover>
                        <TableCell>
                          <Link component={RouterLink} to={`/policies/${policy.id}`}>
                            {policy.id}
                          </Link>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {POLICY_TYPE_LABEL[policy.type]}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {customerName}
                        </TableCell>
                        <TableCell>
                          {/*
                            The second MUI surface `StatusChip` renders on, and
                            it wants the badge for its own reasons: a referral
                            queue that does not say whether a policy is pending
                            or already lapsed is asking for a decision on
                            incomplete information.
                          */}
                          <StatusChip status={policy.status} />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(policy.sumInsured)}</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          {reason}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && referrals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Nothing referred. Everything in the book is inside your authority.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h2" component="h2" sx={{ mb: 1 }}>
                Exposure by customer
              </Typography>
              <TableContainer>
                <Table size="small" aria-label="Exposure by customer">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell align="right">Policies</TableCell>
                      <TableCell align="right">Sum insured</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {exposure.slice(0, QUEUE_SIZE).map((row) => (
                      <TableRow key={row.customerId} hover>
                        <TableCell>
                          <Link component={RouterLink} to={`/policies/${row.firstPolicyId}`}>
                            {row.customerName}
                          </Link>
                        </TableCell>
                        <TableCell align="right">{row.policyCount}</TableCell>
                        <TableCell align="right">{formatCurrency(row.sumInsured)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {recorded.length > 0 ? (
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="h2" component="h2" sx={{ mb: 1 }}>
                  Decisions recorded this session
                </Typography>
                {recorded.map((decision) => (
                  <Typography key={decision.id} variant="body2">
                    {decision.id} · {decision.policyId} · {decision.outcome} ·{' '}
                    {decision.loadingPct}% — {decision.note}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          </Grid>
        ) : null}
      </Grid>
    </Box>
  );
}

function Metric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}): ReactElement {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="h2" component="p">
          {value}
        </Typography>
        {caption ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {caption}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

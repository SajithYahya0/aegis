/**
 * WHY THIS EXISTS:
 *   The authenticated dashboard — the one screen where all four Week 4 topics
 *   are visible at once, and the route `RequireRole` protects.
 *
 *     • MUI / theming    — `Grid2`, `Card`, `Table`, `Button`, `Alert`,
 *                          `StatusChip` (`styled()`), `sx` for the one-offs.
 *     • axios            — three requests fired *in parallel* on mount, each
 *                          carrying the same `AbortSignal`, each passing
 *                          through all three interceptors.
 *     • Redux Toolkit    — the role gate reads `state.auth.role`; the exposure
 *                          totals come from the memoised
 *                          `selectExposureByCustomer`.
 *     • react-hook-form  — `DecisionForm`, on a Zod schema built from the
 *                          limits the *server* just sent.
 *
 *   THE PARALLEL BURST IS THE POINT, not a coincidence of layout. W4-D3-04 —
 *   the 401 single-flight refresh — was qualified in the matrix for exactly one
 *   missing thing: no built surface fired several requests at once, so the
 *   queue that collapses N concurrent 401s into one `POST /auth/refresh` was
 *   pinned by `interceptors.test.ts` and by nothing a reviewer could click.
 *   This page is that click. Open it with the `expire-token` lab toggle armed
 *   and the console shows three requests going out, three 401s coming back,
 *   *one* refresh, and three replays — with no fourth request and nothing on
 *   screen going wrong.
 *
 *   The three reads are genuinely three, not one endpoint split up to make a
 *   point: the book, the claims history that prices its loss experience, and
 *   the branch's authority limits are three separate resources that change on
 *   three separate schedules, and a real backend would serve them from three
 *   places. They are fired with `Promise.all` inside one `useFetch` fetcher so
 *   they share a single `AbortSignal` — navigating away mid-load aborts all
 *   three, and the console prints one cleanup line and three cancellations.
 *
 * CONCEPTS: W4-D5-04, W4-D3-01, W4-D3-03, W4-D3-04, W4-D3-05, W4-D4-01, W4-D4-04, W4-D1-02, W4-D1-03, W4-D1-04, W4-D2-04, W4-D2-05
 *
 * WITHOUT THIS:
 *   `/underwriting` in the route table would have nowhere to send an
 *   underwriter who *is* allowed through, so the only observable behaviour of
 *   `RequireRole` would be the rejection path — there would be nothing to
 *   compare it against.
 *
 *   And `selectExposureByCustomer` would have no consumer at all, which is
 *   worse than it sounds: a memoised selector nothing subscribes to is a cache
 *   that is never hit, so the claim that it avoids re-pricing the book on
 *   every dispatched action could not be checked by anybody. Here it can be,
 *   from the console: `[compute] exposure roll-up` and `[rating] rateBook …`
 *   print once on arrival, and then stay silent through the login, the
 *   refresh and every status transition those fire — because the selector's
 *   only input is `state.auth.user`.
 *
 *   WITHOUT THE ROLE SCOPING: the roll-up would be the same table for both
 *   roles, and the selector would have no input that ever changes — a memo
 *   that never recomputes proves nothing, because a constant would pass the
 *   same test.
 *
 *   WITHOUT THE LIMITS COMING FROM THE SERVER: the auto-bind threshold and the
 *   loading cap would be constants in this file, and the referral queue would
 *   say the same thing no matter who was signed in. They arrive over the wire
 *   instead, and the endpoint reads the role out of the *bearer token* rather
 *   than out of a query parameter — which makes this the one place in the app
 *   where the request interceptor's work is visible in a response body. Switch
 *   role in the AppBar, the store re-authenticates, the interceptor attaches
 *   the newly minted `at-N-underwriter`, and the limits come back different.
 *
 *   WITHOUT `useFetch`: this page would need its own `loading`/`error`/`data`
 *   triple and its own `AbortController`, which is the hook's whole job and is
 *   already written. Note what that reuse costs and buys: `useFetch` is the
 *   *hand-rolled* Week 2 hook (W2-D1-02, W2-D1-03) driving the *library*
 *   transport underneath. The two halves are orthogonal on purpose — the
 *   contrast Week 4 is built on is `fetch` versus `axios`, not "a hook" versus
 *   "a library", and mixing them here is what shows that.
 *
 *   WITHOUT THE PAGE-LEVEL `error` BRANCH: a 503 from any of the three would
 *   leave the table rendering `null` rows under a heading that promises data.
 *   The message shown is the backend's own sentence, which it only is because
 *   interceptor (c) normalised it — a raw axios failure would render "Request
 *   failed with status code 503".
 */

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

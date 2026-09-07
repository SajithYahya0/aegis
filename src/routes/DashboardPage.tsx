import type { ReactElement, ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { parseISO } from 'date-fns';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid2';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { AS_OF, claims, customersById, policies } from '../shared/data';
import {
  CLAIM_STATUS_LABEL,
  POLICY_TYPE_LABEL,
  daysUntil,
  formatCompactCurrency,
  formatDate,
  formatNumber,
} from '../shared/format';
import { EXPIRING_WINDOW_DAYS } from '../shared/hooks/usePolicyFilters';
import { StatusChip } from '../shared/theme/StatusChip';
import type { ClaimStatus, Policy } from '../shared/types';

interface RedirectState {
  attemptedPath?: string;
}

/** Rows shown before the table stops being a summary and becomes a report. */
const RENEWAL_ROWS = 8;

const VALUATION_DATE = parseISO(AS_OF);

/* -------------------------------------------------------------------------- */
/* Derived once at import — see the header                                    */
/* -------------------------------------------------------------------------- */

const activePolicies = policies.filter((policy) => policy.status === 'active');

const activeSumInsured = activePolicies.reduce((total, policy) => total + policy.sumInsured, 0);

/**
 * Same window and same sign test as the `expiring=1` filter on /policies, from
 * the same exported constant — a policy that has already lapsed is not a
 * renewal opportunity, so negative day counts are excluded rather than sorted
 * to the top.
 */
const expiringPolicies: readonly Policy[] = policies
  .filter((policy) => {
    const days = daysUntil(policy.endDate, VALUATION_DATE);
    return days >= 0 && days <= EXPIRING_WINDOW_DAYS;
  })
  .slice()
  .sort((a, b) => a.endDate.localeCompare(b.endDate));

/** Fixed order, so the breakdown does not reshuffle with the data. */
const CLAIM_STATUS_ORDER: readonly ClaimStatus[] = [
  'draft',
  'submitted',
  'underReview',
  'approved',
  'rejected',
];

const CLAIM_COUNTS: Record<ClaimStatus, number> = claims.reduce(
  (counts, claim) => {
    counts[claim.status] += 1;
    return counts;
  },
  { draft: 0, submitted: 0, underReview: 0, approved: 0, rejected: 0 },
);

/** Open = still costing someone a decision. Drives the third metric card. */
const openClaimCount = CLAIM_COUNTS.submitted + CLAIM_COUNTS.underReview;

const METRICS: readonly { label: string; value: string; note: string }[] = [
  {
    label: 'Policies in force',
    value: formatNumber(activePolicies.length),
    note: `of ${formatNumber(policies.length)} written`,
  },
  {
    label: 'Sum insured',
    value: formatCompactCurrency(activeSumInsured),
    note: 'active policies only',
  },
  {
    label: 'Open claims',
    value: formatNumber(openClaimCount),
    note: 'submitted or under review',
  },
  {
    label: `Expiring in ${EXPIRING_WINDOW_DAYS} days`,
    value: formatNumber(expiringPolicies.length),
    note: `from ${formatDate(AS_OF)}`,
  },
];

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Four instances, one shape. Local to this file rather than exported to
 * `shared/components` because nothing else renders one yet — a shared
 * component with a single consumer is a guess about the second consumer, and
 * the guess is what makes it the wrong shape when that consumer arrives.
 */
function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="h1" component="p" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {note}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** A titled card body, so the two panels below the metrics line up. */
function PanelCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'baseline', justifyContent: 'space-between', px: 2, pt: 2, pb: 1 }}
      >
        <Typography variant="h2">{title}</Typography>
        {action}
      </Stack>
      {children}
    </Card>
  );
}

export default function DashboardPage(): ReactElement {
  const location = useLocation();
  const attemptedPath = (location.state as RedirectState | null)?.attemptedPath;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h1">Dashboard</Typography>

      {attemptedPath ? (
        <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'primary.light', color: 'primary.dark' }}>
          <Typography variant="body2">
            You were redirected from <code>{attemptedPath}</code> — that page requires the
            underwriter role. Switch roles in the header to view it.
          </Typography>
        </Box>
      ) : null}

      {/*
        One container for all six items, not one per row. Two containers would
        put an independent gutter between the metric row and the panel row,
        and the vertical rhythm would stop matching the horizontal one.
      */}
      <Grid container spacing={2}>
        {METRICS.map((metric) => (
          <Grid key={metric.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <MetricCard {...metric} />
          </Grid>
        ))}

        <Grid size={{ xs: 12, md: 8 }}>
          <PanelCard
            title="Expiring soon"
            action={
              <Link component={RouterLink} to="/policies?expiring=1" variant="body2">
                All {formatNumber(expiringPolicies.length)}
              </Link>
            }
          >
            {/*
              TableContainer, not a bare Table: it is the element that scrolls.
              Without it the table sets its own min-width and pushes the Card —
              and therefore the Grid column — wider than its track, so on a
              narrow viewport the whole page scrolls sideways instead of the
              table doing it inside its own box.
            */}
            <TableContainer>
              <Table size="small" aria-label="Policies expiring soon">
                <TableHead>
                  <TableRow>
                    <TableCell>Policy</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      Customer
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Type</TableCell>
                    <TableCell>Expires</TableCell>
                    <TableCell align="right">Days</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expiringPolicies.slice(0, RENEWAL_ROWS).map((policy) => (
                    <TableRow key={policy.id} hover>
                      <TableCell>
                        <Link component={RouterLink} to={`/policies/${policy.id}`}>
                          {policy.id}
                        </Link>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {customersById.get(policy.customerId)?.name ?? '—'}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        {POLICY_TYPE_LABEL[policy.type]}
                      </TableCell>
                      <TableCell>{formatDate(policy.endDate)}</TableCell>
                      <TableCell align="right">
                        {daysUntil(policy.endDate, VALUATION_DATE)}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={policy.status} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}

                  {expiringPolicies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Nothing expires in the next {EXPIRING_WINDOW_DAYS} days.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </PanelCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <PanelCard title="Claims by status">
            <Stack sx={{ px: 2, pb: 2, gap: 1.5 }}>
              {CLAIM_STATUS_ORDER.map((status) => {
                const count = CLAIM_COUNTS[status];
                const share = claims.length === 0 ? 0 : count / claims.length;

                return (
                  <Box key={status}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
                    >
                      <Typography variant="body2">{CLAIM_STATUS_LABEL[status]}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatNumber(count)}
                      </Typography>
                    </Stack>
                    {/*
                      A proportion bar rather than a number alone: 12 approved
                      means nothing until it is 12 out of how many. Two Boxes
                      and a width percentage — a charting dependency for one
                      horizontal rule would be the tail wagging the dog.
                    */}
                    <Box
                      sx={{ mt: 0.5, height: 4, borderRadius: 2, bgcolor: 'action.hover' }}
                      aria-hidden
                    >
                      <Box
                        sx={{
                          width: `${share * 100}%`,
                          height: '100%',
                          borderRadius: 2,
                          bgcolor: 'primary.main',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}

              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {formatNumber(claims.length)} claims filed against{' '}
                {formatNumber(policies.length)} policies.
              </Typography>
            </Stack>
          </PanelCard>
        </Grid>
      </Grid>
    </Box>
  );
}

import { useEffect, useState, type ReactElement } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Alert, Card, CardContent, LinearProgress, Link, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { fetchClaims, fetchPolicies, fetchQuoteRequests } from '../shared/http/client';
import type { QuoteRequest } from '../shared/http/client';
import { useAppSelector } from '../shared/store';
import {
  POLICY_TYPE_LABEL, daysUntil, formatCompactCurrency, formatCurrency, formatDate,
} from '../shared/domain';
import type { Claim, Policy } from '../shared/domain';

const EXPIRING_WINDOW_DAYS = 30;
const RENEWAL_ROWS = 8;
const MUTED = { color: 'text.secondary' };
const WRAP = { flexWrap: 'wrap' };
const MD_ONLY = { display: { xs: 'none', md: 'table-cell' } };
const CARD_HEADER = { alignItems: 'baseline', justifyContent: 'space-between', p: 2 };

interface MetricProps {
  label: string;
  value: string;
  note: string;
}

function Metric({ label, value, note }: MetricProps): ReactElement {
  return (
    <Card sx={{ flex: 1, minWidth: 180 }}>
      <CardContent>
        <Typography variant="body2" sx={MUTED}>
          {label}
        </Typography>
        <Typography variant="h1" component="p">
          {value}
        </Typography>
        <Typography variant="body2" sx={MUTED}>
          {note}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage(): ReactElement {
  const { state } = useLocation();
  const blockedFrom = (state as { blockedFrom?: string } | null)?.blockedFrom;
  const filedThisSession = useAppSelector((store) => store.claims.submitted);
  const [policies, setPolicies] = useState<readonly Policy[]>([]);
  const [claims, setClaims] = useState<readonly Claim[]>([]);
  const [enquiries, setEnquiries] = useState<readonly QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchPolicies({ q: '', status: '', type: '', expiring: false }, controller.signal),
      fetchClaims(controller.signal),
    ])
      .then(([book, allClaims]) => {
        setPolicies(book);
        setClaims(allClaims);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    fetchQuoteRequests(controller.signal).then(setEnquiries).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const isExpiring = (policy: Policy): boolean => {
    const days = daysUntil(policy.endDate);
    return days >= 0 && days <= EXPIRING_WINDOW_DAYS;
  };
  const byEndDate = (a: Policy, b: Policy): number => a.endDate.localeCompare(b.endDate);

  const expiring = policies.filter(isExpiring).sort(byEndDate);
  const inForce = policies.filter((policy) => policy.status === 'active');
  const sumInsured = inForce.reduce((total, policy) => total + policy.sumInsured, 0);
  const openClaims = claims.filter(
    (claim) => claim.status === 'submitted' || claim.status === 'underReview',
  );

  return (
    <>
      <Typography variant="h1">Dashboard</Typography>
      {blockedFrom ? (
        <Alert severity="info">
          {blockedFrom} needs the underwriter role. Switch roles in the header to reach it.
        </Alert>
      ) : null}
      {loading ? <LinearProgress aria-label="Loading the book" /> : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap sx={WRAP}>
        <Metric
          label="Policies in force"
          value={String(inForce.length)}
          note={`of ${policies.length} written`}
        />
        <Metric
          label="Sum insured"
          value={formatCompactCurrency(sumInsured)}
          note="active policies only"
        />
        <Metric
          label="Open claims"
          value={String(openClaims.length)}
          note="submitted or under review"
        />
        <Metric
          label={`Expiring in ${EXPIRING_WINDOW_DAYS} days`}
          value={String(expiring.length)}
          note="renewal calls due"
        />
      </Stack>
      {enquiries.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h2" sx={{ mb: 1 }}>Quote requests from the website</Typography>
            {enquiries.map((enquiry) => (
              <Typography key={enquiry.id} variant="body2">
                {enquiry.name} · {enquiry.city} · {POLICY_TYPE_LABEL[enquiry.policyType]} ·{' '}
                {formatCurrency(enquiry.sumInsured)} quoted at{' '}
                {formatCurrency(enquiry.indicativePremium)} ·{' '}
                <Link href={`tel:${enquiry.phone}`}>{enquiry.phone}</Link>
              </Typography>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {filedThisSession.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h2" sx={{ mb: 1 }}>Filed this session</Typography>
            {filedThisSession.map((claim) => (
              <Typography key={claim.id} variant="body2">
                {claim.id} · {formatCurrency(claim.amount)} ·{' '}
                <Link component={RouterLink} to={`/policies/${claim.policyId}/claims`}>
                  {claim.policyId}
                </Link>
              </Typography>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <Stack direction="row" sx={CARD_HEADER}>
          <Typography variant="h2">Expiring soon</Typography>
          <Link component={RouterLink} to="/policies?expiring=1" variant="body2">
            See all {expiring.length}
          </Link>
        </Stack>
        <TableContainer>
          <Table size="small" aria-label="Policies expiring soon">
            <TableHead>
              <TableRow>
                <TableCell>Policy</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell sx={MD_ONLY}>Type</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell align="right">Days</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expiring.slice(0, RENEWAL_ROWS).map((policy) => (
                <TableRow key={policy.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`/policies/${policy.id}`}>{policy.id}</Link>
                  </TableCell>
                  <TableCell>{policy.customerName}</TableCell>
                  <TableCell sx={MD_ONLY}>{POLICY_TYPE_LABEL[policy.type]}</TableCell>
                  <TableCell>{formatDate(policy.endDate)}</TableCell>
                  <TableCell align="right">{daysUntil(policy.endDate)}</TableCell>
                </TableRow>
              ))}
              {!loading && expiring.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    Nothing expires in the next {EXPIRING_WINDOW_DAYS} days.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );
}

/**
 * WHY THIS EXISTS:
 *   The route `RequireRole` protects, and the consumer of the app's one
 *   memoised Redux selector. It answers the question an underwriter opens the
 *   console for — how much exposure is on the book, and against which
 *   customers — by reading `selectExposureByCustomer` off the store rather
 *   than computing it here.
 *
 * CONCEPTS: W4-D4-01, W4-D4-04, W4-D1-02, W4-D2-04, W4-D2-05
 *
 * WITHOUT THIS:
 *   `/underwriting` in the route table would have nowhere to send an
 *   underwriter who *is* allowed through, so the only observable behaviour of
 *   `RequireRole` would be the rejection path — there would be nothing to
 *   compare it against.
 *
 *   And `selectExposureByCustomer` would have no consumer at all, which is
 *   worse than it sounds: a memoised selector nothing subscribes to is a
 *   cache that is never hit, so the claim that it avoids re-pricing the book
 *   on every dispatched action could not be checked by anybody. Here it can
 *   be, from the console: open this page, and `[compute] exposure roll-up` and
 *   `[rating] rateBook …` print once. Then switch role, let the token expire
 *   via the lab panel, watch four or five auth actions go through the store —
 *   and neither line prints again until the *user* changes, because the user
 *   is the selector's only input.
 *
 *   WITHOUT THE ROLE SCOPING: the roll-up would be the same table for both
 *   roles, and the selector would have no input that ever changes — a memo
 *   that never recomputes proves nothing, because a constant would pass the
 *   same test. An agent sees the customers written out of their own branch;
 *   an underwriter prices the whole book, which is what the role is for.
 *
 *   Note that an agent cannot reach this page — `RequireRole` turns them away
 *   — so the agent-scoped branch is reachable only in the instant after the
 *   role is switched back, and the totals are the underwriter's in practice.
 *   The scoping is still the honest rule for the data rather than a switch
 *   invented for the demo: the same rule is what a second, agent-facing
 *   consumer of this selector would need.
 */

import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { formatCompactCurrency, formatCurrency, formatPercent } from '../shared/format';
import { useAppSelector } from '../shared/store';
import { selectExposureByCustomer } from '../shared/store/selectors';
import { useAuth } from '../shared/store/useAuth';

export default function UnderwritingPage(): ReactElement {
  const { user } = useAuth();
  const exposure = useAppSelector(selectExposureByCustomer);

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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Metric label="Sum insured" value={formatCompactCurrency(totalSumInsured)} />
        <Metric label="Annual premium" value={formatCompactCurrency(totalPremium)} />
        <Metric
          label="Rate on line"
          value={formatPercent(totalSumInsured > 0 ? totalPremium / totalSumInsured : 0)}
        />
      </Stack>

      <TableContainer component={Card}>
        <Table size="small" aria-label="Exposure by customer">
          <TableHead>
            <TableRow>
              <TableCell>Customer</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>City</TableCell>
              <TableCell align="right">Policies</TableCell>
              <TableCell align="right">Sum insured</TableCell>
              <TableCell align="right">Annual premium</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exposure.map((row) => (
              <TableRow key={row.customerId} hover>
                <TableCell>
                  <Link to={`/policies/${row.firstPolicyId}`}>{row.customerName}</Link>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{row.city}</TableCell>
                <TableCell align="right">{row.policyCount}</TableCell>
                <TableCell align="right">{formatCurrency(row.sumInsured)}</TableCell>
                <TableCell align="right">{formatCurrency(row.annualPremium)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="h2" component="p">
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

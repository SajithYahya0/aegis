import type { ReactElement } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button, Card, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography,
} from '@mui/material';
import {
  CLAIM_STATUS_COLOR, CLAIM_STATUS_LABEL, CLAIM_TYPE_LABEL, formatCurrency, formatDate,
} from '../shared/domain';
import { usePolicyDetail } from './PolicyDetailPage';

const CARD_HEADER = { alignItems: 'center', justifyContent: 'space-between', p: 2 };

export function PolicyCoverageTab(): ReactElement {
  const { policy } = usePolicyDetail();

  return (
    <Card>
      <TableContainer>
        <Table size="small" aria-label="Coverage lines">
          <TableHead>
            <TableRow>
              <TableCell>Coverage</TableCell>
              <TableCell align="right">Limit</TableCell>
              <TableCell align="right">Deductible</TableCell>
              <TableCell>Basis</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policy.coverages.map((coverage) => (
              <TableRow key={coverage.code} hover>
                <TableCell>{coverage.label}</TableCell>
                <TableCell align="right">{formatCurrency(coverage.limit)}</TableCell>
                <TableCell align="right">{formatCurrency(coverage.deductible)}</TableCell>
                <TableCell>{coverage.mandatory ? 'Mandatory' : 'Optional'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

export function PolicyClaimsTab(): ReactElement {
  const { policy, claims } = usePolicyDetail();
  const incurred = claims.reduce((total, claim) => total + claim.amount, 0);

  return (
    <Card>
      <Stack direction="row" spacing={2} sx={CARD_HEADER}>
        <Typography variant="body2">
          {claims.length} claim(s) · {formatCurrency(incurred)} incurred against{' '}
          {formatCurrency(policy.sumInsured)} insured
        </Typography>
        <Button
          component={RouterLink}
          to={`/claims/new?policy=${policy.id}`}
          variant="contained"
          size="small"
        >
          File a claim
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small" aria-label="Claims on this policy">
          <TableHead>
            <TableRow>
              <TableCell>Claim</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Filed</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {claims.map((claim) => (
              <TableRow key={claim.id} hover>
                <TableCell>{claim.id}</TableCell>
                <TableCell>{CLAIM_TYPE_LABEL[claim.type]}</TableCell>
                <TableCell>{formatDate(claim.filedAt)}</TableCell>
                <TableCell align="right">{formatCurrency(claim.amount)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={CLAIM_STATUS_COLOR[claim.status]}
                    label={CLAIM_STATUS_LABEL[claim.status]}
                  />
                </TableCell>
              </TableRow>
            ))}
            {claims.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No claims have been filed against this policy.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

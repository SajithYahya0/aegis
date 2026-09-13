import { memo, type ReactElement } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Chip, FormControlLabel, Link, MenuItem, Stack, Switch, TableCell, TableRow,
  TextField,
} from '@mui/material';
import {
  POLICY_STATUSES, POLICY_STATUS_COLOR, POLICY_STATUS_LABEL, POLICY_TYPES,
  POLICY_TYPE_LABEL, formatCurrency, formatDate,
} from '../shared/domain';
import type { Policy, PolicyStatus, PolicyType } from '../shared/domain';

export interface PolicyFilterBarProps {
  query: string;
  status: PolicyStatus | '';
  type: PolicyType | '';
  expiring: boolean;
  onQueryChange: (query: string) => void;
  onParamChange: (key: string, value: string | null) => void;
}

export function PolicyFilterBar({
  query,
  status,
  type,
  expiring,
  onQueryChange,
  onParamChange,
}: PolicyFilterBarProps): ReactElement {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
      <TextField
        label="Search"
        placeholder="Policy number or customer"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        sx={{ flex: 1, minWidth: 220 }}
      />
      <TextField
        select
        label="Status"
        value={status}
        sx={{ minWidth: 150 }}
        onChange={(event) => onParamChange('status', event.target.value || null)}
      >
        <MenuItem value="">All statuses</MenuItem>
        {POLICY_STATUSES.map((value) => (
          <MenuItem key={value} value={value}>
            {POLICY_STATUS_LABEL[value]}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Type"
        value={type}
        sx={{ minWidth: 150 }}
        onChange={(event) => onParamChange('type', event.target.value || null)}
      >
        <MenuItem value="">All types</MenuItem>
        {POLICY_TYPES.map((value) => (
          <MenuItem key={value} value={value}>
            {POLICY_TYPE_LABEL[value]}
          </MenuItem>
        ))}
      </TextField>
      <FormControlLabel
        label="Expiring in 30 days"
        control={
          <Switch
            checked={expiring}
            onChange={(event) => onParamChange('expiring', event.target.checked ? '1' : null)}
          />
        }
      />
    </Stack>
  );
}

export interface PolicyRowProps {
  policy: Policy;
  onSelect: (policy: Policy) => void;
}

function PolicyRowImpl({ policy, onSelect }: PolicyRowProps): ReactElement {
  return (
    <TableRow hover>
      <TableCell>
        <Link component={RouterLink} to={`/policies/${policy.id}`} onClick={() => onSelect(policy)}>
          {policy.id}
        </Link>
      </TableCell>
      <TableCell>{policy.customerName}</TableCell>
      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
        {POLICY_TYPE_LABEL[policy.type]}
      </TableCell>
      <TableCell>
        <Chip
          size="small"
          variant="outlined"
          color={POLICY_STATUS_COLOR[policy.status]}
          label={POLICY_STATUS_LABEL[policy.status]}
        />
      </TableCell>
      <TableCell align="right">{formatCurrency(policy.sumInsured)}</TableCell>
      <TableCell align="right">{formatCurrency(policy.annualPremium)}</TableCell>
      <TableCell align="right">{formatDate(policy.endDate)}</TableCell>
    </TableRow>
  );
}

export const PolicyRow = memo(PolicyRowImpl);

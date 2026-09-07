import Chip, { type ChipProps } from '@mui/material/Chip';
import { styled } from '@mui/material/styles';
import { POLICY_STATUS_LABEL } from '../format';
import type { PolicyStatus } from '../types';

/*
 * `shouldForwardProp` is what keeps `status` in the style callback and out of
 * the DOM — see the header. The generic parameter is what makes `status`
 * visible to that callback in the first place; without it, `styled(Chip)`
 * knows only about `ChipProps` and `theme.palette.status[status]` has nothing
 * to index with.
 */
const StatusChipRoot = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: PolicyStatus }>(({ theme, status }) => ({
  /*
   * Chip ships as a 32px pill. The badge it is impersonating is a 2px-padded
   * inline block on a 4px corner, so height, padding and radius are all
   * overridden — and the label slot has its own 12px horizontal padding that
   * survives anything set on the root, which is why `.MuiChip-label` is
   * addressed directly. Styling only the root leaves the chip 24px wider than
   * the CSS Modules badge, which is the visible tell that a "same badge"
   * claim has not actually been checked side by side.
   */
  height: 'auto',
  padding: `2px ${theme.spacing(1)}`,
  borderRadius: theme.shape.borderRadius,
  fontSize: '11px',
  fontWeight: 600,
  lineHeight: 1.45,
  backgroundColor: theme.palette.status[status].soft,
  color: theme.palette.status[status].main,
  '& .MuiChip-label': { padding: 0 },
}));

export interface StatusChipProps extends Omit<ChipProps, 'color' | 'label'> {
  status: PolicyStatus;
}

/**
 * The label comes from `POLICY_STATUS_LABEL`, the same map `PolicyRow` reads.
 * Letting call sites pass their own label is how "Lapsed" on one surface
 * becomes "Lapsed policy" on another; `label` is therefore omitted from the
 * public props rather than merely defaulted.
 */
export function StatusChip({ status, ...rest }: StatusChipProps) {
  return <StatusChipRoot {...rest} status={status} label={POLICY_STATUS_LABEL[status]} />;
}

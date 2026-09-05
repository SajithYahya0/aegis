/**
 * WHY THIS EXISTS:
 *   The `/` index route, and the first MUI surface in the app. It does two
 *   jobs: it is where a `RequireRole` redirect lands, so it reads
 *   `location.state.attemptedPath` and tells the agent why they ended up here;
 *   and it is where the book-by-status breakdown lives, which is what puts a
 *   `StatusChip` on a MUI surface next to a `PolicyRow` badge on a CSS Modules
 *   one.
 *
 * CONCEPTS: W2-D4-02, W2-D4-08, W4-D2-05, W4-D2-04
 *
 * WITHOUT THIS:
 *   `RequireRole` calls `navigate('/', { state: { attemptedPath } })`, but if
 *   nothing on `/` reads `location.state`, that state is inert — collected and
 *   then discarded, which makes `useLocation`'s presence in `RequireRole` look
 *   decorative rather than load-bearing. An agent bounced off `/underwriting`
 *   would just see the dashboard with no explanation.
 *
 *   WHY `sx` HERE AND NOT `styled()`: every style on this page is used once,
 *   on this page, with no variant axis — a column gap, a top margin, a padded
 *   notice box. Promoting them to `styled()` components buys nothing and costs
 *   a named export, an import and a level of indirection between reading
 *   `<Box>` and knowing what it looks like. It also costs the thing `styled()`
 *   is actually for: `styled()` serialises once per distinct set of props and
 *   caches the class, which pays off across many instances and pays for
 *   nothing across one.
 *
 *   The status badge is the opposite case and is deliberately NOT written as
 *   `sx` here: it is reused, it varies by `PolicyStatus`, and its colours have
 *   to stay pinned to `theme.palette.status`. Written inline as
 *   `sx={{ bgcolor: theme.palette.status[s].soft, … }}` it would be
 *   re-serialised for every chip on every render, and — the part that actually
 *   bites — it would be copied to the next MUI surface that needs a badge and
 *   drift from this one. See `src/shared/theme/StatusChip.tsx` for the full
 *   trade, including what the CSS Modules twin costs.
 *
 *   WITHOUT THE MODULE-LEVEL COUNT: `STATUS_COUNTS` is computed once at import
 *   rather than in a `useMemo`. The seed book is frozen and never mutates, so
 *   a `useMemo` here would be a hook that can never miss its cache — the
 *   memoisation would be real but unobservable, which is the shape this repo
 *   records as a weak claim rather than a demonstration. The genuine
 *   `useMemo`-over-expensive-work case is `rateBook` on /policies (W3-D1-03),
 *   where a keystroke actually re-runs it.
 */

import type { ReactElement } from 'react';
import { useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { policies } from '../shared/data';
import { StatusChip } from '../shared/theme/StatusChip';
import type { PolicyStatus } from '../shared/types';

interface RedirectState {
  attemptedPath?: string;
}

/* Fixed order, so the row does not reshuffle with the data. */
const STATUS_ORDER: readonly PolicyStatus[] = ['active', 'pending', 'lapsed', 'cancelled'];

const STATUS_COUNTS: Record<PolicyStatus, number> = policies.reduce(
  (counts, policy) => {
    counts[policy.status] += 1;
    return counts;
  },
  { active: 0, pending: 0, lapsed: 0, cancelled: 0 },
);

export default function DashboardPage(): ReactElement {
  const location = useLocation();
  const attemptedPath = (location.state as RedirectState | null)?.attemptedPath;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h1">Dashboard</Typography>

      {attemptedPath ? (
        <Box
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: 'primary.light',
            color: 'primary.dark',
          }}
        >
          <Typography variant="body2">
            You were redirected from <code>{attemptedPath}</code> — that page requires the
            underwriter role. Switch roles in the header to view it.
          </Typography>
        </Box>
      ) : null}

      <Box component="section">
        <Typography variant="h2">Book by status</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {policies.length} policies in force as at the valuation date.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
          {STATUS_ORDER.map((status) => (
            <Stack key={status} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <StatusChip status={status} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {STATUS_COUNTS[status]}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        KPI cards and the renewal pipeline arrive with the rest of Week 4.
      </Typography>
    </Box>
  );
}

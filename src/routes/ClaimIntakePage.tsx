/**
 * WHY THIS EXISTS:
 *   The `/claims/new` route. Its own content is deliberately light — a short
 *   explanation, one button, and the list of what this session has already
 *   filed — because the heavy part, `ClaimIntakeWizard`, is a separate chunk
 *   that is not fetched until the agent opens the dialog. This file is the
 *   call site that proves component-level splitting works: the chunk log stays
 *   silent while the page renders and prints exactly once, on the first click
 *   of "Start a claim".
 *
 *   It is a MUI surface, and it became one in the same pass that rebuilt the
 *   wizard. `CLAUDE.md`'s Week 4 boundary table names `ClaimIntakeWizard` as a
 *   MUI surface and does not list `/claims/new` on either side of the line —
 *   but the same document forbids putting MUI components inside a CSS Modules
 *   surface, and a MUI dialog body cannot be hosted by a hand-rolled
 *   `createPortal` modal without doing exactly that. The container follows the
 *   thing it contains. `/policies`, `/policies/:id` and `/quote` are untouched
 *   and stay the control group.
 *
 * CONCEPTS: W3-D3-02, W3-D3-03, W4-D1-02, W4-D4-01
 *
 * WITHOUT THIS:
 *   The sidebar's "New claim" link would 404 into the catch-all route, making
 *   the nav look broken rather than merely unfinished.
 *
 *   No lazy wizard: everything in `ClaimIntakeWizard` — the step machine, the
 *   Zod schema, the resolver, `react-hook-form` itself, the searchable index
 *   over all 140 policies — ships inside this route's chunk and is parsed by
 *   every visitor, including the ones who open the page to read it and
 *   navigate away.
 *
 *   No `<Suspense>` inside the dialog: the wizard suspends on its first
 *   render, which is the render triggered by opening it. With no boundary
 *   between it and the route, React falls back to the route-level boundary in
 *   `App.tsx` — which replaces this page, including the `<Dialog>` element
 *   itself. The dialog that is waiting for the chunk gets unmounted by the act
 *   of waiting for it, and once the chunk lands there is nothing left holding
 *   the `open` state that asked for it. The boundary has to be inside the part
 *   that survives.
 *
 *   No `<ErrorBoundary>` around it: `React.lazy` throws its import rejection
 *   during render and Suspense does not catch rejections. A dropped connection
 *   mid-download would take the whole route down instead of leaving a Retry
 *   inside a dialog the user can also just close. And no `onRetry` on that
 *   boundary means the Retry cannot recover — a failed chunk's rejection is
 *   remembered on the lazy component at module scope, which no remount can
 *   reach. `splitChunk().reset()` owns that; see `lazyRoutes.tsx`'s header.
 *
 *   WHY `<Dialog>` AND NOT THE APP'S OWN `<Modal>`: `Modal` is still the right
 *   component and is still in the app — `PolicyClaimsTab` uses it, and it is
 *   what carries `forwardRef` (W3-D4-05), `useImperativeHandle` (W3-D4-06) and
 *   `createPortal` (C-09). What it is not is a MUI component, and this dialog
 *   now contains `DialogTitle`, `DialogContent` and `DialogActions`, which are
 *   built to be MUI `Dialog`'s children and lose their dividers, padding and
 *   scroll behaviour outside it. Both are kept, one consumer each, which is
 *   the same arrangement `StatusChip` and `PolicyRow.module.css` are in.
 *
 *   The one property that had to survive the swap is the one the code-split
 *   depends on: MUI's `Dialog` renders nothing at all while `open` is false,
 *   exactly as `Modal` returned `null`. Passing `keepMounted` would render the
 *   lazy child immediately and download the wizard chunk on page load — the
 *   dialog would look identical and the split would be gone. `src/App.test.tsx`
 *   asserts the closed case, which is what would catch it.
 *
 *   No list of what was filed: the wizard closes on success and the snackbar
 *   dismisses a few seconds later, so an agent who filed three claims has
 *   nothing on screen saying so. The list reads `state.claims.submitted`
 *   rather than a local `useState` because a page-level state is discarded by
 *   the route change to the policy they just filed against — see
 *   `claimsSlice.ts`.
 */

import { Suspense, useState, type ReactElement } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { formatCurrency } from '../shared/format';
import { splitChunk } from '../shared/routes/lazyRoutes';
import { useAppSelector } from '../shared/store';
import type { Claim } from '../shared/types';
import type { ClaimIntakeWizardProps } from './claimIntake/ClaimIntakeWizard';

/*
 * Declared at module scope, not inside the component. A `lazy()` call in the
 * render body produces a brand-new lazy component on every render, so React
 * sees a different element type each time, unmounts the previous one and
 * re-suspends — the wizard would remount and lose every field the agent had
 * filled in, on every keystroke that re-rendered this page.
 *
 * The `import()` stays here rather than moving into `lazyRoutes.tsx`: the
 * dynamic import is what draws the chunk boundary, and it belongs in the file
 * that owns the split. Only the mechanism around it — memoise, log, reset — is
 * shared.
 */
const ClaimIntakeWizardChunk = splitChunk<ClaimIntakeWizardProps>(
  'ClaimIntakeWizard',
  () => import('./claimIntake/ClaimIntakeWizard'),
);

export default function ClaimIntakePage(): ReactElement {
  const [open, setOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const submitted = useAppSelector((state) => state.claims.submitted);

  /*
   * The write itself is the wizard's — it dispatches `submitClaimThunk`, which
   * POSTs through the axios client and puts the result in the store. By the
   * time this runs the claim is already recorded, so all this owes the user is
   * to get the dialog out of the way and say what happened.
   */
  function handleSubmitted(claim: Claim): void {
    setOpen(false);
    setToastMessage(`Claim ${claim.id} logged against ${claim.policyId}.`);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h1">New claim</Typography>

      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
          <Typography variant="h2" component="h2">
            First notice of loss
          </Typography>
          <Typography variant="body2">
            Record a new claim against any policy in the book. The intake wizard walks through
            policy selection, incident detail and a review step before anything is submitted.
          </Typography>
          <Button variant="contained" onClick={() => setOpen(true)}>
            Start a claim
          </Button>
        </CardContent>
      </Card>

      {submitted.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h2" component="h2">
              Filed this session
            </Typography>
            <List dense>
              {submitted.map((claim) => (
                <ListItem key={claim.id} disableGutters>
                  <ListItemText
                    primary={
                      <>
                        {claim.id} · {formatCurrency(claim.amount)} ·{' '}
                        <Link component={RouterLink} to={`/policies/${claim.policyId}/claims`}>
                          {claim.policyId}
                        </Link>
                      </>
                    }
                    secondary={claim.description}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="claim-intake-title"
        fullWidth
        maxWidth="md"
      >
        <ErrorBoundary label="Claim intake wizard" onRetry={ClaimIntakeWizardChunk.reset}>
          <Suspense
            fallback={
              <Box sx={{ p: 4 }} aria-label="Loading claim wizard">
                <LinearProgress />
              </Box>
            }
          >
            <ClaimIntakeWizardChunk.Component
              onSubmitted={handleSubmitted}
              onCancel={() => setOpen(false)}
            />
          </Suspense>
        </ErrorBoundary>
      </Dialog>

      <Snackbar
        open={toastMessage !== null}
        autoHideDuration={6000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

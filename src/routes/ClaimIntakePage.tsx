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

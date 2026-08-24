/**
 * WHY THIS EXISTS:
 *   The `/claims/new` route. Its own content is deliberately light — a short
 *   explanation and one button — because the heavy part, `ClaimIntakeWizard`,
 *   is a separate chunk that is not fetched until the agent opens the modal.
 *   This file is the call site that proves component-level splitting works:
 *   the chunk log stays silent while the page renders and prints exactly once,
 *   on the first click of "Start a claim".
 *
 * CONCEPTS: W3-D3-02, W3-D3-03
 *
 * WITHOUT THIS:
 *   The sidebar's "New claim" link would 404 into the catch-all route, making
 *   the nav look broken rather than merely unfinished.
 *
 *   No lazy wizard: everything in `ClaimIntakeWizard` — three steps of form
 *   state, the validation rules, the searchable index over all 140 policies —
 *   ships inside this route's chunk and is parsed by every visitor, including
 *   the ones who open the page to read it and navigate away. See that file's
 *   header for why the modal's unmount-when-closed behaviour is what makes the
 *   deferral real rather than nominal.
 *
 *   No `<Suspense>` inside `<Modal>`: the wizard suspends on its first render,
 *   which is the render triggered by `open()`. With no boundary between it and
 *   the route, React falls back to the route-level boundary in `App.tsx` —
 *   which replaces this page, including the `<Modal>` element itself. The
 *   modal that is waiting for the chunk gets unmounted by the act of waiting
 *   for it, and once the chunk lands there is nothing left holding the
 *   `isOpen` state that asked for it. The dialog would flash and vanish. The
 *   boundary has to be inside the part that survives.
 *
 *   No `<ErrorBoundary>` around it: `React.lazy` throws its import rejection
 *   during render and Suspense does not catch rejections. A dropped connection
 *   mid-download would take the whole route down instead of leaving a Retry
 *   inside a dialog the user can also just close.
 *
 *   No `onRetry` on that boundary — which is what shipped, alongside the same
 *   omission in `App.tsx`. The Retry inside the dialog could not recover,
 *   because `React.lazy` remembers a rejected import on a module-scoped payload
 *   that no remount can reach. This file used a bare `lazy()` and so had no way
 *   to discard it; `splitChunk` exists to own exactly that, and using it here
 *   rather than re-deriving a local `reset()` is the point of having one
 *   implementation. See `lazyRoutes.tsx`'s header for the measurement.
 */

import { Suspense, useRef, useState, type ReactElement } from 'react';
import { submitClaim } from '../shared/api';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { Modal, type ModalHandle } from '../shared/components/Modal';
import { Panel } from '../shared/components/Panel';
import { Skeleton } from '../shared/components/Skeleton';
import { Toast } from '../shared/components/Toast';
import { splitChunk } from '../shared/routes/lazyRoutes';
import type {
  ClaimIntakeDraft,
  ClaimIntakeWizardProps,
} from './claimIntake/ClaimIntakeWizard';

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
  const modalRef = useRef<ModalHandle>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  async function handleSubmit(draft: ClaimIntakeDraft): Promise<void> {
    const claim = await submitClaim({
      policyId: draft.policyId,
      type: draft.type,
      amount: draft.amount,
      description: draft.description,
    });
    modalRef.current?.close();
    setToastMessage(`Claim ${claim.id} logged against ${draft.policyId}.`);
  }

  return (
    <div>
      <h1>New claim</h1>

      <Panel title="First notice of loss">
        <p>
          Record a new claim against any policy in the book. The intake wizard walks through policy
          selection, incident detail and a review step before anything is submitted.
        </p>
        <p>
          <button type="button" onClick={() => modalRef.current?.open()}>
            Start a claim
          </button>
        </p>
      </Panel>

      <Modal ref={modalRef} labelledBy="claim-intake-title">
        <ErrorBoundary label="Claim intake wizard" onRetry={ClaimIntakeWizardChunk.reset}>
          <Suspense fallback={<Skeleton variant="panel" rows={5} label="Loading claim wizard" />}>
            <ClaimIntakeWizardChunk.Component
              onSubmit={handleSubmit}
              onCancel={() => modalRef.current?.close()}
            />
          </Suspense>
        </ErrorBoundary>
      </Modal>

      {toastMessage ? (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      ) : null}
    </div>
  );
}

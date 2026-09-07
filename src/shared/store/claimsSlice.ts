/**
 * WHY THIS EXISTS:
 *   The write side of claim intake, as a Redux Toolkit slice. `ClaimIntakeWizard`
 *   does not call the transport itself — it dispatches `submitClaimThunk`, which
 *   POSTs through the axios client and records what came back, so the claims an
 *   agent filed in this session survive the modal closing and are readable from
 *   anywhere in the tree.
 *
 * CONCEPTS: W4-D4-01, W4-D4-02, W4-D4-03, W4-D5-01
 *
 * WITHOUT THIS:
 *   The wizard `await`s `submitClaim(...)` directly and hands the result to a
 *   callback prop, which is what shipped before this pass. Three things follow.
 *
 *   1. THE RESULT DIES WITH THE MODAL. `ClaimIntakePage` held the last claim id
 *   in a `useState` for the toast and nothing else; the modal unmounts on
 *   success, the toast dismisses after a few seconds, and an agent who filed
 *   three claims has no record on screen that any of them happened. "Did that
 *   go through?" is then answered by opening the policy detail route and
 *   looking. The list below is that record, and it is in the store rather than
 *   in the page because a page-level `useState` is discarded by the route
 *   change to the policy the agent just filed against.
 *
 *   2. THE IN-FLIGHT STATE IS DUPLICATED. `react-hook-form`'s `isSubmitting`
 *   already covers the button, but it is scoped to the form instance and dies
 *   with it. `status` here is what any *other* surface would read, and it is
 *   what the thunk's own `pending`/`fulfilled`/`rejected` actions write —
 *   the same three-state lifecycle `authSlice` documents, on a second slice, so
 *   the pattern is visibly a pattern rather than one file's habit.
 *
 *   3. THE ERROR IS ONLY EVER A LOCAL. `rejectWithValue` puts the backend's own
 *   sentence — already normalised into an `ApiError` by interceptor (c) — into
 *   the store, where the wizard reads it back through `.unwrap()` and renders it
 *   as a root-level form error. Without the slice each call site invents its own
 *   `catch` and its own message, and the `claim-submit-failure` lab toggle's
 *   "Claim intake rejected by the underwriting gateway" is replaced by whichever
 *   string that call site happened to write.
 *
 *   WHY THIS THUNK TAKES `endpoints.submitClaim` RATHER THAN `extra.http`:
 *   `authSlice`'s thunks take their axios instance as the middleware's
 *   `extraArgument` for one specific reason — the interceptors dispatch those
 *   thunks, so importing the client there would close an import cycle (see
 *   `store/index.ts`). Nothing dispatches this one from inside the transport, so
 *   there is no cycle to break, and the typed wrapper in
 *   `src/shared/http/endpoints.ts` is the thing that should be reused: it owns
 *   the URL construction and the `Claim` response type. Injecting the raw
 *   instance here would mean re-deriving both at this call site.
 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { submitClaim } from '../http/endpoints';
import { isLabEnabled } from '../labs/registry';
import type { Claim, ClaimType } from '../types';

export interface SubmitClaimArgs {
  policyId: string;
  type: ClaimType;
  amount: number;
  description: string;
}

export type ClaimsStatus = 'idle' | 'submitting' | 'succeeded' | 'failed';

export interface ClaimsState {
  /** Newest first — see `submitClaimThunk.fulfilled` for why `unshift`. */
  submitted: Claim[];
  status: ClaimsStatus;
  error: string | null;
}

const initialState: ClaimsState = {
  submitted: [],
  status: 'idle',
  error: null,
};

/**
 * `POST /policies/:id/claims` through the axios stack.
 *
 * The `claim-submit-failure` lab toggle is read *here* rather than in the
 * wizard, because it belongs to the write and not to the form: the same
 * registered defect (C-05) also drives `PolicyClaimsTab`'s optimistic
 * rollback, and both paths must see the same flag or the toggle means two
 * different things depending on which surface fired the request.
 */
export const submitClaimThunk = createAsyncThunk<
  Claim,
  SubmitClaimArgs,
  { rejectValue: string }
>('claims/submit', async (draft, { rejectWithValue }) => {
  try {
    return await submitClaim(draft, { forceFailure: isLabEnabled('claim-submit-failure') });
  } catch (error) {
    return rejectWithValue(
      error instanceof Error && error.message ? error.message : 'Could not submit the claim.',
    );
  }
});

const claimsSlice = createSlice({
  name: 'claims',
  initialState,
  reducers: {
    /**
     * Clears the session list. Written as mutation, like `authSlice`'s
     * `logout` and unlike `quoteReducer` one folder away — Immer's draft turns
     * the assignment into a new `claims` object, which is what react-redux's
     * `Object.is` check needs in order to notice anything happened.
     */
    clearSubmitted(state) {
      state.submitted = [];
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitClaimThunk.pending, (state) => {
        state.status = 'submitting';
        state.error = null;
      })
      .addCase(submitClaimThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.error = null;
        // `unshift`, not `push`: the list is rendered top-down and the thing
        // an agent wants to see after submitting is the claim they just
        // submitted. Safe to mutate for the same Immer reason as above.
        state.submitted.unshift(action.payload);
        console.log(`[claims] filed ${action.payload.id} against ${action.payload.policyId}`);
      })
      .addCase(submitClaimThunk.rejected, (state, action) => {
        state.status = 'failed';
        // `payload` is the backend's own sentence via `rejectWithValue`;
        // `error.message` is what an unexpected throw left behind.
        state.error = action.payload ?? action.error.message ?? 'Could not submit the claim.';
      });
  },
});

export const { clearSubmitted } = claimsSlice.actions;
export const claimsReducer = claimsSlice.reducer;

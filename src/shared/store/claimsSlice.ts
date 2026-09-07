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

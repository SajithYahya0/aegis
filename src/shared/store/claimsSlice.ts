import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { submitClaim, type ClaimDraft } from '../http/client';
import type { Claim } from '../domain';

export interface ClaimsState {
  submitted: Claim[];
  status: 'idle' | 'submitting' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ClaimsState = { submitted: [], status: 'idle', error: null };

export const submitClaimThunk = createAsyncThunk<Claim, ClaimDraft>('claims/submit', (draft) =>
  submitClaim(draft),
);

const claimsSlice = createSlice({
  name: 'claims',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(submitClaimThunk.pending, (state) => {
        state.status = 'submitting';
        state.error = null;
      })
      .addCase(submitClaimThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.submitted.unshift(action.payload);
      })
      .addCase(submitClaimThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Could not submit the claim.';
      });
  },
});

export const claimsReducer = claimsSlice.reducer;

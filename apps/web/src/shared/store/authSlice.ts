import { createAsyncThunk, createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import { http } from '../http/client';
import type { Role, User } from '../domain';

export const SESSION_ENDED = 'Your session has ended. Sign in again.';

export const DEMO_USERS: Record<Role, User> = {
  agent: { id: 'usr-agent-01', name: 'Priya Nair', role: 'agent', branch: 'Chennai' },
  underwriter: { id: 'usr-uw-01', name: 'Arvind Rao', role: 'underwriter', branch: 'Mumbai' },
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User;
  role: Role;
  token: string | null;
  refreshToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
}

const initialState: AuthState = {
  user: DEMO_USERS.agent,
  role: 'agent',
  token: null,
  refreshToken: null,
  status: 'idle',
  error: null,
};

export const loginThunk = createAsyncThunk<TokenPair, void, { state: { auth: AuthState } }>(
  'auth/login',
  async (_arg, { getState }) => {
    const response = await http.post<TokenPair>('/auth/login', { role: getState().auth.role });
    return response.data;
  },
);

export const refreshThunk = createAsyncThunk<TokenPair, void, { state: { auth: AuthState } }>(
  'auth/refresh',
  async (_arg, { getState }) => {
    const refreshToken = getState().auth.refreshToken;
    if (!refreshToken) throw new Error(SESSION_ENDED);
    const response = await http.post<TokenPair>('/auth/refresh', { refreshToken });
    return response.data;
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    switchRole(state, action: PayloadAction<Role>) {
      state.role = action.payload;
      state.user = DEMO_USERS[action.payload];
      state.token = null;
      state.refreshToken = null;
      state.status = 'idle';
    },
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(isAnyOf(loginThunk.pending, refreshThunk.pending), (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addMatcher(isAnyOf(loginThunk.fulfilled, refreshThunk.fulfilled), (state, action) => {
        state.status = 'authenticated';
        state.token = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.error = null;
      })
      .addMatcher(isAnyOf(loginThunk.rejected, refreshThunk.rejected), (state, action) => {
        state.status = 'error';
        state.error = action.error.message ?? 'Sign-in failed.';
      });
  },
});

export const { switchRole, logout } = authSlice.actions;
export const authReducer = authSlice.reducer;

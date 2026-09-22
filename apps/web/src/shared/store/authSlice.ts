import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit';
import { http } from '../http/client';
import type { User } from '../domain';

export const SESSION_ENDED = 'Your session has ended. Sign in again.';

export interface Credentials {
  username: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface LoginResponse extends TokenPair {
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  status: 'idle',
  error: null,
};

export const loginThunk = createAsyncThunk<LoginResponse, Credentials>(
  'auth/login',
  async (credentials) => {
    const response = await http.post<LoginResponse>('/auth/login', credentials);
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
    logout(state) {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.user = action.payload.user;
      })
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

export const { logout } = authSlice.actions;
export const authReducer = authSlice.reducer;

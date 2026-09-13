import axios, { isAxiosError, type AxiosError } from 'axios';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ApiError, http } from './client';
import { SESSION_ENDED, loginThunk, logout, refreshThunk } from '../store/authSlice';
import type { AppStore } from '../store';

declare module 'axios' {
  interface AxiosRequestConfig {
    correlationId?: string;
    retried?: boolean;
  }
}

export interface HttpErrorState {
  message: string | null;
  correlationId: string | null;
}

const initialState: HttpErrorState = { message: null, correlationId: null };

const httpErrorSlice = createSlice({
  name: 'httpError',
  initialState,
  reducers: {
    requestFailed(state, action: PayloadAction<{ message: string; correlationId: string }>) {
      state.message = action.payload.message;
      state.correlationId = action.payload.correlationId;
    },
    dismissHttpError(state) {
      state.message = null;
      state.correlationId = null;
    },
  },
});

export const { requestFailed, dismissHttpError } = httpErrorSlice.actions;
export const httpErrorReducer = httpErrorSlice.reducer;

let sequence = 0;

function nextCorrelationId(): string {
  sequence += 1;
  return `req-${String(sequence).padStart(4, '0')}`;
}

function isAuthEndpoint(url: string | undefined): boolean {
  return (url ?? '').startsWith('/auth/');
}

function messageFor(error: AxiosError): string {
  const body = error.response?.data;
  const hasMessage =
    body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string';
  if (hasMessage) return (body as { message: string }).message;
  if (!error.response) return 'The server could not be reached.';
  return error.message;
}

export function installInterceptors(store: AppStore): void {
  let sessionRequest: Promise<string> | null = null;
  let refreshRequest: Promise<string> | null = null;

  function signIn(): Promise<string> {
    sessionRequest ??= store
      .dispatch(loginThunk())
      .unwrap()
      .then((pair) => pair.accessToken)
      .finally(() => {
        sessionRequest = null;
      });
    return sessionRequest;
  }

  function refreshSession(): Promise<string> {
    refreshRequest ??= store
      .dispatch(refreshThunk())
      .unwrap()
      .then((pair) => pair.accessToken)
      .catch((reason: unknown) => {
        store.dispatch(logout());
        throw reason;
      })
      .finally(() => {
        refreshRequest = null;
      });
    return refreshRequest;
  }

  async function bearerToken(): Promise<string> {
    return store.getState().auth.token ?? (await signIn());
  }

  http.interceptors.request.use(async (config) => {
    config.correlationId ??= nextCorrelationId();
    config.headers.set('x-correlation-id', config.correlationId);
    if (!isAuthEndpoint(config.url)) {
      config.headers.set('Authorization', `Bearer ${await bearerToken()}`);
    }
    return config;
  });

  http.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isAxiosError(error)) throw error;

    const config = error.config;
    const correlationId = config?.correlationId ?? 'req-0000';
    const status = error.response?.status ?? 0;

    if (status === 401 && config && !config.retried && !isAuthEndpoint(config.url)) {
      config.retried = true;
      try {
        await refreshSession();
      } catch {
        throw new ApiError(SESSION_ENDED);
      }
      return http.request(config);
    }

    const apiError = new ApiError(messageFor(error));
    if (!axios.isCancel(error)) {
      store.dispatch(requestFailed({ message: apiError.message, correlationId }));
    }
    throw apiError;
  });
}

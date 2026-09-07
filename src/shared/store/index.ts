import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { http, installInterceptors } from '../http';
import { authReducer, type ThunkExtra } from './authSlice';
import { claimsReducer } from './claimsSlice';

/**
 * One store, wired to one axios instance. Exported for the tests; the app uses
 * the `store` singleton below.
 */
export function makeStore(extra: ThunkExtra) {
  return configureStore({
    // Two slices, one store. `claims` is not folded into `auth` even though
    // both are session-scoped, and the reason is `logout`: it writes every
    // field of `AuthState` out by hand precisely so nothing is left behind
    // (see `authSlice.ts`). A combined slice would put the filed-claims list
    // inside that blast radius, so switching role — which re-authenticates —
    // would be one edit away from silently discarding the agent's own record
    // of what they filed.
    reducer: { auth: authReducer, claims: claimsReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // Every thunk in this app needs a client; handing it over here is what
        // lets `authSlice.ts` avoid importing one. See its header.
        thunk: { extraArgument: extra },
      }),
  });
}

export const store = makeStore({ http });

/*
 * The transport is bound to the session HERE, and this line is the reason this
 * module is the app's composition root rather than `src/shared/http/index.ts`.
 * The interceptors dispatch this store's thunks and read its token; the store
 * needs `http` to build its thunks. One of the two has to be created first,
 * and it is the store — so the wiring happens on this side of the dependency,
 * once, at module load. `main.tsx` imports this module, so it has run before
 * React mounts and before any component can fire a request.
 */
installInterceptors(http, store);

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

/**
 * `useSelector` and `useDispatch`, pre-bound to this store's types.
 *
 * `withTypes` rather than the older `useDispatch as () => AppDispatch` cast:
 * the cast form is a cast, so a store whose middleware changed would keep
 * type-checking against the old dispatch signature. This form is derived.
 */
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

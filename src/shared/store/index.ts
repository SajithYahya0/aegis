/**
 * WHY THIS EXISTS:
 *   The store, and the two hooks every component uses to reach it. Both hooks
 *   are the *typed* versions — `useAppSelector` knows the shape of the state
 *   it is given, `useAppDispatch` knows this store's thunk middleware exists —
 *   and they are declared once here so no call site ever writes the generic
 *   parameters by hand.
 *
 * CONCEPTS: W4-D4-01
 *
 * WITHOUT THIS:
 *   Two failures, and the second one is the expensive one.
 *
 *   1. UNTYPED `useSelector`. Its state parameter is `unknown` unless it is
 *   told otherwise, so every call site either annotates it —
 *   `useSelector((s: RootState) => s.auth.role)`, repeated at every read, each
 *   an opportunity to annotate it wrong — or leaves it and gets no checking at
 *   all. `state.auth.roll` then compiles, returns `undefined`, and
 *   `RequireRole` compares `undefined === 'underwriter'` and locks every user
 *   out of /underwriting with nothing in the console.
 *
 *   2. UNTYPED `useDispatch`. The plain `Dispatch` type accepts actions only,
 *   so `dispatch(loginThunk('agent'))` is a type error — the thunk is a
 *   function, not an action. The usual "fix" is to cast, and the cast also
 *   erases the return type, so `.unwrap()` — which is how the interceptor
 *   learns whether the login it awaited actually succeeded — stops being
 *   reachable. `AppDispatch` is that middleware-aware type, inferred from the
 *   store rather than declared, so it cannot drift from the middleware the
 *   store is actually configured with.
 *
 *   WHY `makeStore` IS A FACTORY AND NOT JUST A SINGLETON: the thunks need an
 *   axios instance, and `interceptors.test.ts` builds a throwaway one per test
 *   so that one test's session cannot satisfy the next test's "did it log in?"
 *   assertion. With a hard-wired singleton those tests would have to talk to
 *   the app's instance and its shared mock backend, and the burst-of-401s test
 *   — the one that actually pins the single-flight refresh — would be racing
 *   whatever else had touched that backend first.
 *
 *   WHY THE SLICE'S AXIOS INSTANCE ARRIVES AS `extraArgument`, AND WHY THE
 *   INTERCEPTORS ARE INSTALLED FROM HERE: the interceptors dispatch this
 *   store's thunks, and the thunks need an axios instance, so whichever of the
 *   two imports the other has a cycle. Resolving it one level up — the slice
 *   takes its client as an argument, and this module hands the store to
 *   `installInterceptors` after building it — leaves the graph acyclic and
 *   both halves testable.
 *
 *   That is not a stylistic preference. The first attempt did put the install
 *   in `src/shared/http/index.ts`, and it type-checked, built, and failed at
 *   run time with `installInterceptors is not a function` — a cycle entered
 *   from the other side hands you a module whose exports have not been
 *   assigned yet. Under Vite's transform there is no function-declaration
 *   hoisting across that edge to save it.
 */

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { http, installInterceptors } from '../http';
import { authReducer, type ThunkExtra } from './authSlice';

/**
 * One store, wired to one axios instance. Exported for the tests; the app uses
 * the `store` singleton below.
 */
export function makeStore(extra: ThunkExtra) {
  return configureStore({
    reducer: { auth: authReducer },
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

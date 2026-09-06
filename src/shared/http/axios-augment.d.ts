/**
 * WHY THIS EXISTS:
 *   Re-opens axios's request config so the two fields the interceptors add to
 *   it — `meta` (correlation id + start time) and `_retry` (the refresh loop
 *   guard) — are declared members of the type rather than smuggled through a
 *   cast.
 *
 * CONCEPTS: W4-D3-02, W4-D3-03, W4-D3-04
 *
 * WITHOUT THIS:
 *   `config.meta = { … }` in the request interceptor does not compile:
 *   `InternalAxiosRequestConfig` has no such member, so the only way to write
 *   it is `(config as any).meta`. That cast is what the response interceptor
 *   then has to repeat to *read* it back, and at that point nothing checks
 *   that the two agree — the reader could ask for `config.meta.startTime`
 *   while the writer wrote `startedAt`, and the elapsed-ms figure in every
 *   log line silently becomes `NaN`.
 *
 *   `_retry` is worse if it goes untyped, because it is a safety mechanism:
 *   the 401 handler refuses to refresh a second time for a request that is
 *   already a replay. A typo'd `config._retried` reads back as `undefined`,
 *   the guard never fires, and a token the backend will not accept sends the
 *   error interceptor into an unbounded refresh/replay loop against the
 *   server.
 *
 *   The file is named `axios-augment.d.ts`, not `client.d.ts`, for the reason
 *   `src/shared/theme/mui-augment.d.ts` records at length: a `.d.ts` beside a
 *   `.ts` of the same basename is dropped by TypeScript's wildcard matcher,
 *   which assumes it is that file's emitted output. The `export` below is
 *   load-bearing for the same reason it is there — without a top-level
 *   import or export this file is a script, and `declare module 'axios'` in a
 *   script *replaces* axios's types instead of merging with them.
 */

export interface RequestMeta {
  /** Stamped once per logical request and preserved across a 401 replay. */
  correlationId: string;
  /** `performance.now()` at the moment the request interceptor ran. */
  startedAt: number;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    meta?: RequestMeta;
    /**
     * Set by the 401 handler before it replays a request. Its presence is the
     * whole loop guard: a replay that 401s again is not refreshed a second
     * time, it is normalised and thrown.
     */
    _retry?: boolean;
  }
}

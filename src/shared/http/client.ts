/**
 * WHY THIS EXISTS:
 *   The one configured axios instance every Week 4 request goes through.
 *   `baseURL` and `timeout` are declared here, once, so no call site ever
 *   writes a URL prefix or a per-request timeout of its own.
 *
 * CONCEPTS: W4-D3-01
 *
 * WITHOUT THIS:
 *   Every call site calls `axios.get('/api/policies/…')` on the *global*
 *   instance. Three things follow, all of them bad and none of them loud.
 *   (1) The prefix is copy-pasted, so the day `/api` becomes `/api/v2` the
 *   compiler has nothing to say and the misses are found one 404 at a time.
 *   (2) There is no timeout, so a request the mock backend never settles
 *   hangs the Claims tab's spinner forever rather than failing at 8s with an
 *   error the UI can render. (3) Interceptors registered on the global
 *   `axios` object are global to the process — they would also wrap requests
 *   made by any library that imports axios, attaching this app's bearer token
 *   to third-party hosts.
 *
 *   NOTE ON IMPORT ORDER: this module deliberately does nothing but create the
 *   instance. The mock backend and the interceptors are attached in
 *   `src/shared/http/index.ts`, which is the only module the rest of the app
 *   is meant to import from. Importing `http` straight from here gets an
 *   instance with no adapter and no interceptors, which in a browser means a
 *   real network request to `/api` and a 404 from the dev server.
 */

import axios, { type AxiosInstance } from 'axios';

/** How long a request may run before axios aborts it with `ECONNABORTED`. */
export const REQUEST_TIMEOUT_MS = 8000;

export const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

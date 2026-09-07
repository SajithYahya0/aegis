import axios, { type AxiosInstance } from 'axios';

/** How long a request may run before axios aborts it with `ECONNABORTED`. */
export const REQUEST_TIMEOUT_MS = 8000;

export const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

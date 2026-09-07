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

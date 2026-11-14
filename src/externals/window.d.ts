interface ServerState {
  photo?: {
    data?: [number, number, string][]
    menu?:
      | Record<string, unknown>
      | Array<{ name: string; cover?: string; count?: number }>
  }
  query?: Record<string, unknown>
}

declare interface Window {
  // Injected by the node SSR backend (window.context = { state }) so the
  // client seeds its Redux store identically to the server render.
  context: { state: ServerState };
  // Optional SSR marker (server render metadata), when present.
  __NSBP_SSR__?: unknown;
}

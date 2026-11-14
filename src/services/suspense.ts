// Suspense data boundaries for the photo sections (React 19 `use`).
//
// The point of these hooks is to give `renderToPipeableStream` a *genuine*
// streaming boundary:
//
//   SERVER  -> the hook suspends (returns a promise). `renderToPipeableStream`
//              flushes the page shell (header/nav + section frames) first,
//              then streams the photo content once the promise settles. The
//              promise resolves IN-PROCESS via the registry main.tsx installs
//              (setServerResolvers), so no self-HTTP is involved.
//
//   CLIENT  -> the store was preloaded from window.context (buildStore
//              preseed), so the hook returns the value synchronously: no
//              re-suspend, no flash, and the markup matches the server's
//              resolved content exactly (clean hydration).
//
//   COLD CLIENT (opened with no SSR backend / no preload) -> the hook fetches
//              the data endpoints and suspends until the value arrives.

import { use, useRef } from "react";
import { useStore } from "react-redux";
import type { Store } from "redux";

export type PhotoMenu = Array<{ name: string; cover?: string; count?: number }>;
export type PhotoWH = [number, number, string][];

export interface NSBPResolvers {
  photoMenu?: () => Promise<PhotoMenu>;
  photoWH?: (dic: string) => Promise<PhotoWH>;
}

// Module-level registry. The SSR backend bundle (main.tsx) installs it at
// startup so the server's `use()` promises resolve in-process. The client
// bundle never sets it (main.tsx is not part of it), so the client path reads
// the preloaded store / fetches instead.
let serverResolvers: NSBPResolvers | undefined;
export function setServerResolvers(r: NSBPResolvers): void {
  serverResolvers = r;
}

const menuOf = (state: { photo?: { menu?: unknown } }): PhotoMenu | null =>
  Array.isArray(state?.photo?.menu)
    ? (state.photo!.menu as PhotoMenu)
    : null;
const whOf = (state: { photo?: { data?: unknown } }): PhotoWH | null =>
  Array.isArray(state?.photo?.data) ? (state.photo!.data as PhotoWH) : null;

// Optional artificial settle delay so the shell visibly flushes before the
// content (demonstrates the streaming). 0 by default = correct, no fake
// latency; set NSBP_SUSPENSE_DELAY_MS in tests to observe the two-phase stream.
// Browser-safe read: "process" only exists in the SSR (node/CJS) bundle. On
// the browser ESM bundle it is undefined, so default the delay to 0 there
// (real streaming is driven by the Suspense boundary, not a fake sleep). Only
// the server can set NSBP_SUSPENSE_DELAY_MS to observe the two-phase stream.
const SUSPENSE_DELAY_MS =
  typeof process !== "undefined" && process.env
    ? Number(process.env.NSBP_SUSPENSE_DELAY_MS || 0)
    : 0;

function resolveMenu(): Promise<PhotoMenu> {
  return new Promise((resolve) => {
    const settle = () => {
      if (serverResolvers?.photoMenu) {
        serverResolvers
          .photoMenu()
          .then((v) => resolve(v))
          .catch(() => resolve([]));
      } else if (typeof window !== "undefined") {
        // cold client: fetch the data endpoint (relayed by Lume to node).
        fetch("/getPhotoMenu")
          .then((res) => (res.ok ? res.json() : null))
          .then((j) => resolve(((j?.data as PhotoMenu) || [])))
          .catch(() => resolve([]));
      } else {
        resolve([]);
      }
    };
    SUSPENSE_DELAY_MS > 0 ? setTimeout(settle, SUSPENSE_DELAY_MS) : settle();
  });
}

function resolveWH(dic: string): Promise<PhotoWH> {
  return new Promise((resolve) => {
    const settle = () => {
      if (serverResolvers?.photoWH) {
        serverResolvers
          .photoWH(dic)
          .then((v) => resolve(v))
          .catch(() => resolve([]));
      } else if (typeof window !== "undefined") {
        fetch("/getPhotoWH?dic=" + encodeURIComponent(dic))
          .then((res) => (res.ok ? res.json() : null))
          .then((j) => resolve(((j?.data as PhotoWH) || [])))
          .catch(() => resolve([]));
      } else {
        resolve([]);
      }
    };
    SUSPENSE_DELAY_MS > 0 ? setTimeout(settle, SUSPENSE_DELAY_MS) : settle();
  });
}

// Photo menu (category list). Client: sync from the preloaded store; server /
// cold: suspend.
export function usePhotoMenu(): PhotoMenu {
  const store = useStore() as Store;
  const pre = menuOf(store.getState());
  if (typeof window !== "undefined" && pre && pre.length > 0) {
    return pre; // hydrate-safe, no suspend
  }
  const ref = useRef<{ p?: Promise<PhotoMenu> }>({});
  if (!ref.current.p) ref.current.p = resolveMenu();
  return use(ref.current.p); // server (window undefined) -> suspends
}

// Photo width/height for a category. Client: sync from the preloaded store;
// server / cold: suspend.
export function usePhotoDimensions(dic: string): PhotoWH {
  const store = useStore() as Store;
  const pre = whOf(store.getState());
  if (typeof window !== "undefined" && pre && pre.length > 0) {
    return pre; // hydrate-safe, no suspend
  }
  const ref = useRef<{ key?: string; p?: Promise<PhotoWH> }>({});
  // key by dic: navigating to another category re-suspends with a fresh
  // promise for that category (server streams it; cold client fetches it).
  if (ref.current.key !== dic) ref.current = { key: dic, p: resolveWH(dic) };
  return use(ref.current.p); // server (window undefined) -> suspends
}

// Photo data hooks — store-first, no Suspense `use()`.
//
// The SSR backend (server-ssr/main.tsx) prefetches each route's data into the
// Redux store (buildStore runs route.loadData → GET_PHOTO_MENU /
// GET_PHOTO_WIDTH_HEIGHT) and injects it as window.context. So:
//
//   SERVER           -> reads the prefetched store: the menu / carousel render
//                       synchronously in the page shell (visible even before
//                       hydration / with JS disabled — no hidden <div hidden>
//                       Suspense templates).
//
//   CLIENT (hydrate) -> window.context seeds the store, so the first client
//                       render matches the SSR markup exactly (no flash).
//
//   CLIENT (navigate)-> React Router swaps the route WITHOUT re-running the
//                       server prefetch, so the store can be empty for the new
//                       route (e.g. home → /photo). The hook subscribes via
//                       useSelector and fetches + dispatches in an effect; the
//                       store update re-renders the carousel once the data
//                       lands. This is the path that used to hang forever:
//                       the old `use()` Suspense boundary never recovered after
//                       a client-side navigation (the "加载图片..." fallback
//                       stayed on screen with 0 images).
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { GET_PHOTO_MENU, GET_PHOTO_WIDTH_HEIGHT } from "@store/constants";

export type PhotoMenu = Array<{ name: string; cover?: string; count?: number }>;
export type PhotoWH = [number, number, string][];

// Kept for the SSR backend (server-ssr/main.tsx), which registers in-process
// resolvers. The hooks no longer `use()` them (the client can't rely on the
// Suspense `use()` recovering after a route transition), but the export
// signature is unchanged so the server bundle still compiles.
export interface NSBPResolvers {
  photoMenu?: () => Promise<PhotoMenu>;
  photoWH?: (dic: string) => Promise<PhotoWH>;
}
let serverResolvers: NSBPResolvers | undefined;
export function setServerResolvers(r: NSBPResolvers): void {
  serverResolvers = r;
}

interface RootState {
  photo?: { data?: unknown; menu?: unknown };
}

const arr = <T,>(v: unknown): T[] | null =>
  Array.isArray(v) ? (v as T[]) : null;

// Category menu. Store-first (prefetched on the server / seeded from
// window.context); on the client an empty menu is fetched and dispatched so
// the subscription re-renders when it lands.
export function usePhotoMenu(): PhotoMenu {
  const menu = useSelector((s: RootState) => s.photo?.menu);
  const dispatch = useDispatch();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = arr<unknown>(menu);
    if (!m || m.length === 0) {
      fetch("/getPhotoMenu")
        .then((res) => (res.ok ? res.json() : null))
        .then((j) => {
          const got = arr<unknown>((j as { data?: unknown } | null)?.data);
          if (got && got.length > 0) {
            dispatch({ type: GET_PHOTO_MENU, menu: got });
          }
        })
        .catch(() => {});
    }
  }, [menu, dispatch]);

  return arr<{ name: string; cover?: string; count?: number }>(menu) || [];
}

// Photo width/height for a category. Same store-first pattern: the SSR backend
// prefetches getPhotoWH(dic) into the store, so the carousel renders in the
// shell; on client-side navigation the store is empty, so we fetch + dispatch
// (useSelector re-renders when the data lands) instead of suspending forever.
export function usePhotoDimensions(dic: string): PhotoWH {
  const data = useSelector((s: RootState) => s.photo?.data);
  const dispatch = useDispatch();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const d = arr<unknown>(data);
    if (!d || d.length === 0) {
      fetch("/getPhotoWH?dic=" + encodeURIComponent(dic))
        .then((res) => (res.ok ? res.json() : null))
        .then((j) => {
          const got = arr<unknown>((j as { data?: unknown } | null)?.data);
          if (got && got.length > 0) {
            dispatch({ type: GET_PHOTO_WIDTH_HEIGHT, data: got });
          }
        })
        .catch(() => {});
    }
  }, [dic, data, dispatch]);

  return arr<[number, number, string]>(data) || [];
}

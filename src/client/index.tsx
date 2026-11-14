// Client hydration entry (bundled to public/js/client.mjs).
//
// Mirrors nsbp's client entry (Theme + Redux Provider + BrowserRouter +
// hydrateRoot) but reads the state the node SSR backend injected as
// window.context. The Lume engine relays page routes to the resident node SSR
// backend, which renders the shared route tree (StaticRouter) and injects
// window.context (+ optional window.__NSBP_SSR__). If #root already has
// markup we hydrate; otherwise we mount fresh (opened without the backend).

import React, { useMemo } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import Theme from "@components/Theme";
// Tailwind pipeline entry: expands to public/js/client.css (postcss +
// tailwindcss + autoprefixer run after esbuild; see scripts/build-ssr.js).
// Carries all the ported visuals that used to be styled-components.
import "../css/tailwind.css";
import getStore from "@store";
import routers from "../Routers";

function App() {
  const store = useMemo(() => {
    // Seed the store from server-prefetched state so the first client render
    // matches the SSR markup exactly (no flicker / refetch on mount).
    if (window.context && window.context.state) {
      return getStore(window.context.state);
    }
    return getStore();
  }, []);

  return (
    <Theme>
      <Provider store={store}>
        <BrowserRouter>
          <Routes>
            {routers.map((router) => (
              <Route
                key={router.key}
                path={router.path}
                element={router.element}
              />
            ))}
          </Routes>
        </BrowserRouter>
      </Provider>
    </Theme>
  );
}

const container = document.getElementById("root");
if (container) {
  const app = <App />;
  if (container.hasChildNodes()) {
    hydrateRoot(container, app);
  } else {
    createRoot(container).render(app);
  }
}

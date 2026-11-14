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

// 访客打点(纯数据上报, 无 UI; 数据由 cicdkit 平台 /api/visits?pin= 抓取展示)。
// 仅浏览器水合后上报: 页面文档始终是 SSR 的, 客户端水合才代表一次真实访问。
// sendBeacon 优先, 页面卸载时也不丢; 失败静默, 绝不影响首屏。
function fireVisitBeacon(): void {
  try {
    let visitor = localStorage.getItem("nsbp_visitor") || "";
    if (!visitor) {
      visitor =
        "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("nsbp_visitor", visitor);
    }
    // 隐私: 只存路径/来源, 绝不带 query —— 分享链接 ?tk= 里的访问令牌或
    // ?pin= 里的统计 PIN 绝不能随打点落盘(服务端 /api/visit 也有一道兜底清洗)。
    let referrer = document.referrer;
    if (referrer) {
      referrer = referrer.split("?")[0].split("#")[0];
    }
    const payload = JSON.stringify({
      path: window.location.pathname,
      referrer,
      ua: navigator.userAgent,
      visitor: visitor || "anon",
      wd: String(
        !!(navigator as unknown as { webdriver?: boolean }).webdriver
      ),
    });
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon("/api/visit", payload)
    ) {
      return;
    }
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never block page load */
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  fireVisitBeacon();
}

import React from "react";
import Home from "@containers/Home";
import Login from "@containers/Login";
import Photo from "@containers/Photo";
import { loadData as homeLoadData } from "@services/home";
import { loadData as photoLoadData } from "@services/photo";

// nsbp-lume keeps the same route tree as nsbp (/, /login, /photo) but without
// @loadable/component: pages import directly. The shared tree is rendered by
// the node SSR backend (StaticRouter + renderToPipeableStream) AND hydrated on
// the client (BrowserRouter), so the markup and state agree. `loadData` lets
// the SSR backend prefetch data into the store before the first render.
export default [
  {
    path: "/",
    element: <Home />,
    loadData: homeLoadData,
    key: "home",
  },
  {
    path: "/login",
    element: <Login />,
    key: "login",
  },
  {
    path: "/photo",
    element: <Photo />,
    loadData: photoLoadData,
    key: "photo",
  },
];

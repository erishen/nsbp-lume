# nsbp-lume

> **English** | [简体中文](README.zh.md)

**React server-side rendering (SSR) + the Lume engine**, following the same
pattern as the sibling project `lume-crm`: the `examples/react-ssr.lume` chain
in `work/lume/lume`.

Two processes, orchestrated by `scripts/start.js`:

1. **Resident Node React SSR backend** (`build/server-ssr.cjs`, listening on a
   UNIX socket `./.data/nsbp-ssr.sock`).
   It uses `react-dom/server`'s `renderToPipeableStream` (streaming) +
   `StaticRouter` + Redux Provider + `react-helmet` to **genuinely render each
   page into complete HTML** (isomorphic with nsbp's server), prefetching photo
   data into the store before rendering and injecting `window.context` /
   `window.query` for hydration. It also serves the photo data endpoints
   `/getPhotoMenu`, `/getPhotoWH`, `/images/...` directly (fs +
   `probe-image-size`, aligned with nsbp's Express handlers).
2. **Lume engine** (`$LUME nsbp.lume`, embeds AgentHTTPD, owns HTTP port
   `10090`), which does three things:
   - `react_socket` + `react_prefix = "/"` relays page routes to the Node
     backend over **FastCGI** (`/`, `/photo?dic=...` all emit SSR HTML,
     matching nsbp's real UI; `/getPhotoMenu`, `/getPhotoWH`, `/images/*` are
     also relayed to the Node backend);
   - serves static assets from `docroot=./public` (`/js/client.mjs` +
     `/js/client.css`, images, favicons); `/js`, `/api`, `/assets` are Lume
     reserved prefixes and are not swallowed by the relay;
   - serves the Lume-native data endpoint `GET /api/health` (Lume DSL route;
     `/api` is a reserved prefix the relay won't take, so it stays with Lume).

> Note: `/login` and `/logout` are hard-coded **reserved paths** in the Lume
> engine's C layer (AgentHTTPD ships a session login gate), so with
> `react_prefix="/"` they are not handled by the React relay but by the engine —
> this is engine behaviour, not configurable at the DSL level. nsbp's login
> page therefore cannot be SSR'd through the relay; the Home/Photo pages are
> fully identical to nsbp.

On the client, the SSR markup is hydrated with `BrowserRouter` + `hydrateRoot`
to take over interactivity.

> Model clarification: Lume is **not** a JS module you can `import` into Node.
> The local `work/lume/lume` is the C engine that compiles to a `lume` binary
> (AgentHTTPD); the `lume-core` tree doesn't even ship an embedded server. So
> "using Lume" means using that binary as the HTTP server + DSL data routing,
> with the React SSR backend relayed through its `react_socket` — not
> `import "lume-core"` inside Node.

## Layout

- `nsbp.lume` — Lume server config: `server{ bind, port, react_socket, react_prefix="/", docroot=public, spa }`
  + `GET /api/health` Lume DSL native route + `run()`.
- `src/server-ssr/main.tsx` — Resident Node SSR backend (FCGI socket server +
  `renderToPipeableStream` two-phase shell-first streaming + `StaticRouter` +
  Provider + Helmet + prefetched store; styles are static: Tailwind emits
  `/js/client.css` at build time, SSR only links it, no runtime style
  collection). The photo area is a **Suspense data boundary** (`use()` hooks in
  `src/services/suspense.ts`): on the server it suspends so the shell reaches
  the browser first and the photo content streams after; on the client the
  prefetched state yields a synchronous value, so hydration doesn't flash.
  Inject `NSBP_SUSPENSE_DELAY_MS` to observe the two phases. Also serves the
  data endpoints `/getPhotoMenu`, `/getPhotoWH`, `/images/...`. **Builds to**
  `build/server-ssr.cjs`.
- `src/server-data/photo.ts` — Photo library data layer (fs +
  `probe-image-size`, ported from nsbp's `src/server/photo.ts`, Express removed).
- `src/client/index.tsx` — Browser hydration entry (Theme + Redux Provider +
  BrowserRouter + `hydrateRoot`, reads `window.context`). **Builds to**
  `public/js/client.mjs` + `client.css`.
- `src/Routers.tsx` + `src/containers/` (Home/Login/Photo) +
  `src/component/` (Header/Layout/Theme) + `src/styled/` (plain component
  factory `stx` + Tailwind class names, visuals in `src/css/tailwind.css`) +
  `src/store`/`src/reducers`/`src/services`/`src/utils` — the real UI ported
  verbatim from nsbp (`@loadable`/axios removed).
- `scripts/` — `clean.js` / `build-ssr.js` (esbuild for backend + client) /
  `check-lume.js` (Lume type check) / `dev.js` / `start.js` (start backend then
  Lume).
- `Makefile` — local `check` / `build` / `run` / `dev` / `clean`, plus
  `docker-build` / `docker-up` / `docker-down`.
- `Dockerfile` + `docker/entrypoint.sh` + `docker/lume-linux-x64-static.tar.gz`
  — multi-stage image: Node builds SSR/client → pulls the static Lume binary →
  runs on alpine + nodejs.
- `docker-compose.yml` — one-command container startup (default
  `127.0.0.1:10090`).

## Local development

```
pnpm install      # or npm install (deps: react/redux/helmet/framer-motion/probe-image-size; styles: Tailwind 3 + postcss + less/sass)
pnpm build        # esbuild → build/server-ssr.cjs + public/js/client.mjs + client.css
pnpm start        # start Node SSR backend + $LUME nsbp.lume → http://127.0.0.1:10090
# or: pnpm dev:clean + build + start all-in-one
# stop: make stop (reads .data/start.pids; or Ctrl-C on start.js)
```

`start.js` resolves the Lume binary: the `LUME` env var → `~/.local/bin/lume`
(release) → project-relative `../../../work/lume/lume/bin/lume` (source tree).
The Node backend uses the system `node` by default (overridable via the `NODE`
env var; in desktop environments
`~/.local/share/TeleAgent/runtimes/node/bin/node`). The port is controlled by
the `PORT` env var, default `10090`.

**Self-healing (anti-502):** on startup `start.js` first kills any stale SSR
backend / Lume front (`pgrep -f server-ssr.cjs` / `lume nsbp.lume` + `kill -9`),
removes the leftover socket, and only starts the Lume front once the socket is
really ready — guaranteeing exactly one clean backend/front pair at any time,
avoiding "front up, backend socket gone" 502s. If it can't kill (no permission)
or the port is taken, it prints manual cleanup commands for the terminal.

## Docker (port >10000)

Three-stage image (see `Dockerfile`): Node builds SSR/client → pulls the
**static** Lume binary (the offline
`docker/lume-linux-x64-static.tar.gz` works, otherwise fetched from GitHub per
`LUME_VERSION`) → alpine + `nodejs` apk runs the resident SSR backend, with
Lume as the front on `0.0.0.0:10090` (`entrypoint.sh` starts the Node backend
first, waits for the socket, then starts Lume).

```
# Build (offline-capable: the context ships docker/lume-linux-x64-static.tar.gz)
make docker-build            # or docker build -t nsbp-lume .

# Start container (host 127.0.0.1:10090 → container :10090)
make docker-up               # or docker compose up -d
curl http://127.0.0.1:10090/api/health         # Lume DSL native data endpoint
curl http://127.0.0.1:10090/getPhotoMenu        # Node backend photo endpoint (fs+probe-image-size)
curl http://127.0.0.1:10090/                   # SSR HTML (#root has React markup + window.context)

make docker-down             # stop and remove the container
```

The host port defaults to `10090` (>10000), overridable with `HOST_PORT`:
`HOST_PORT=10090 make docker-up`. The image binds to `127.0.0.1` by default; to
expose it on other interfaces, change
`127.0.0.1:${HOST_PORT:-10090}` to `${HOST_PORT:-10090}` in
`docker-compose.yml`.

> Note: Docker is not installed on the author's machine, so this can't be built
> or run locally; the files are written to build and run directly on a Docker
> host. Lume needs `v0.8.0+` (which supports `react_prefix`); the repo's offline
> tarball satisfies this.

## Verified routes (real `nsbp.lume` end-to-end)

- `GET /` — **SSR** (identical to nsbp Home): helmet title/meta + static
  `/js/client.css` (Tailwind expanded at build time) in the head, `window.context`
  carries the prefetched photo menu, body holds the initial Layout state, HTTP
  200 `text/html`.
- `GET /photo?dic=test` — **SSR** (identical to nsbp Photo): helmet title=Photo +
  prefetched width/height data (styles via static client.css).
- `GET /getPhotoMenu` / `GET /getPhotoWH?dic=test` / `GET /images/test/0.jpg` —
  Node backend data endpoints (via relay), returning `{"data":[...]}` / raw
  image bytes.
- `GET /api/health` — Lume DSL native route, `{"ok":true,...}`,
  `application/json`.
- `GET /js/client.mjs` + `/js/client.css` — static hydration bundle + extracted
  styles.
- `GET /login` — Lume engine C-layer reserved path (AgentHTTPD session gate),
  not handled by the React relay.

## `ssr` parameter (first-paint mode; legacy `nsbp` compatible)

| URL | Behaviour |
|---|---|
| omitted / `?ssr=1` | **SSR default**: first paint shows server-rendered content directly (no Loading flash) |
| `?ssr=0` | explicit **animation/client-data mode**: plays `Loading` first, then expands; the Photo page refetches on the client |
| legacy `?nsbp=0` / `?nsbp=1` | **still readable** (`ssr` takes precedence, falls back to `nsbp`); new links always write `ssr=` |

> The canonical param name changed from `nsbp` to the plainer `ssr`; links shared
> from the old project with `nsbp=` still work (`getSSRParam()` in
> `utils/index.ts` falls back `ssr`→`nsbp`, new links write `ssr=`). The page
> document is always Node SSR rendered (`ssr=0` doesn't turn it into a CSR
> document); "pure CSR" only happens in the degraded case where the backend
> isn't up and the static fallback page opens directly. The Suspense photo data
> boundary is orthogonal to this parameter.

## License

[MIT](LICENSE)

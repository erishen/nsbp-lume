# syntax=docker/dockerfile:1
#
# nsbp-lume: React SSR (renderToPipeableStream) served by the Lume C engine.
#   - Stage 1 (ui):    node build -> bin/nsbp-ssr-server (FCGI) + public/js/client.mjs
#                       (+ client.css, tailwind-expanded); ships public/images + favicons
#   - Stage 2 (lume):  static Lume binary that supports react_prefix/react_socket
#   - Stage 3 (run):   alpine + nodejs (the resident SSR backend) ; Lume fronts the port
#
# Build:  docker build -t nsbp-lume .
# Run:    docker run --rm -p 127.0.0.1:10090:10090 nsbp-lume
#         (or) docker compose up -d   ->  http://127.0.0.1:10090

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
# 1. UI build: esbuild bundles the resident SSR backend + the browser bundle.
#    "pnpm install" (full, devDeps included) provides the Tailwind toolchain
#    (tailwindcss + postcss + autoprefixer + less + sass + esbuild) that
#    scripts/build-ssr.js uses to expand @tailwind -> client.css. No file:
#    links, so the image is self-contained and builds from a normal registry.
#    NOTE: the ui stage keeps the default NODE_ENV (not production) so pnpm
#    installs devDependencies - required for the in-image build.
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS ui
WORKDIR /app

ARG APK_MIRROR=https://mirrors.aliyun.com/alpine
ARG PNPM_VERSION=10.28.0
RUN sed -i "s#https\?://[a-z0-9.-]*alpinelinux.org/alpine#$APK_MIRROR#g" /etc/apk/repositories \
 && apk add --no-cache coreutils gzip \
 && npm install -g pnpm@"${PNPM_VERSION}"

COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json tailwind.config.js ./
COPY src ./src
COPY scripts ./scripts
COPY nsbp.lume ./nsbp.lume
# Static assets Lume serves from the docroot + the photo data the node backend
# reads via fs: public/images, favicons, the web manifest, and the SPA-shell
# index.html. .dockerignore excludes public/js (the stale committed bundle);
# the in-image build below regenerates it.
COPY public/ ./public/

# Plain install (not --frozen) so a slightly-stale lockfile self-heals.
RUN pnpm install

# -> build/server-ssr.cjs + public/js/client.mjs + public/js/client.css
#    (tailwind-expanded in-process via postcss + tailwindcss, driven by
#    tailwind.config.js), staged under /out.
RUN node scripts/build-ssr.js \
 && mkdir -p /out/bin /out/public \
 && cp build/server-ssr.cjs /out/bin/nsbp-ssr-server \
 && cp -R public/. /out/public/ \
 && cp nsbp.lume /out/nsbp.lume

# ---------------------------------------------------------------------------
# 2. Fetch the Lume release (static build: runs on alpine/scratch, no glibc).
#    For offline builds drop docker/lume-linux-<arch>-static.tar.gz into the
#    context; it is used in place of a GitHub download.
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM alpine:3.23 AS lume
ARG LUME_VERSION=v0.11.0
ARG LUME_REPO=erishen/lume
ARG TARGETARCH
ARG APK_MIRROR=https://mirrors.aliyun.com/alpine

COPY docker/ /tmp/docker/

RUN sed -i "s#https\?://[a-z0-9.-]*alpinelinux.org/alpine#$APK_MIRROR#g" /etc/apk/repositories \
 && apk add --no-cache curl tar \
 && target_arch="${TARGETARCH:-$(uname -m)}" \
 && case "$target_arch" in \
      amd64|x86_64) arch=x64 ;; \
      arm64|aarch64) arch=arm64 ;; \
      *) echo "unsupported architecture: $target_arch" >&2; exit 1 ;; \
    esac \
 && local_tarball="/tmp/docker/lume-linux-${arch}-static.tar.gz" \
 && if [ -f "$local_tarball" ]; then \
      echo "using local lume tarball: $local_tarball"; \
      cp "$local_tarball" /tmp/lume.tar.gz; \
    else \
      if [ "$LUME_VERSION" = "latest" ]; then \
        url="https://github.com/$LUME_REPO/releases/latest/download/lume-linux-${arch}-static.tar.gz"; \
      else \
        url="https://github.com/$LUME_REPO/releases/download/$LUME_VERSION/lume-linux-${arch}-static.tar.gz"; \
      fi; \
      curl -fsSL "$url" -o /tmp/lume.tar.gz; \
    fi \
 && mkdir -p /out \
 && tar -xzf /tmp/lume.tar.gz -C /out \
 && bin="$(find /out \( -type f -o -type l \) -name lume | head -1)" \
 && test -n "$bin" \
 && cp "$bin" /usr/local/bin/lume \
 && chmod +x /usr/local/bin/lume \
 && /usr/local/bin/lume --version \
 && if ! grep -aq 'react_prefix' /usr/local/bin/lume; then \
      echo "ERROR: lume does not support react_prefix." >&2; \
      echo "Use a newer release, or drop a source-built lume-linux-${arch}-static.tar.gz into docker/." >&2; \
      exit 1; \
    fi

# ---------------------------------------------------------------------------
# 3. Runtime: nodejs is still required for the resident React SSR backend.
#    alpine's nodejs apk (~76MB) is leaner than node:24-alpine; npm not needed.
# ---------------------------------------------------------------------------
FROM alpine:3.23 AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=10090 \
    SSR_SOCK=/app/.data/nsbp-ssr.sock \
    LUME_BIND=0.0.0.0 \
    NSBP_RENDER_TTL_MS=60000

ARG APK_MIRROR=https://mirrors.aliyun.com/alpine
RUN sed -i "s#https\?://[a-z0-9.-]*alpinelinux.org/alpine#$APK_MIRROR#g" /etc/apk/repositories \
 && apk add --no-cache nodejs \
 && addgroup -S app && adduser -S app -G app

COPY --from=ui    --chown=app:app /out/bin/nsbp-ssr-server ./bin/nsbp-ssr-server
COPY --from=ui    --chown=app:app /out/public                ./public
COPY --from=ui    --chown=app:app /out/nsbp.lume             ./nsbp.lume
COPY --from=lume  --chown=app:app /usr/local/bin/lume        ./bin/lume
COPY --chown=app:app --chmod=755 docker/entrypoint.sh ./entrypoint.sh

RUN mkdir -p /app/.data && chown app:app /app/.data

USER app
EXPOSE 10090

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const n=require('net');const s=n.connect(Number(process.env.PORT||10090),'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]

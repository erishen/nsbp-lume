#!/bin/sh
# nsbp-lume container entrypoint:
#   1. start the resident node React SSR backend on a UNIX socket (FastCGI),
#   2. wait for the socket to come up,
#   3. start the Lume engine in front (AgentHTTPD + FastCGI relay + static docroot),
#   4. keep the container alive while either process runs; clean up on signal.
set -eu

: "${SSR_SOCK:=/app/.data/nsbp-ssr.sock}"
export SSR_SOCK

mkdir -p "$(dirname "$SSR_SOCK")"

# 1. Node SSR backend (FastCGI server on the socket).
node ./bin/nsbp-ssr-server "$SSR_SOCK" &
SSR_PID=$!

cleanup() {
  kill "$SSR_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# 2. Wait for the FCGI socket before Lume starts relaying page routes to it.
i=0
while [ ! -S "$SSR_SOCK" ] && [ "$i" -lt 100 ]; do
  sleep 0.1
  i=$((i + 1))
done

# 3. Lume front: HTTP on $PORT bound to $LUME_BIND (0.0.0.0 in the container so
#    the docker port mapping can reach it; relay + static docroot + DSL data routes).
./bin/lume nsbp.lume &
LUME_PID=$!

# 4. Stay alive while both are running; exit when either dies.
while kill -0 "$LUME_PID" 2>/dev/null && kill -0 "$SSR_PID" 2>/dev/null; do
  sleep 1
done

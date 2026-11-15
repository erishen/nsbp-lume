// nsbp-lume launcher: starts the resident React SSR backend, then the Lume
// engine which fronts the HTTP port and relays page routes to that backend.
//
// Two processes:
//   1. node build/server-ssr.cjs ./.data/nsbp-ssr.sock   (React SSR via FCGI)
//   2. $LUME nsbp.lume                                     (AgentHTTPD front)
// Ctrl-C stops both. The FCGI socket and port are overridable via env.
//
// Self-heal: on start we kill every stale backend/front and remove a stale
// socket, so a single clean pair is always running. (In a terminal without
// kill permission this silently no-ops; a bind failure is then surfaced
// with a hint below.)

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function resolveLume() {
  if (process.env.LUME) return process.env.LUME;
  const candidates = [
    join(homedir(), ".local/bin/lume"),
    join(root, "../../../work/lume/lume/bin/lume"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return "lume";
}

// This desktop env puts a wrapper on PATH that blocks on hermit setup; the
// real binary lives under a user runtime dir. Prefer that when present.
function resolveNode() {
  const candidates = [
    join(homedir(), ".local/share/TeleAgent/runtimes/node/bin/node"),
    "node",
  ];
  for (const c of candidates) {
    if (c !== "node" && existsSync(c)) return c;
    if (c === "node") return c; // fall back to PATH
  }
  return "node";
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A UNIX socket file can exist while nobody is listening on it — that is
// exactly the state a dead backend leaves behind. Existence answers "true";
// only a successful connect answers "ready".
function canConnect(path, timeoutMs = 250) {
  return new Promise((resolve) => {
    let settled = false;
    const probe = net.connect(path);
    const done = (ok) => {
      if (settled) return;
      settled = true;
      probe.destroy();
      resolve(ok);
    };
    probe.once("connect", () => done(true));
    probe.once("error", () => done(false));
    setTimeout(() => done(false), timeoutMs);
  });
}

const lume = resolveLume();
const node = resolveNode();
const sock = process.env.SSR_SOCK || join(root, ".data/nsbp-ssr.sock");
const port = process.env.PORT || "10090";
const pidsFile = join(root, ".data/start.pids");
const backendBin = join(root, "build/server-ssr.cjs");

if (!existsSync(backendBin)) {
  console.error("missing build/server-ssr.cjs — run `pnpm build` first.");
  process.exit(1);
}
mkdirSync(join(root, ".data"), { recursive: true });

// --- self-heal: kill stale pairs --------------------------------------
// Patterns match this project's backends ("server-ssr.cjs") and fronts
// ("nsbp.lume"). The launcher's own argv is "start.js", so it never matches;
// we also exclude our own pid explicitly. Fails soft when kill is not
// permitted (sandboxed hosts), which is fine — a bind conflict is then
// surfaced with a manual-cleanup hint instead of crashing.
function killStale() {
  const pids = new Set();
  for (const pat of ["server-ssr.cjs", "nsbp.lume"]) {
    const r = spawnSync("pgrep", ["-f", pat], { encoding: "utf8" });
    if (r.status === 0 && r.stdout) {
      for (const id of r.stdout.trim().split(/\s+/)) {
        if (id && id !== String(process.pid)) pids.add(id);
      }
    }
  }
  if (pids.size > 0) {
    console.log(`==> killing stale processes: ${[...pids].join(" ")}`);
    const killResult = spawnSync("kill", ["-9", ...[...pids]]);
    // EPERM is tolerated, but never silent: if the kill did not take, the
    // stale process still holds the socket and the next bind will fail.
    if (killResult.status !== 0) {
      console.warn(
        `[start] kill -9 exited ${killResult.status}: stale pids may still hold ${sock}`
      );
    }
  }
}

await killStale();
await wait(400);
try {
  unlinkSync(sock); // stale socket left by a dead backend
} catch (err) {
  // ENOENT means nothing to clean; anything else means the stale socket is
  // still on disk and the readiness probe below has to cope with it.
  if (err?.code !== "ENOENT") {
    console.warn(`[start] stale socket not removed: ${err?.code ?? err?.message}`);
  }
}

// The Lume front reads SSR_SOCK / PORT from the environment (nsbp.lume uses
// env("SSR_SOCK") / env("PORT")); the node backend gets the socket via argv.
process.env.SSR_SOCK = sock;
process.env.PORT = port;
console.log(`==> SSR backend: ${node} ${backendBin} ${sock}`);
console.log(`==> Lume front : ${lume} nsbp.lume (http://127.0.0.1:${port}, Ctrl-C stop)`);

// --- fault-tolerant process control -----------------------------------
// kill(2) may be blocked (EPERM) on restricted hosts; never let a process
// control path crash the launcher.
let shuttingDown = false;
function killProc(child) {
  try {
    child.kill("SIGINT");
  } catch {
    /* EPERM / already-gone */
  }
}
function writePids() {
  try {
    writeFileSync(pidsFile, [process.pid, backend.pid, front.pid].join("\n") + "\n");
  } catch {
    /* best effort */
  }
}
function clearPids() {
  try {
    unlinkSync(pidsFile);
  } catch {
    /* ignore */
  }
}
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  killProc(backend);
  killProc(front);
  clearPids();
  process.exit(code ?? 0);
}

// 1) Start the SSR backend first.
const backend = spawn(node, [backendBin, sock], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
backend.on("error", (e) => console.error("[ssr] spawn error:", e.message));

// Wait until the FCGI socket actually accepts a connection (up to 5s) —
// the front must never start relaying before the backend is listening.
// The predicate is a connection, not `existsSync`: a socket file left by a
// dead backend also reports "exists", and the front would then relay page
// routes into a void (every route 502 while static assets stay fine).
let waited = 0;
while (!(await canConnect(sock))) {
  if (backend.exitCode !== null) {
    console.error("SSR backend exited early; not starting Lume front.");
    clearPids();
    process.exit(backend.exitCode ?? 1);
  }
  if (waited >= 5000) {
    console.error("timed out waiting for FCGI socket; not starting Lume front.");
    killProc(backend);
    clearPids();
    process.exit(1);
  }
  await wait(100);
  waited += 100;
}
// Written only after a connection succeeded, so a zombie socket can no
// longer produce this line while the backend is still starting up.
console.log(`==> FCGI socket ready after ${waited}ms: ${sock}`);

// 2) Start the Lume front (owns the HTTP port, relays to the socket).
const front = spawn(lume, ["nsbp.lume"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
front.on("error", (e) => console.error("[lume] spawn error:", e.message));

writePids();

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", clearPids);

front.on("exit", (code, signal) => {
  if (shuttingDown) {
    clearPids();
    process.exit(code ?? 0);
    return;
  }
  if (signal) {
    shutdown(0);
    return;
  }
  console.error(`Lume front exited (${code}).`);
  console.error(
    "If the port was busy (Address already in use), a stale front survived the " +
      "self-heal kill (no permission). Clean up in a terminal with kill access:"
  );
  console.error(
    `  pkill -9 -f 'server-ssr.cjs'; pkill -9 -f 'lume nsbp.lume'; rm -f ${sock}`
  );
  killProc(backend);
  clearPids();
  process.exit(code ?? 1);
});

backend.on("exit", (code) => {
  if (shuttingDown) return;
  console.error(`SSR backend exited (${code}); stopping Lume front.`);
  shutdown(code ?? 1);
});

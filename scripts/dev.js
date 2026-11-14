import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: root, stdio: "inherit", env: process.env });
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });

// clean → build the SSR backend + client bundle → start both (node SSR + Lume front).
await run("node", [join(__dirname, "clean.js")]);
await run("node", [join(__dirname, "build-ssr.js")]);
await run("node", [join(__dirname, "start.js")]);

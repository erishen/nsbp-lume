// Type-check the Lume program (equivalent to: $LUME --check nsbp.lume).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

const lume = resolveLume();
console.log(`==> ${lume} --check nsbp.lume`);
const r = spawnSync(lume, ["--check", "nsbp.lume"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status ?? 1);

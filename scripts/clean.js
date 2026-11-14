import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
rmSync(join(root, "build"), { recursive: true, force: true });
rmSync(join(root, "public", "js"), { recursive: true, force: true });
rmSync(join(root, ".data"), { recursive: true, force: true });
console.log("cleaned");

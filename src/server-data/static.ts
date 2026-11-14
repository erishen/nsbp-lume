// Serve a small set of well-known docroot static assets with the correct
// Content-Type. Because Lume's react_prefix="/" relays every non-reserved
// path to the node backend, /site.webmanifest & /favicon.svg would otherwise
// hit the SPA fallback and come back as text/html (browser: "Manifest:
// Syntax error"). This module maps them to their real MIME types and reads
// the bytes from <cwd>/public (same docroot Lume serves).
import fs from "node:fs";
import path from "node:path";

const ASSET_TYPES: Record<string, string> = {
  "/site.webmanifest": "application/manifest+json",
  "/favicon.svg": "image/svg+xml",
  "/favicon.ico": "image/x-icon",
  "/favicon-16x16.png": "image/png",
  "/favicon-32x32.png": "image/png",
  "/favicon-192x192.png": "image/png",
  "/favicon-512x512.png": "image/png",
  "/apple-touch-icon.png": "image/png",
};

export interface StaticAsset {
  buf: Buffer;
  type: string;
}

export function readStaticAsset(
  pathname: string
): StaticAsset | null {
  const type = ASSET_TYPES[pathname];
  if (!type) return null;
  const file = path.join(
    process.cwd(),
    process.env.NSBP_DOCROOT || "public",
    pathname.slice(1)
  );
  // path-traversal guard: must stay inside the docroot
  if (!file.startsWith(path.resolve(process.cwd(), process.env.NSBP_DOCROOT || "public"))) {
    return null;
  }
  try {
    const st = fs.statSync(file);
    if (!st.isFile()) return null;
    return { buf: fs.readFileSync(file), type };
  } catch {
    return null;
  }
}

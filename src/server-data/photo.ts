// Server-side photo library data, ported from nsbp's src/server/photo.ts but
// WITHOUT express. Both the JSON data routes (/getPhotoMenu, /getPhotoWH,
// /images/*) and the SSR prefetch call these directly in-process — no
// self-HTTP. The library lives under <docroot>/images.
//
// getPhotoWH is the expensive one (reads every image + probes dimensions),
// so results are cached per `dic` in memory. The cache key is an FNV-1a
// signature over each file's (mtime + relative path) + the file count, which
// the cheap stat-only walk computes anyway — so any added/removed/replaced
// image invalidates the cache automatically, no TTL needed.

import fs from "node:fs";
import path from "node:path";
import probe from "probe-image-size";

// Resolve the images directory relative to cwd (project root locally, /app in
// the container). Lume's docroot is ./public, so images sit in public/images.
const getImagesDir = (): string =>
  path.join(process.cwd(), process.env.NSBP_IMAGES_DIR || "public/images");

type PhotoMenuItem = { name: string; cover?: string; count?: number };
type PhotoWH = [number, number, string];

// --- /getPhotoMenu: category menu (readdir + stat only, cheap, no cache) ---
const getFileMenu = (dir: string): PhotoMenuItem[] => {
  if (!fs.existsSync(dir)) return [];
  const arr = fs.readdirSync(dir);
  const result: PhotoMenuItem[] = [];
  for (const item of arr) {
    const fullPath = path.join(dir, item);
    let stats: fs.Stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!stats.isDirectory()) continue;
    const files = fs
      .readdirSync(fullPath)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
    const count = files.length;
    let cover = "";
    const coverPath = path.join(fullPath, "cover.jpg");
    if (fs.existsSync(coverPath)) {
      cover = `/images/${item}/cover.jpg`;
    } else if (files.length > 0) {
      cover = `/images/${item}/${files[0]}`;
    }
    result.push({ name: item, cover, count });
  }
  return result;
};

// --- /getPhotoWH: [width, height, relPath] per image, mtime-signature cached ---

// FNV-1a over unsigned ints — robust for arbitrary file counts (a raw mtime
// SUM overflows Number precision well before ~5k files).
function fnvUpdate(h: number, v: number): number {
  h ^= v & 0x7fffffff;
  h = Math.imul(h, 0x01000193) >>> 0;
  return h;
}
function fnvOfStr(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) h = fnvUpdate(h, s.charCodeAt(i));
  return h;
}

type WHHit = { sig: string; result: PhotoWH[] };
const whCache = new Map<string, WHHit>();

// Stat-only walk: file list + a content-ish signature (count + per-file
// mtime-seconds + relative path). Cheap; does NOT read file bytes.
function walkSignature(dir: string, rootDir: string, files: string[]) {
  let h = 0x811c9dc5;
  const rec = (d: string) => {
    for (const item of fs.readdirSync(d)) {
      const full = path.join(d, item);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        rec(full);
      } else {
        files.push(full);
        h = fnvUpdate(h, Math.round(st.mtimeMs / 1000));
        h = fnvOfStr(h, path.relative(rootDir, full));
      }
    }
  };
  rec(dir);
  return `${files.length}:${h.toString(16)}`;
}

export interface WHResult {
  data: PhotoWH[];
  // True when served from the in-memory cache (no file reads / probing).
  cached: boolean;
}

// Collect [width, height, relativePath] for every image under images/ (or
// images/<dic>). Path-traversal-safe. Expensive probing is skipped whenever the
// mtime signature is unchanged (X-PhotoWH: hit).
const getPhotoWH = (dic: string): WHResult => {
  const imagesDir = getImagesDir();
  if (dic && !/^[a-zA-Z0-9_-]+$/.test(dic)) {
    throw new Error("Invalid directory name");
  }
  const photoPath = dic ? path.join(imagesDir, dic) : imagesDir;
  const resolved = path.resolve(photoPath);
  const resolvedRoot = path.resolve(imagesDir);
  if (!resolved.startsWith(resolvedRoot)) {
    throw new Error("Access denied");
  }
  if (!fs.existsSync(photoPath)) return { data: [], cached: false };

  const files: string[] = [];
  const sig = walkSignature(resolved, imagesDir, files);

  const hit = whCache.get(dic);
  if (hit && hit.sig === sig) return { data: hit.result, cached: true };

  const out: PhotoWH[] = [];
  for (const abs of files) {
    const rel = path.relative(imagesDir, abs).split(path.sep).join("/");
    let w = 0;
    let h = 0;
    try {
      const data = fs.readFileSync(abs);
      const r = probe.sync(data);
      w = r?.width ?? 0;
      h = r?.height ?? 0;
    } catch {
      w = 0;
      h = 0;
    }
    out.push([w, h, rel]);
  }
  whCache.set(dic, { sig, result: out });
  return { data: out, cached: false };
};

// Serve a single image file (for /images/... relayed requests). Returns the
// raw bytes + content type, or null when missing/out of range.
const readImage = (relPath: string): { buf: Buffer; type: string } | null => {
  const imagesDir = getImagesDir();
  // relPath is like "test/0.jpg" (after the leading "/images/").
  if (relPath.includes("..") || relPath.includes("\0")) return null;
  const full = path.resolve(imagesDir, relPath);
  if (!full.startsWith(path.resolve(imagesDir) + path.sep)) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  const ext = path.extname(full).toLowerCase();
  const type =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "application/octet-stream";
  return { buf: fs.readFileSync(full), type };
};

export { getFileMenu, getPhotoWH, readImage, getImagesDir };

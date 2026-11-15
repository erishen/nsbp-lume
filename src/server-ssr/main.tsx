// nsbp-lume resident React SSR backend.
//
// The Lume engine (C binary, AgentHTTPD) owns the front HTTP port and, with
// `react_prefix = "/"`, relays EVERY non-reserved path (page routes AND the
// /getPhotoMenu, /getPhotoWH, /images/* data paths) over a UNIX socket as
// FastCGI to this process. So this backend does two jobs, in one node process:
//
//   1. Data routes (JSON / raw bytes, no relay target needed upstream):
//        GET /getPhotoMenu -> { data: [...] }  (photo category menu)
//        GET /getPhotoWH   -> { data: [...] }  (photo width/height + relative path;
//          mtime-signature cached in memory, header X-PhotoWH: hit|miss)
//        GET /images/...  -> raw image bytes with the right Content-Type
//      These read the local photo library in-process (server-data/photo.ts) —
//      no self-HTTP, exactly like nsbp's Express handlers but without Express.
//
//   2. Page routes (full React SSR):
//        StaticRouter + Provider + Theme + Helmet, with the
//        store prefetched in-process before the first render (so Home/Photo
//        first-paint already has the photo menu / dimensions). Uses
//        renderToPipeableStream: head (helmet title/meta + static /js/client.css
//        link, Tailwind pipeline) then streamed React chunks then the
//        __NSBP_CONTEXT__ JSON data block; the assembled document feeds the ISR
//        cache. The block is NOT inline JS (script-src 'self' stays strict) —
//        the client reads it to seed its Redux store (see client/index.tsx).
//
// Run:  <node> build/server-ssr.cjs <sock-path>   (produced by scripts/build-ssr.js)

import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { Writable } from "node:stream";
import { StaticRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { Helmet } from "react-helmet";
// (styles: static Tailwind pipeline -> /js/client.css, linked in <head>;
//  no runtime style collection needed any more)
import Theme from "@components/Theme";
import getStore from "@store";
import routers from "../Routers";
import { REQUEST_QUERY, GET_PHOTO_MENU, GET_PHOTO_WIDTH_HEIGHT } from "@store/constants";
import { getFileMenu, getPhotoWH, readImage, getImagesDir } from "../server-data/photo";
import { readStaticAsset } from "../server-data/static";
import { setServerResolvers, type PhotoMenu, type PhotoWH } from "@services/suspense";

// Register the in-process data resolvers used by the Suspense boundaries
// (src/services/suspense.ts). On the server the use() hooks suspend until
// these settle, so the page shell streams first and the photo content after.
setServerResolvers({
  photoMenu: async (): Promise<PhotoMenu> => {
    try { return safeMenu() as PhotoMenu; } catch { return []; }
  },
  photoWH: async (dic: string): Promise<PhotoWH> => {
    try { return getPhotoWH(dic).data; } catch { return []; }
  },
});

// --- FCGI wire constants (spec, Dec 1996) --------------------------------
const FCGI_VERSION = 1;
const BEGIN_REQUEST = 1;
const END_REQUEST = 3;
const PARAMS = 4;
const STDIN = 5;
const STDOUT = 6;
const REQUEST_COMPLETE = 0;

type Params = Record<string, string>;

// --- ISR-style render cache ------------------------------------------------
// GET page documents are cached in memory by (path, sorted-query). A hit skips
// React entirely; a miss renders once and stores the resolved document.
const RENDER_CACHE_TTL_MS = Number(process.env.NSBP_RENDER_TTL_MS || 60_000);
const RENDER_CACHE_MAX = 200;
const renderCache = new Map<string, { doc: string; at: number }>();

function cacheKey(pathname: string, query: string): string {
  const sorted = query ? query.split("&").sort().join("&") : "";
  return pathname + "?" + sorted;
}
function cacheGet(key: string): string | null {
  const hit = renderCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > RENDER_CACHE_TTL_MS) {
    renderCache.delete(key);
    return null;
  }
  return hit.doc;
}
function cacheSet(key: string, doc: string): void {
  if (renderCache.size >= RENDER_CACHE_MAX) {
    const oldest = renderCache.keys().next().value;
    if (oldest !== undefined) renderCache.delete(oldest);
  }
  renderCache.set(key, { doc, at: Date.now() });
}

function sendFrame(sock: net.Socket, type: number, reqId: number, payload: Buffer | string): void {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const padLen = (8 - (body.length % 8)) % 8;
  const hdr = Buffer.alloc(8);
  hdr[0] = FCGI_VERSION;
  hdr[1] = type;
  hdr.writeUInt16BE(reqId, 2);
  hdr.writeUInt16BE(body.length, 4);
  hdr[6] = padLen;
  sock.write(hdr);
  if (body.length) sock.write(body);
  if (padLen) sock.write(Buffer.alloc(padLen));
}

// Incremental FCGI frame reader: accumulate raw bytes, yield parsed frames.
class FcgParser {
  private pending: Buffer[] = [];
  private pendingLen = 0;
  private hdr: { type: number; reqId: number; clen: number; plen: number; content: Buffer | null } | null = null;
  constructor(private readonly onRecord: (f: { type: number; reqId: number; content: Buffer }) => void) {}

  push(chunk: Buffer): void {
    this.pending.push(chunk);
    this.pendingLen += chunk.length;
    this._drain();
  }
  private _take(n: number): Buffer | null {
    const buf = Buffer.alloc(n);
    let got = 0;
    while (got < n) {
      const part = this.pending[0];
      if (!part) return null;
      const take = Math.min(part.length, n - got);
      part.copy(buf, got, 0, take);
      got += take;
      if (take === part.length) this.pending.shift();
      else this.pending[0] = part.subarray(take);
    }
    this.pendingLen -= n;
    return buf;
  }
  private _drain(): void {
    for (;;) {
      if (!this.hdr) {
        const h = this._take(8);
        if (!h) return;
        this.hdr = {
          type: h[1],
          reqId: h.readUInt16BE(2),
          clen: h.readUInt16BE(4),
          plen: h[6],
          content: null,
        };
      }
      if (!this.hdr.content) {
        if (this.pendingLen < this.hdr.clen) return;
        this.hdr.content = this._take(this.hdr.clen) as Buffer;
      }
      if (this.pendingLen < this.hdr.plen) return;
      if (this.hdr.plen > 0) this._take(this.hdr.plen);
      const frame = { type: this.hdr.type, reqId: this.hdr.reqId, content: this.hdr.content };
      this.hdr = null;
      if (frame.type === END_REQUEST) return;
      this.onRecord(frame);
    }
  }
}

// PARAMS content: nameLen valueLen name value, both lengths 1 or 4 bytes.
function parseParamsFrame(content: Buffer, params: Params): void {
  let off = 0;
  while (off < content.length) {
    let nameLen: number;
    if ((content[off] & 0x80) === 0) nameLen = content[off++];
    else {
      nameLen = ((content[off] & 0x7f) << 24) | (content[off + 1] << 16) | (content[off + 2] << 8) | content[off + 3];
      off += 4;
    }
    let valueLen: number;
    if ((content[off] & 0x80) === 0) valueLen = content[off++];
    else {
      valueLen = ((content[off] & 0x7f) << 24) | (content[off + 1] << 16) | (content[off + 2] << 8) | content[off + 3];
      off += 4;
    }
    if (off + nameLen + valueLen > content.length) break;
    params[content.subarray(off, off + nameLen).toString()] = content.subarray(off + nameLen, off + nameLen + valueLen).toString();
    off += nameLen + valueLen;
  }
}

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const k = eq >= 0 ? pair.slice(0, eq) : pair;
    const v = eq >= 0 ? pair.slice(eq + 1) : "";
    try {
      out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      /* ignore malformed pair */
    }
  }
  return out;
}

function sendStreamChunk(sock: net.Socket, reqId: number, text: Buffer | string): void {
  const buf = Buffer.isBuffer(text) ? text : Buffer.from(text, "utf8");
  for (let off = 0; off < buf.length; off += 0xffff) sendFrame(sock, STDOUT, reqId, buf.subarray(off, off + 0xffff));
}
function sendRequestEnd(sock: net.Socket, reqId: number): void {
  const end = Buffer.alloc(8);
  end.writeUInt32BE(0, 0);
  end[4] = REQUEST_COMPLETE;
  sendFrame(sock, END_REQUEST, reqId, end);
}

// --- helpers: send a complete buffered response over the FCGI socket -------
function respondFull(sock: net.Socket, reqId: number, statusLine: string, headers: string, bodyBytes: Buffer | string, extraHeaders = ""): void {
  const body = Buffer.isBuffer(bodyBytes) ? bodyBytes : Buffer.from(bodyBytes, "utf8");
  const head =
    statusLine +
    "Content-Length: " + body.length + "\r\n" +
    "Date: " + new Date().toUTCString() + "\r\n" +
    "X-Content-Type-Options: nosniff\r\n" +
    extraHeaders +
    "Connection: close\r\n\r\n";
  sendStreamChunk(sock, reqId, head);
  if (body.length) sendStreamChunk(sock, reqId, body);
  sendRequestEnd(sock, reqId);
}

// --- SSR document assembly (streaming) ---------------------------------------
// docHead carries everything that must precede the streamed body markup:
// doctype, static head meta, the helmet-rendered title/meta, and the static
// /js/client.css link (Tailwind pipeline, built once). docTail carries the
// prefetched state as a JSON <script type="application/json"> data block (NOT
// inline JS — so the Content-Security-Policy can stay strict, script-src
// 'self', no 'unsafe-inline') + the client bundle script for hydrateRoot.
// --- Content-Security-Policy (defense in depth) ------------------------------
// The only scripts are /js/client.mjs (self) and the JSON data block (not
// executed), so script-src needs no 'unsafe-inline'. style-src 'unsafe-inline'
// is required: React SSR + framer-motion emit inline style attributes.
// img-src data: is the carousel's placeholder (1x1 transparent PNG).
// connect-src 'self' covers fetch(/getPhotoWH, /getPhotoMenu, /api/visit).
// frame-ancestors 'none' is the CSP form of X-Frame-Options: DENY.
const CSP_HEADER =
  "Content-Security-Policy: default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "font-src 'self'; " +
  "connect-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'\r\n";

function safeScriptJson(o: unknown): string {
  return JSON.stringify(o).replace(/</g, "\\u003c");
}

function docHead(helmet: ReturnType<typeof Helmet.renderStatic>): string {
  const title = helmet?.title ? helmet.title.toString() : "";
  const meta = helmet?.meta ? helmet.meta.toString() : "";
  return (
    "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n" +
    "<meta charset=\"utf-8\" />\n" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n" +
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />\n' +
    '<link rel="icon" type="image/x-icon" href="/favicon.ico" />\n' +
    '<link rel="manifest" href="/site.webmanifest" />\n' +
    '<meta name="theme-color" content="#2563eb" />\n' +
    title +
    meta +
    '<link rel="stylesheet" href="/js/client.css" />\n' +
    "</head>\n" +
    "<body>\n" +
    '<div id="root">'
  );
}

// Prefetched state is carried as a JSON data block (script-src 'self' stays
// strict — no inline JS, no 'unsafe-inline' for scripts). type=application/json
// is not executed by the browser, so CSP does not need to allow it.
function docTail(state: unknown): string {
  return (
    "</div>\n" +
    '<script type="application/json" id="__NSBP_CONTEXT__">' +
    safeScriptJson({ state }) +
    "</script>\n" +
    '<script type="module" src="/js/client.mjs"></script>\n' +
    "</body>\n</html>\n"
  );
}

// Prefetch page data
// Prefetch page data into a fresh store (mirrors what the route.loadData thunks
// do, but in-process so it works without HTTP on the server).
function buildStore(pathname: string, queryMap: Record<string, string>) {
  const store = getStore();
  store.dispatch({ type: REQUEST_QUERY, query: queryMap } as never);
  if (pathname === "/") {
    store.dispatch({ type: GET_PHOTO_MENU, menu: safeMenu() } as never);
  } else if (pathname === "/photo" || pathname.startsWith("/photo/")) {
    const dic = queryMap.dic || "";
    store.dispatch({ type: GET_PHOTO_MENU, menu: safeMenu() } as never);
    try {
      store.dispatch({ type: GET_PHOTO_WIDTH_HEIGHT, data: getPhotoWH(dic).data } as never);
    } catch {
      store.dispatch({ type: GET_PHOTO_WIDTH_HEIGHT, data: [] } as never);
    }
  }
  return store;
}
function safeMenu(): unknown {
  try {
    return getFileMenu(getImagesDir());
  } catch {
    return [];
  }
}

// Stream one page route with renderToPipeableStream, TRUE shell-first:
//   - chunks written BEFORE the shell settles are buffered;
//   - onShellReady flushes the HTTP head + docHead + the buffered shell so
//     the page shell (header/nav + section frames + Suspense fallbacks)
//     reaches the browser first (real TTFB);
//   - data chunks that resolve the Suspense boundary forward LIVE;
//   - final appends the tail, caches the assembled document (ISR), ends.
// If no boundary suspends (all routes render synchronously) this degrades to
// head+body+tail in one pass - identical to the buffered path, just ordered.
function renderPageStream(
  sock: net.Socket,
  reqId: number,
  key: string,
  pathname: string,
  query: string,
  queryMap: Record<string, string>
): Promise<void> {
  const store = buildStore(pathname, queryMap);
  const location = pathname + (query ? "?" + query : "");
  const sections: string[] = []; // every body chunk, in order (for the cache)
  const pending: string[] = []; // shell chunks received before head flushed
  let headFlushed = false;
  let settled = false;
  let capturedHelmet: ReturnType<typeof Helmet.renderStatic> | null = null;

  // HTTP response head, streamed WITHOUT Content-Length (it is a stream).
  const httpHead =
    "HTTP/1.1 200 OK\r\n" +
    "Content-Type: text/html; charset=utf-8\r\n" +
    "Date: " + new Date().toUTCString() + "\r\n" +
    "X-Content-Type-Options: nosniff\r\n" +
    CSP_HEADER +
    "Cache-Control: no-store\r\n" +
    "X-Frame-Options: DENY\r\n" +
    "X-ISR: miss\r\n" +
    "Connection: close\r\n\r\n";

  const flushBody = (c: string): void => sendStreamChunk(sock, reqId, c);

  return new Promise<void>((resolve) => {
    const sink = new Writable({
      write(chunk: Buffer | string, _enc: string, cb: () => void) {
        const c = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        sections.push(c);
        if (!headFlushed) pending.push(c); // buffer shell, flush on shellReady
        else flushBody(c); // live data chunk
        cb();
      },
      final(cb: () => void) {
        if (!settled) {
          settled = true;
          const helmet = capturedHelmet ?? Helmet.renderStatic();
          const tail = docTail(store.getState());
          const head = docHead(helmet);
          // Cache the assembled document. If head was already flushed live,
          // the cache holds only the body + tail for the hit path to re-emit
          // with a Content-Length; the miss path has already streamed it.
          cacheSet(key, head + sections.join("") + tail);
          if (!headFlushed) {
            // synchronous no-boundary document: flush head + body + tail now.
            flushBody(httpHead + head);
            for (const c of pending) flushBody(c);
          }
          flushBody(tail);
          sendRequestEnd(sock, reqId);
          resolve();
        }
        cb();
      },
    });
    const stream = renderToPipeableStream(
      <Provider store={store}>
        <Theme>
          <StaticRouter location={location}>
            <Routes>
              {routers.map((r) => (
                <Route key={r.key} path={r.path} element={r.element} />
              ))}
            </Routes>
          </StaticRouter>
        </Theme>
      </Provider>,
      {
        onShellReady() {
          if (settled || headFlushed) return;
          headFlushed = true;
          capturedHelmet = Helmet.renderStatic();
          // head + static CSS link + shell fallbacks, all at once.
          flushBody(httpHead + docHead(capturedHelmet));
          for (const c of pending) flushBody(c);
          pending.length = 0;
        },
        onShellError(err: unknown) {
          if (settled) return;
          settled = true;
          console.error("[ssr] render error", err);
          respondFull(
            sock,
            reqId,
            "HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/plain\r\n",
            "",
            "nsbp-lume SSR render error",
            "X-ISR: error\r\n"
          );
          resolve();
        },
      }
    );
    stream.pipe(sink);
  });
}

async function handleRequest(sock: net.Socket, reqId: number, params: Params, body: Buffer): Promise<void> {
  const rawUri = params.REQUEST_URI || "/";
  const qi = rawUri.indexOf("?");
  const pathname = qi >= 0 ? (rawUri.slice(0, qi) || "/") : rawUri;
  let query = params.QUERY_STRING || "";
  if (!query && qi >= 0) query = rawUri.slice(qi + 1);
  const queryMap = parseQuery(query);
  const method = (params.REQUEST_METHOD || "GET").toUpperCase();

  // ---- data routes (Lume relays these here because they are not reserved) --
  if (pathname === "/getPhotoMenu") {
    respondFull(
      sock,
      reqId,
      "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n",
      "",
      JSON.stringify({ data: safeMenu() }),
      "Cache-Control: no-store\r\n"
    );
    return;
  }
  if (pathname === "/getPhotoWH") {
    const dic = queryMap.dic || "";
    if (dic && !/^[a-zA-Z0-9_-]+$/.test(dic)) {
      respondFull(sock, reqId, "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n", "", JSON.stringify({ error: "Invalid directory name" }), "");
      return;
    }
    try {
      const r = getPhotoWH(dic);
      respondFull(
        sock,
        reqId,
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n",
        "",
        JSON.stringify({ data: r.data }),
        "Cache-Control: no-store\r\nX-PhotoWH: " + (r.cached ? "hit" : "miss") + "\r\n"
      );
    } catch (e) {
      respondFull(sock, reqId, "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n", "", JSON.stringify({ error: (e as Error).message }), "");
    }
    return;
  }
  if (pathname.startsWith("/images/")) {
    const rel = decodeURIComponent(pathname.slice("/images/".length));
    const img = readImage(rel);
    if (img) {
      respondFull(
        sock,
        reqId,
        "HTTP/1.1 200 OK\r\nContent-Type: " + img.type + "\r\n",
        "",
        img.buf,
        "Cache-Control: public, max-age=3600\r\n"
      );
    } else {
      respondFull(sock, reqId, "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n", "", "Not Found", "");
    }
    return;
  }

  // ---- static docroot assets (manifest / favicons) --------------------------
  // These are not Lume reserved prefixes, so react_prefix="/" relays them here
  // instead of the C static file handler. The Lume engine's SPA fallback would
  // otherwise hand out index.html (Content-Type text/html) for e.g.
  // /site.webmanifest and the browser reports "Manifest: Syntax error". Serve
  // them with their proper Content-Type instead.
  const asset = readStaticAsset(pathname);
  if (asset) {
    respondFull(
      sock,
      reqId,
      "HTTP/1.1 200 OK\r\nContent-Type: " + asset.type + "\r\n",
      "",
      asset.buf,
      "Cache-Control: public, max-age=3600\r\n"
    );
    return;
  }

  // ---- page routes: streaming SSR + ISR cache ------------------------------
  if (method !== "GET" && method !== "HEAD") {
    // Non-GET to a page path: no static mutation; answer 405 to keep the relay
    // contract clean (there is no write API in nsbp-lume).
    respondFull(sock, reqId, "HTTP/1.1 405 Method Not Allowed\r\nContent-Type: text/plain\r\n", "", "Method Not Allowed", "");
    return;
  }
  const key = cacheKey(pathname, query);
  const cached = cacheGet(key);
  if (cached !== null) {
    // HIT: buffered document + Content-Length, React skipped entirely.
    respondFull(
      sock,
      reqId,
      "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n",
      "",
      cached,
      "Cache-Control: no-store\r\nX-Frame-Options: DENY\r\n" + CSP_HEADER + "X-ISR: hit\r\n"
    );
    return;
  }
  // MISS: stream head+body+tail over FCGI; the assembled document is stored
  // for the ISR cache by renderPageStream.
  await renderPageStream(sock, reqId, key, pathname, query, queryMap);
}

function createServer(sockPath: string): net.Server {
  try {
    fs.unlinkSync(sockPath);
  } catch {
    /* stale socket */
  }
  fs.mkdirSync(path.dirname(sockPath), { recursive: true });

  const server = net.createServer((conn) => {
    const state: { reqId: number; params: Params; body: Buffer; done: boolean } = {
      reqId: 0,
      params: {},
      body: Buffer.alloc(0),
      done: false,
    };
    const parser = new FcgParser((frame) => {
      if (state.done) return;
      if (frame.type === BEGIN_REQUEST) state.reqId = frame.reqId;
      else if (frame.type === PARAMS && frame.content.length > 0) parseParamsFrame(frame.content, state.params);
      else if (frame.type === STDIN) {
        if (frame.content.length > 0) state.body = Buffer.concat([state.body, frame.content]);
        else {
          state.done = true;
          // The page-route path streams (async). Await it so every FCGI
          // frame (END_REQUEST included) is written before the socket closes.
          void (async () => {
            try {
              await handleRequest(conn, state.reqId, state.params, state.body);
            } catch (err) {
              console.error("[ssr] handler error", err);
              respondFull(conn, state.reqId, "HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/plain\r\n", "", "nsbp-lume SSR error", "");
            }
            conn.end();
          })();
        }
      }
    });
    conn.on("data", (chunk: Buffer) => parser.push(chunk));
    conn.on("error", () => conn.destroy());
  });

  server.listen(sockPath, () => {
    const sockMode = parseInt(process.env.NSBP_FCGI_SOCK_MODE || "0700", 8);
    try {
      fs.chmodSync(sockPath, sockMode);
    } catch {
      /* ignore */
    }
    console.log(`nsbp-lume React SSR backend on ${sockPath} (node ${process.version})`);
  });
  return server;
}

const sockPath = process.argv[2] || process.env.SSR_SOCK || "./.data/nsbp-ssr.sock";
const server = createServer(sockPath);
process.on("SIGINT", () => {
  server.close(() => {
    try {
      fs.unlinkSync(sockPath);
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
});

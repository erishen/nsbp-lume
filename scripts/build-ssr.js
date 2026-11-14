// Build the two sides of nsbp-lume's SSR chain:
//   1. Resident React SSR backend  -> build/server-ssr.cjs   (node, CJS)
//   2. Browser hydration bundle    -> public/js/client.mjs + client.css
//
// Both bundle the shared route tree (src/Routers.tsx) so the server markup and
// the client render agree.
//
// Styling: Tailwind pipeline. src/css/tailwind.css carries `@tailwind`
// directives + all the ported visuals (verbatim from the old
// styled-components). The CLIENT build extracts CSS with esbuild, then
// postcss (tailwindcss + autoprefixer, discovered from postcss.config.js)
// expands the directives into real utilities -> public/js/client.css. The
// NODE build still stubs out CSS imports (styles ship as static CSS, the
// server only links client.css in <head>).

import { build } from "esbuild";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import less from "less";

import { spawnSync } from "node:child_process";
import * as sass from "sass";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Resolve nsbp's path aliases (@containers, @components, @utils, ...) to src/.
const ALIASES = {
  "@": "src",
  "@components": "src/component",
  "@utils": "src/utils",
  "@services": "src/services",
  "@styled": "src/styled",
  "@store": "src/store",
  "@reducers": "src/reducers",
  "@containers": "src/containers",
  "@css": "src/css",
  "@externals": "src/externals",
};

// esbuild does not auto-guess extensions for a path returned by onResolve, so
// resolve file / directory-index ourselves (mirrors tsconfig "paths").
function resolveExt(base) {
  if (existsSync(base) && /\.[a-z]+$/i.test(base)) return base;
  for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const idx of ["index.tsx", "index.ts", "index.jsx", "index.js"]) {
    if (existsSync(join(base, idx))) return join(base, idx);
  }
  return base;
}

const pathAlias = {
  name: "path-alias",
  setup(b) {
    b.onResolve({ filter: /^@/ }, (args) => {
      const sorted = Object.keys(ALIASES).sort((a, c) => c.length - a.length);
      for (const key of sorted) {
        if (args.path === key || args.path.startsWith(key + "/")) {
          const rest = args.path === key ? "" : args.path.slice(key.length);
          return { path: resolveExt(join(root, ALIASES[key], rest)), external: false };
        }
      }
      return undefined;
    });
  },
};

// Compile Less/Sass to CSS so the client bundle carries real styles.
const preCss = {
  name: "preprocess-css",
  setup(b) {
    b.onResolve({ filter: /\.(less|sass|scss)$/ }, (args) => ({
      path: args.path.startsWith(".")
        ? new URL(args.path, "file://" + dirname(args.importer) + "/").pathname
        : args.path,
      namespace: "pre-css",
    }));
    b.onLoad({ filter: /\.(less|sass|scss)$/ }, async (args) => {
      const src = readFileSync(args.path, "utf8");
      const ext = extname(args.path);
      let css;
      if (ext === ".less") {
        css = (await less.render(src, { filename: args.path })).css;
      } else {
        // .scss -> "scss" syntax; .sass -> "indented" syntax (dart-sass).
        css = sass.compileString(src, {
          syntax: ext === ".sass" ? "indented" : "scss",
          filename: args.path,
        }).css;
      }
      return { contents: css, loader: "css", resolveDir: dirname(args.path) };
    });
  },
};

// Stub CSS/LESS/SASS/SCSS for the node bundle (styles ship as static CSS; the
// server only links /js/client.css in <head>). The client build does NOT use
// this - it extracts CSS + runs Tailwind.
const stubCss = {
  name: "stub-css",
  setup(b) {
    b.onResolve({ filter: /\.(css|less|sass|scss)$/ }, (args) => ({
      path: args.path,
      namespace: "stub-css",
    }));
    b.onLoad({ filter: /.*/, namespace: "stub-css" }, () => ({
      contents: "export default {}",
      loader: "js",
    }));
  },
};

// 1) SSR backend: node CJS, everything inlined.
await build({
  entryPoints: [join(root, "src/server-ssr/main.tsx")],
  outfile: join(root, "build/server-ssr.cjs"),
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  jsx: "automatic",
  sourcemap: false,
  plugins: [pathAlias, stubCss],
  define: { "process.env.NODE_ENV": '"production"' },
});
console.log("SSR backend built -> build/server-ssr.cjs");

// 2) Client hydration bundle: browser ESM + extracted CSS. esbuild writes
//    client.css next to client.mjs; because postcss + tailwindcss +
//    autoprefixer are resolvable, esbuild auto-runs postcss (postcss.config.js
//    loads tailwind + autoprefixer) to expand the @tailwind directives.
await build({
  entryPoints: [join(root, "src/client/index.tsx")],
  outfile: join(root, "public/js/client.mjs"),
  bundle: true,
  format: "esm",
  target: ["es2022", "chrome80", "safari14", "firefox90"],
  jsx: "automatic",
  sourcemap: true,
  legalComments: "inline",
  plugins: [pathAlias, preCss],
  // Minify the client bundle: esbuild's define turns process.env.NODE_ENV
  // into '"production"', and only minification's dead-code folding removes
  // the dev branches. React 19.3's checkDCE() self-check fires at runtime if
  // the production build still carries dev code, so minify is required,
  // not optional.
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
// 3) Tailwind: esbuild just extracted public/js/client.css verbatim (it carries
//    the "@tailwind base/components/utilities" directives + the Login demo css/
//    less/sass/scss). Expand those directives in-process with postcss +
//    tailwindcss (+ autoprefixer) so the browser gets real utilities/preflight
//    instead of the un-expanded directives. In-process avoids the .bin/PATH
//    node-wrapper hang. tailwind.config.js is auto-discovered from cwd.
const rawCss = readFileSync(join(root, "public/js/client.css"), "utf8");
const cssOut = await postcss([tailwindcss, autoprefixer]).process(rawCss, {
  from: join(root, "public/js/client.css"),
  to: join(root, "public/js/client.css.min.css"),
});
writeFileSync(join(root, "public/js/client.css"), cssOut.css);
console.log("client bundle built -> public/js/client.mjs (+ client.css, tailwind-expanded)");


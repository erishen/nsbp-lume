# nsbp-lume

> **English** | [简体中文](README.zh.md)

**React 服务端渲染(SSR)+ Lume 引擎**,对齐姊妹项目 `lume-crm`
的标准范式:`work/lume/lume` 里的 `examples/react-ssr.lume` 链路。

两个进程,`scripts/start.js` 编排:

1. **常驻 Node React SSR 后端**(`build/server-ssr.cjs`,监听 UNIX socket
   `./.data/nsbp-ssr.sock`)
   用 `react-dom/server` 的 `renderToPipeableStream(流式)` + `StaticRouter` + Redux Provider
   + react-helmet 把每个页面**真渲染成
   完整 HTML**(与 nsbp 的服务端同构),渲染前把 photo 数据预取进 store,注入
   `window.context` / `window.query` 供水合。它还亲自出照片数据端点
   `/getPhotoMenu`、`/getPhotoWH`、`/images/…`(fs + probe-image-size,
   对齐 nsbp 的 Express 处理函数)。
2. **Lume 引擎**(`$LUME nsbp.lume`,内嵌 AgentHTTPD,占有 HTTP 端口 `10090`)
   做三件事:
   - `react_socket` + `react_prefix = "/"` 把页面路由经 **FastCGI relay** 到
     Node 后端(`/`、`/photo?dic=…` 都出 SSR HTML,与 nsbp 真实 UI 一致;
     `/getPhotoMenu`、`/getPhotoWH`、`/images/*` 也 relay 给 Node 后端);
   - 以 `docroot=./public` 伺服静态资源(`/js/client.mjs` + `/js/client.css`、
     图片、favicon);`/js`、`/api`、`/assets` 是 Lume 保留前缀,relay 不吞;
   - 自己出 Lume 原生数据端点 `GET /api/health`(Lume DSL 路由,`/api` 是
     保留前缀,relay 不吞它,故稳留在 Lume 这边)。

> 注:`/login`、`/logout` 在 Lume 引擎 C 层被硬编码为**保留路径**
> (AgentHTTPD 自带 session 登录门),`react_prefix="/"` 时不归 React relay、
> 由引擎接管 —— 这是引擎行为,DSL 层改不掉。nsbp 的登录页因此无法经 relay
> 出 SSR;Home/Photo 两页与 nsbp 完全一致。

客户端拿到 SSR markup 后用 `BrowserRouter` + `hydrateRoot` 水合,交互接管。

> 模型澄清: Lume **不是**能 `import` 进 Node 的 JS 模块。本地 `work/lume/lume`
> 是 C 引擎,编译出 `lume` 二进制(AgentHTTPD);`lume-core` 那棵树甚至不带内嵌
> server。所以"用上 Lume"= 这个二进制当 HTTP 服务器 + DSL 数据路由,React SSR
> 后端经它 `react_socket` relay,而不是在 Node 里 `import "lume-core"`。

## 布局

- `nsbp.lume` — Lume 服务端:`server{ bind, port, react_socket, react_prefix="/", docroot=public, spa }`
  + `GET /api/health` Lume DSL 原生路由 + `run()`。
- `src/server-ssr/main.tsx` — 常驻 Node SSR 后端(FCGI socket 服务端 +
  `renderToPipeableStream`(shell 先行两相流式)+ `StaticRouter` + Provider + Helmet + 预取 store(样式已静态化:Tailwind 构建期出 `/js/client.css`,SSR 只 link,不再运行时收样式)。照片区是 **Suspense 数据边界**(`src/services/suspense.ts` 的 `use()` hooks):服务端挂起 → shell 先冲到浏览器、照片内容后流;客户端有预取态 → 同步值,水合不闪。测试用 `NSBP_SUSPENSE_DELAY_MS` 注入延迟可观察两相。
  数据端点 /getPhotoMenu /getPhotoWH /images/…)。**构建后**为 `build/server-ssr.cjs`。
- `src/server-data/photo.ts` — 照片库数据层(fs + probe-image-size,移植自 nsbp 的
  src/server/photo.ts,去 Express)。
- `src/client/index.tsx` — 浏览器水合入口(Theme + Redux Provider + BrowserRouter +
  `hydrateRoot`,读 `window.context`)。**构建后**为 `public/js/client.mjs` + `client.css`。
- `src/Routers.tsx` + `src/containers/`(Home/Login/Photo)+ `src/component/`(Header/Layout/Theme)
  + `src/styled/`(普通组件工厂 stx + Tailwind 类名,视觉在 `src/css/tailwind.css`)+ `src/store`/`src/reducers`/`src/services`/`src/utils`
  — 从 nsbp 原样移植的真实 UI(去掉 @loadable/axios)。
- `scripts/` — `clean.js` / `build-ssr.js`(esbuild 打后端 + 客户端)/
  `check-lume.js`(Lume 类型检查)/ `dev.js` / `start.js`(起后端再起 Lume)。
- `Makefile` — 本地 `check` / `build` / `run` / `dev` / `clean`,以及
  `docker-build` / `docker-up` / `docker-down`。
- `Dockerfile` + `docker/entrypoint.sh` + `docker/lume-linux-x64-static.tar.gz`
  — 多阶段镜像:node 打 SSR+客户端 → 取 static Lume 二进制 → alpine+nodejs 运行。
- `docker-compose.yml` — 一条命令起容器(默认 `127.0.0.1:10090`)。

## 本地运行

```
pnpm install      # 或 npm install(依赖:react/redux/helmet/framer-motion/probe-image-size;样式 Tailwind 3 + postcss + less/sass)
pnpm build        # esbuild → build/server-ssr.cjs + public/js/client.mjs + client.css
pnpm start        # 起 Node SSR 后端 + $LUME nsbp.lume → http://127.0.0.1:10090
# 或 pnpm dev:clean + build + start 一条龙
# 停:make stop(读 .data/start.pids;或直接 Ctrl-C 停 start.js)
```

`start.js` 解析 Lume 二进制:`LUME` 环境变量 → `~/.local/bin/lume`(release)→
相对项目 `../../../work/lume/lume/bin/lume`(源码树)。Node 后端默认用系统 `node`
(可 `NODE` 环境变量覆盖;桌面环境里 `~/.local/share/TeleAgent/runtimes/node/bin/node`)。
端口由 `PORT` 环境变量控制,默认 `10090`。

**自愈(防 502)**:`start.js` 启动时会先杀掉陈旧的 SSR 后端 / Lume 前端
(`pgrep -f server-ssr.cjs` / `lume nsbp.lume` + `kill -9`)、删掉残留 socket、
等 socket 真正就绪再拉 Lume 前端 —— 保证任意时刻只有一对干净的后端/前端,
避免「前端在、后端 socket 没了」导致的 502。杀不掉(无权限)或端口被占时,
退出提示会给出终端里手动清理的命令。

## Docker(端口 >10000)

镜像三阶段(见 `Dockerfile`):node 打 SSR/客户端 → 取 **static** Lume 二进制
(`docker/lume-linux-x64-static.tar.gz` 离线可用,否则按 `LUME_VERSION` 从 GitHub
拉取)→ alpine + `nodejs` apk 跑常驻 SSR 后端,Lume 在 `0.0.0.0:10090` 做前端
(`entrypoint.sh` 先起 node 后端等 socket,再起 Lume)。

```
# 构建(离线可构建:上下文自带 docker/lume-linux-x64-static.tar.gz)
make docker-build            # 或 docker build -t nsbp-lume .

# 起容器(宿主 127.0.0.1:10090 → 容器 :10090)
make docker-up               # 或 docker compose up -d
curl http://127.0.0.1:10090/api/health         # Lume DSL 原生数据端点
curl http://127.0.0.1:10090/getPhotoMenu        # Node 后端照片端点(fs+probe-image-size)
curl http://127.0.0.1:10090/                   # SSR HTML(#root 内有 React markup + window.context)

make docker-down             # 停并移除容器
```

宿主端口默认 `10090`(>10000),可用 `HOST_PORT` 覆盖:
`HOST_PORT=10090 make docker-up`。镜像默认绑 `127.0.0.1`;要放开给其它网卡,
把 `docker-compose.yml` 里 `127.0.0.1:${HOST_PORT:-10090}` 改成 `${HOST_PORT:-10090}`。

> 说明:本机未安装 docker,无法在此构建/运行;上述文件按可在 docker 宿主上
> 直接构建运行来写。Lume 需 `v0.8.0+`(支持 `react_prefix`),仓库离线 tarball
> 即满足。

## 已验证路由(真实 `nsbp.lume` 端到端)

- `GET /` — **SSR**(与 nsbp Home 一致):helmet title/meta + 静态 `/js/client.css`
  (Tailwind 构建期展开)在 head,`window.context` 携带预取的 photo 菜单,body 内为
  Layout 初始态,HTTP 200 `text/html`。
- `GET /photo?dic=test` — **SSR**(与 nsbp Photo 一致):helmet title=Photo +
  预取宽高数据(样式走静态 client.css)。
- `GET /getPhotoMenu` / `GET /getPhotoWH?dic=test` / `GET /images/test/0.jpg` —
  Node 后端数据端点(经 relay),返回 `{"data":[...]}` / 图片原始字节。
- `GET /api/health` — Lume DSL 原生路由,`{"ok":true,...}`,`application/json`。
- `GET /js/client.mjs` + `/js/client.css` — 静态 hydration bundle + 提取样式。
- `GET /login` — Lume 引擎 C 层保留路径(AgentHTTPD session 门),不由 React relay。


## `ssr` 参数(首屏呈现模式; 旧 `nsbp` 兼容)

| URL | 行为 |
|---|---|
| 省略 / `?ssr=1` | **SSR 默认**:首屏直接展示服务端渲染好的内容(不闪 Loading) |
| `?ssr=0` | 显式**动画/客户端数据模式**:先播 `Loading` 再展开;Photo 页在客户端重新取数 |
| 旧 `?nsbp=0` / `?nsbp=1` | **仍可读**(读取时 `ssr` 优先、回退 `nsbp`);新链接一律写 `ssr=` |

> 参数规范名已从 `nsbp` 改为语义更直白的 `ssr`;旧项目分享出的 `nsbp=` 链接不失效
> (`utils/index.ts` 的 `getSSRParam()` 做 `ssr`→`nsbp` 回退,生成新链接写 `ssr=`)。
> 页面文档始终是 Node SSR 渲染的(`ssr=0` 也不会变 CSR 文档);"纯 CSR"只发生在
> 后端未起、直接打开静态兜底页的退化情形。Suspense 照片数据边界与该参数正交。

## License

[MIT](LICENSE)

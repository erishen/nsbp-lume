# nsbp-lume — React SSR on the Lume engine (AgentHTTPD front + FastCGI relay)
#
#   make             检查 + 构建 + 起服务(阻塞,Ctrl-C 停)→ :10090
#   make check       Lume DSL 类型检查 + tsc 前端类型检查
#   make build       打 SSR 后端 + 客户端 bundle(esbuild)
#   make run         起 Node SSR 后端 + $LUME nsbp.lume(阻塞,start.js 自愈)
#   make stop        停 make run 起的实例(读 .data/start.pids)
#   make docker-build 打 Docker 镜像(含离线 static Lume tarball)
#   make docker-up    后台起容器(127.0.0.1:10090 → 容器 :10090)
#   make docker-down  停并移除容器
#   make clean        清构建产物与运行时数据
#
# 依赖: node(任意 >= 18) + 源码树里的 Lume 二进制($LUME)。
# 本桌面环境里 node 被 wrapper 挡,真实二进制在 ~/.local/share/TeleAgent/runtimes/node/bin/node。
# Docker 目标需要宿主机有 docker; 离线构建靠 docker/lume-linux-<arch>-static.tar.gz。

NODE      ?= $(HOME)/.local/share/TeleAgent/runtimes/node/bin/node
LUME      ?= ../../../work/lume/lume/bin/lume
PORT      ?= 10090
SSR_SOCK  ?= .data/nsbp-ssr.sock

# 优先项目内源码树的 lume;找不到就回退 ~/.local/bin/lume。
ifeq ($(wildcard $(LUME)),)
  LUME := $(HOME)/.local/bin/lume
endif
# 真实 node 二进制(桌面环境 wrapper 会卡在 hermit setup)。
ifeq ($(wildcard $(NODE)),)
  NODE := node
endif

default: check build run

# ------------------------------------------------ check: Lume + 前端类型
check:
	@echo "==> Lume --check nsbp.lume"; \
	$(LUME) --check nsbp.lume
	@echo "==> tsc --noEmit"; \
	$(NODE) ./node_modules/typescript/bin/tsc --noEmit

# ------------------------------------------------ build: 打前后端 bundle
build:
	@echo "==> esbuild build (server-ssr + client)"; \
	$(NODE) scripts/build-ssr.js

# ------------------------------------------------ run: 起后端再起 Lume 前端(阻塞)
# start.js 负责自愈: 杀陈旧后端/前端 + 清陈旧 socket + 等 socket 就绪再起 Lume。
run:
	@echo "==> start.js (self-heal + backend + Lume front, http://127.0.0.1:$(PORT))"; \
	PORT=$(PORT) $(NODE) scripts/start.js

# ------------------------------------------------ dev: build + run(简写)
dev: build run

# ------------------------------------------------ stop: 停 start.js 起的前后端(读 .data/start.pids)
stop:
	@if [ -f .data/start.pids ]; then \
	  xargs kill 2>/dev/null < .data/start.pids || true; \
	  sleep 0.5; xargs kill -9 2>/dev/null < .data/start.pids || true; \
	  rm -f .data/start.pids; \
	else \
	  echo "no .data/start.pids — nothing managed to stop"; \
	fi; \
	pkill -f 'server-ssr.cjs' 2>/dev/null; pkill -f 'lume nsbp.lume' 2>/dev/null; \
	rm -f $(SSR_SOCK); echo "stopped"

# ------------------------------------------------ docker: 镜像 + 容器
# 离线可构建: 上下文里带 docker/lume-linux-<arch>-static.tar.gz(已入仓)。
docker-build:
	@docker build -t nsbp-lume:latest .

docker-up:
	@docker compose up -d
	@echo "==> nsbp-lume running on http://127.0.0.1:$(PORT)"

docker-down:
	@docker compose down

# ------------------------------------------------ clean
clean:
	@echo "==> clean"; \
	rm -rf build public/js .data logs cgi-bin; \
	echo "cleaned"

.PHONY: default check build run stop dev docker-build docker-up docker-down clean

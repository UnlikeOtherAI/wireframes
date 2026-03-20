SHELL := /bin/zsh

WORKDIR := /System/Volumes/Data/.internal/projects/Projects/wireframes
API_HOST ?= 127.0.0.1
API_PORT ?= 3000
ADMIN_HOST ?= 127.0.0.1
ADMIN_PORT ?= 5173
ADMIN_URL := http://$(ADMIN_HOST):$(ADMIN_PORT)/login
OPEN_BROWSER ?= 1
RUN_DIR := $(WORKDIR)/.run
API_PID_FILE := $(RUN_DIR)/api.pid
ADMIN_PID_FILE := $(RUN_DIR)/admin.pid
API_LOG_FILE := $(RUN_DIR)/api.log
ADMIN_LOG_FILE := $(RUN_DIR)/admin.log
API_LAUNCHER := $(WORKDIR)/scripts/launch-api.sh
ADMIN_LAUNCHER := $(WORKDIR)/scripts/launch-admin.sh
API_SESSION := wireframes-api
ADMIN_SESSION := wireframes-admin

.PHONY: launch stop

launch:
	@mkdir -p $(RUN_DIR)
	@$(MAKE) stop >/dev/null
	@cd '$(WORKDIR)' && set -a && source .env && set +a && pnpm --dir api run db:migrate >/dev/null
	@chmod +x '$(API_LAUNCHER)' '$(ADMIN_LAUNCHER)'
	@tmux new-session -d -s '$(API_SESSION)' "cd '$(WORKDIR)' && exec '$(API_LAUNCHER)' > '$(API_LOG_FILE)' 2>&1"
	@tmux new-session -d -s '$(ADMIN_SESSION)' "cd '$(WORKDIR)' && ADMIN_HOST='$(ADMIN_HOST)' ADMIN_PORT='$(ADMIN_PORT)' exec '$(ADMIN_LAUNCHER)' > '$(ADMIN_LOG_FILE)' 2>&1"
	@for i in $$(seq 1 60); do curl -sf http://$(API_HOST):$(API_PORT)/health >/dev/null 2>&1 && break; sleep 1; done
	@for i in $$(seq 1 60); do curl -sf http://$(ADMIN_HOST):$(ADMIN_PORT)/login >/dev/null 2>&1 && break; sleep 1; done
	@lsof -tiTCP:$(API_PORT) -sTCP:LISTEN | head -n 1 >'$(API_PID_FILE)'
	@lsof -tiTCP:$(ADMIN_PORT) -sTCP:LISTEN | head -n 1 >'$(ADMIN_PID_FILE)'
	@if [ "$(OPEN_BROWSER)" = "1" ]; then open $(ADMIN_URL); fi
	@printf "API running in background (pid %s)\n" "$$(cat '$(API_PID_FILE)' 2>/dev/null || echo '?')"
	@printf "Admin running in background (pid %s)\n" "$$(cat '$(ADMIN_PID_FILE)' 2>/dev/null || echo '?')"
	@printf "Logs: %s %s\n" "$(API_LOG_FILE)" "$(ADMIN_LOG_FILE)"
	@printf "Browser %s at %s\n" "$$( [ "$(OPEN_BROWSER)" = "1" ] && printf opened || printf skipped )" "$(ADMIN_URL)"

stop:
	@tmux has-session -t '$(API_SESSION)' >/dev/null 2>&1 && tmux kill-session -t '$(API_SESSION)' >/dev/null 2>&1 || true
	@tmux has-session -t '$(ADMIN_SESSION)' >/dev/null 2>&1 && tmux kill-session -t '$(ADMIN_SESSION)' >/dev/null 2>&1 || true
	@if [ -f '$(API_PID_FILE)' ]; then kill "$$(cat '$(API_PID_FILE)')" >/dev/null 2>&1 || true; rm -f '$(API_PID_FILE)'; fi
	@if [ -f '$(ADMIN_PID_FILE)' ]; then kill "$$(cat '$(ADMIN_PID_FILE)')" >/dev/null 2>&1 || true; rm -f '$(ADMIN_PID_FILE)'; fi
	@lsof -tiTCP:$(API_PORT) -sTCP:LISTEN | xargs kill >/dev/null 2>&1 || true
	@lsof -tiTCP:$(ADMIN_PORT) -sTCP:LISTEN | xargs kill >/dev/null 2>&1 || true
	@pkill -f "bun run src/index.ts" >/dev/null 2>&1 || true
	@pkill -f "vite --host $(ADMIN_HOST) --port $(ADMIN_PORT)" >/dev/null 2>&1 || true

#!/bin/bash
# 监控并自动重启前后端服务

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_ROOT"

mkdir -p logs

BACKEND_PORT=8213
FRONTEND_PORT=3001
BACKEND_HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/health"
FRONTEND_HEALTH_URL="http://127.0.0.1:${FRONTEND_PORT}/"
LOCK_FILE="$PROJECT_ROOT/logs/monitor.lock"
STARTUP_GRACE_SECONDS=15
BACKEND_STARTUP_TIMEOUT=600
FRONTEND_STARTUP_TIMEOUT=60
MONITOR_INITIALIZED=0
PYTHON_BIN="${PYTHON_BIN:-}"
NPM_BIN="${NPM_BIN:-}"

resolve_backend_python() {
    local candidates=()
    local candidate=""

    if [[ -n "$PYTHON_BIN" ]]; then
        candidates+=("$PYTHON_BIN")
    fi
    if [[ -n "${CONDA_PREFIX:-}" ]]; then
        candidates+=("${CONDA_PREFIX}/bin/python")
    fi
    candidates+=("/root/miniconda3/envs/szl-dev/bin/python")

    candidate="$(command -v python 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
        candidates+=("$candidate")
    fi

    candidate="$(command -v python3 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
        candidates+=("$candidate")
    fi

    for candidate in "${candidates[@]}"; do
        [[ -n "$candidate" && -x "$candidate" ]] || continue
        if "$candidate" -c "import mineru_vl_utils" >/dev/null 2>&1; then
            echo "$candidate"
            return 0
        fi
    done

    candidate="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
        echo "$candidate"
        return 0
    fi

    return 1
}

if [[ -z "$PYTHON_BIN" ]]; then
    PYTHON_BIN="$(resolve_backend_python)" || {
        echo "[$(date)] No usable Python interpreter found for backend restart." >> logs/monitor.log
        exit 1
    }
fi

if [[ -z "$NPM_BIN" ]]; then
    NPM_BIN="$(command -v npm 2>/dev/null || true)"
fi
if [[ -z "$NPM_BIN" ]]; then
    echo "[$(date)] No npm binary found for frontend restart." >> logs/monitor.log
    exit 1
fi

BACKEND_BIN_DIR="$(dirname "$PYTHON_BIN")"

# 防止多个 monitor 实例同时运行，造成重复重启。
if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK_FILE"
    if ! flock -n 9; then
        echo "[$(date)] Another monitor instance is already running, exiting." >> logs/monitor.log
        exit 0
    fi
fi

log() {
    echo "[$(date)] $1" >> logs/monitor.log
}

is_port_listening() {
    local port="$1"
    lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

find_backend_pid() {
    pgrep -f "uvicorn fastapi_app.main:app.*--port ${BACKEND_PORT}" | head -n 1
}

find_frontend_pid() {
    pgrep -f "vite.*--port ${FRONTEND_PORT}" | head -n 1
}

process_age_seconds() {
    local pid="$1"
    ps -o etimes= -p "$pid" 2>/dev/null | awk '{print $1}'
}

http_ok() {
    local url="$1"
    curl --max-time 5 -fsS -o /dev/null "$url"
}

restart_backend() {
    log "Backend unhealthy, restarting..."
    lsof -ti:"$BACKEND_PORT" | xargs kill -9 2>/dev/null || true
    pkill -9 -f "uvicorn fastapi_app.main:app" 2>/dev/null || true
    sleep 2
    nohup env PATH="$BACKEND_BIN_DIR:$PATH" "$PYTHON_BIN" -m uvicorn fastapi_app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" >> logs/backend.log 2>&1 &
    log "Backend restarted with PID $!"
}

restart_frontend() {
    log "Frontend unhealthy, restarting..."
    lsof -ti:"$FRONTEND_PORT" | xargs kill -9 2>/dev/null || true
    pkill -9 -f "vite.*--port ${FRONTEND_PORT}" 2>/dev/null || true
    pkill -9 -f "npm run dev -- --port ${FRONTEND_PORT}" 2>/dev/null || true
    sleep 2
    (
        cd "$PROJECT_ROOT/frontend_zh" || exit 1
        nohup "$NPM_BIN" run dev -- --port "$FRONTEND_PORT" --host 0.0.0.0 >> "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
        echo $! > "$PROJECT_ROOT/logs/frontend.pid"
    )
    if [[ -f "$PROJECT_ROOT/logs/frontend.pid" ]]; then
        log "Frontend restarted with PID $(cat "$PROJECT_ROOT/logs/frontend.pid")"
        rm -f "$PROJECT_ROOT/logs/frontend.pid"
    else
        log "Frontend restart command issued"
    fi
}

while true; do
    local_backend_pid=""
    local_frontend_pid=""
    local_backend_age=""
    local_frontend_age=""

    if [[ "$MONITOR_INITIALIZED" -eq 0 ]]; then
        log "Monitor started, waiting ${STARTUP_GRACE_SECONDS}s before first health check."
        sleep "$STARTUP_GRACE_SECONDS"
        MONITOR_INITIALIZED=1
    fi

    if is_port_listening "$BACKEND_PORT" && http_ok "$BACKEND_HEALTH_URL"; then
        :
    else
        local_backend_pid="$(find_backend_pid || true)"
        if [[ -n "$local_backend_pid" ]]; then
            local_backend_age="$(process_age_seconds "$local_backend_pid")"
        fi

        if [[ -n "$local_backend_pid" && -n "$local_backend_age" && "$local_backend_age" -lt "$BACKEND_STARTUP_TIMEOUT" ]]; then
            log "Backend still starting (PID ${local_backend_pid}, age ${local_backend_age}s), skip restart."
        else
            restart_backend
        fi
    fi

    if is_port_listening "$FRONTEND_PORT" && http_ok "$FRONTEND_HEALTH_URL"; then
        :
    else
        local_frontend_pid="$(find_frontend_pid || true)"
        if [[ -n "$local_frontend_pid" ]]; then
            local_frontend_age="$(process_age_seconds "$local_frontend_pid")"
        fi

        if [[ -n "$local_frontend_pid" && -n "$local_frontend_age" && "$local_frontend_age" -lt "$FRONTEND_STARTUP_TIMEOUT" ]]; then
            log "Frontend still starting (PID ${local_frontend_pid}, age ${local_frontend_age}s), skip restart."
        else
            restart_frontend
        fi
    fi

    sleep 30
done

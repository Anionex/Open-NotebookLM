#!/bin/bash
# ThinkFlow - cpolar 守护脚本
#
# 用途：
# 1. 将本地 3001 端口通过 cpolar thinkflow 隧道暴露为 https://thinkflow.nas.cpolar.cn
# 2. 以守护模式后台运行，持续监控 cpolar 进程
# 3. cpolar 子进程异常退出后自动重启
#
# 说明：
# - 本脚本可以忽略常规 TERM/INT/HUP/QUIT 信号，并在子进程退出后重拉。
# - 但任何 Bash 脚本都无法抵抗 `kill -9`（SIGKILL）。如果守护进程自身被 SIGKILL，仍然会退出。
# - 如需彻底的“不可杀”，应使用 systemd / supervisord / 容器编排器等外部守护器。

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
RUN_DIR="${PROJECT_ROOT}/logs"
PID_FILE="${RUN_DIR}/cpolar_guard.pid"
LOCK_FILE="${RUN_DIR}/cpolar_guard.lock"
SUPERVISOR_LOG="${LOG_DIR}/cpolar_guard.log"
CPOLAR_STDOUT_LOG="${LOG_DIR}/cpolar_thinkflow.log"
CPOLAR_ACCESS_LOG="${LOG_DIR}/cpolar_access.log"
CPOLAR_BIN="${CPOLAR_BIN:-$(command -v cpolar 2>/dev/null || true)}"
CPOLAR_CONFIG="${CPOLAR_CONFIG:-/usr/local/etc/cpolar/cpolar.yml}"
CPOLAR_TUNNEL_NAME="${CPOLAR_TUNNEL_NAME:-thinkflow}"
LOCAL_PORT="${LOCAL_PORT:-3001}"
PUBLIC_URL="${PUBLIC_URL:-https://thinkflow.nas.cpolar.cn}"
RESTART_DELAY_SECONDS="${RESTART_DELAY_SECONDS:-3}"
STARTUP_GRACE_SECONDS="${STARTUP_GRACE_SECONDS:-2}"

mkdir -p "$LOG_DIR" "$RUN_DIR"

timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

log() {
    echo "[$(timestamp)] $*" | tee -a "$SUPERVISOR_LOG" >/dev/null
}

die() {
    log "ERROR: $*"
    exit 1
}

ensure_requirements() {
    [[ -n "$CPOLAR_BIN" ]] || die "找不到 cpolar 可执行文件，请确认已安装 /usr/local/bin/cpolar"
    [[ -x "$CPOLAR_BIN" ]] || die "cpolar 不可执行: $CPOLAR_BIN"
    [[ -f "$CPOLAR_CONFIG" ]] || die "找不到 cpolar 配置文件: $CPOLAR_CONFIG"
}

ensure_tunnel_config() {
    if ! grep -qE "^[[:space:]]*${CPOLAR_TUNNEL_NAME}:[[:space:]]*$" "$CPOLAR_CONFIG"; then
        die "cpolar 配置中未找到隧道 ${CPOLAR_TUNNEL_NAME}，请先配置 ${CPOLAR_CONFIG}"
    fi
}

is_pid_running() {
    local pid="${1:-}"
    [[ -n "$pid" ]] || return 1
    kill -0 "$pid" 2>/dev/null
}

read_pid() {
    if [[ -f "$PID_FILE" ]]; then
        tr -d '[:space:]' < "$PID_FILE"
    fi
}

find_cpolar_children() {
    local supervisor_pid="${1:-}"
    if [[ -n "$supervisor_pid" ]] && is_pid_running "$supervisor_pid"; then
        pgrep -P "$supervisor_pid" || true
    fi
}

find_cpolar_master_pids() {
    pgrep -f "cpolar: master process" || true
}

dashboard_reports_tunnel() {
    curl -fsSkI --max-time 5 "$PUBLIC_URL" >/dev/null 2>&1
}

cleanup_child_processes() {
    local supervisor_pid pids
    supervisor_pid="$(read_pid)"
    pids="$(find_cpolar_children "$supervisor_pid")"

    if [[ -n "$pids" ]]; then
        while IFS= read -r pid; do
            [[ -n "$pid" ]] || continue
            kill -9 "$pid" 2>/dev/null || true
        done <<< "$pids"
        return 0
    fi

    # 兜底清理：若 supervisor 已经挂了，但公网地址仍可达，清理遗留 master 进程。
    if ! is_pid_running "$supervisor_pid" && dashboard_reports_tunnel; then
        pids="$(find_cpolar_master_pids)"
        if [[ -n "$pids" ]]; then
            while IFS= read -r pid; do
                [[ -n "$pid" ]] || continue
                kill -9 "$pid" 2>/dev/null || true
            done <<< "$pids"
        fi
    fi
}

status_cmd() {
    local pid cpolar_pids
    pid="$(read_pid)"

    cpolar_pids="$(find_cpolar_children "$pid")"
    if [[ -z "$cpolar_pids" ]]; then
        cpolar_pids="$(find_cpolar_master_pids)"
    fi

    if is_pid_running "$pid"; then
        echo "cpolar guard 正在运行"
        echo "  supervisor pid: $pid"
        echo "  public url:     $PUBLIC_URL"
        echo "  local port:     $LOCAL_PORT"
        echo "  cpolar tunnel:  $CPOLAR_TUNNEL_NAME"
        echo "  log:            $SUPERVISOR_LOG"
        echo "  cpolar log:     $CPOLAR_STDOUT_LOG"
        if [[ -n "$cpolar_pids" ]]; then
            echo "  cpolar pid(s):  $(echo "$cpolar_pids" | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
        else
            echo "  cpolar pid(s):  未检测到，可能仍在启动中"
        fi
        if dashboard_reports_tunnel; then
            echo "  public check:   reachable"
        else
            echo "  public check:   warming up / unavailable"
        fi
        return 0
    fi

    if [[ -n "$cpolar_pids" ]]; then
        echo "cpolar guard 未运行，但检测到遗留 cpolar 进程"
        echo "  cpolar pid(s):  $(echo "$cpolar_pids" | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
        echo "  public url:     $PUBLIC_URL"
        return 1
    fi

    echo "cpolar guard 未运行"
    return 1
}

stop_cmd() {
    local pid
    pid="$(read_pid)"

    cleanup_child_processes

    if is_pid_running "$pid"; then
        echo "停止 cpolar guard (PID=$pid)"
        kill -9 "$pid" 2>/dev/null || true
    else
        echo "cpolar guard 未运行"
    fi

    rm -f "$PID_FILE" "$LOCK_FILE"
}

daemonize() {
    ensure_requirements
    ensure_tunnel_config

    local existing_pid
    existing_pid="$(read_pid)"
    if is_pid_running "$existing_pid"; then
        echo "cpolar guard 已在运行 (PID=$existing_pid)"
        exit 0
    fi

    cleanup_child_processes

    echo "启动 cpolar guard..."
    nohup setsid bash "$0" run >> "$SUPERVISOR_LOG" 2>&1 < /dev/null &
    disown || true
    sleep 3
    status_cmd || die "cpolar guard 启动失败，请查看日志: $SUPERVISOR_LOG"
}

run_guard() {
    ensure_requirements
    ensure_tunnel_config

    if command -v flock >/dev/null 2>&1; then
        exec 9>"$LOCK_FILE"
        flock -n 9 || die "cpolar guard 已在运行"
    fi

    echo "$$" > "$PID_FILE"

    # 守护进程忽略常规退出信号；需要停止时请使用 `bash scripts/cpolar_guard.sh stop`
    trap '' TERM INT HUP QUIT

    log "cpolar guard started: pid=$$ tunnel=${CPOLAR_TUNNEL_NAME} local_port=${LOCAL_PORT} public_url=${PUBLIC_URL}"
    log "cpolar config: $CPOLAR_CONFIG"
    : > "$CPOLAR_STDOUT_LOG"
    : > "$CPOLAR_ACCESS_LOG"

    sleep "$STARTUP_GRACE_SECONDS"

    while true; do
        log "starting cpolar tunnel '${CPOLAR_TUNNEL_NAME}' -> localhost:${LOCAL_PORT}"
        "$CPOLAR_BIN" start "$CPOLAR_TUNNEL_NAME" --log="$CPOLAR_ACCESS_LOG" >> "$CPOLAR_STDOUT_LOG" 2>&1 &
        child_pid=$!
        log "cpolar child started: pid=$child_pid"

        # 等待子进程退出。若被人 kill 掉，将自动重启。
        wait "$child_pid"
        exit_code=$?
        log "cpolar child exited: pid=$child_pid code=$exit_code"

        sleep "$RESTART_DELAY_SECONDS"
    done
}

case "${1:-start}" in
    start)
        daemonize
        ;;
    run)
        run_guard
        ;;
    stop)
        stop_cmd
        ;;
    status)
        status_cmd
        ;;
    restart)
        stop_cmd
        sleep 1
        daemonize
        ;;
    *)
        echo "用法: $0 {start|run|stop|status|restart}"
        exit 1
        ;;
esac

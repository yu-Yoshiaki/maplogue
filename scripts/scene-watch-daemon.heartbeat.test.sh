#!/usr/bin/env bash
# scene-watch-daemon: バッチ中 heartbeat 継続更新と子プロセス終了の局所テスト

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/scene-watch-heartbeat.XXXXXX")"
cleanup_tmp() { rm -rf "$TMP"; }
trap cleanup_tmp EXIT

# daemon を source（main は実行されない）
# shellcheck disable=SC1091
source "$ROOT/scripts/scene-watch-daemon.sh"

DATA_DIR="$TMP"
STATUS_FILE="$TMP/scene-watch-status.json"
STATUS_TMP="$TMP/.scene-watch-status.json.tmp"
LOG_FILE="$TMP/daemon.log"
POLL_SECONDS=1
BATCH_STARTED_AT="2026-07-19T12:00:00Z"
BATCH_SUCCEEDED_AT=""
BATCH_FAILED_AT=""
BATCH_WORKSPACE_IDS_JSON='["default"]'
WORKER_PID=""

read_heartbeat() {
  node --input-type=module - "$STATUS_FILE" <<'NODE'
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
process.stdout.write(String(raw.heartbeatAt ?? ''));
NODE
}

assert() {
  local cond="$1"
  local msg="$2"
  if ! eval "$cond"; then
    printf 'FAIL: %s\n' "$msg" >&2
    exit 1
  fi
}

# --- 1) 長時間 worker 中に heartbeat が複数回更新される ---
# await は同一シェルで実行（子 process の wait のため）。heartbeat は並列サンプラで確認。
BATCH_STARTED_AT="$(iso_now)"
sleep 3.2 &
worker_pid=$!
(
  sleep 1.1
  read_heartbeat >"$TMP/hb1"
  sleep 1.1
  read_heartbeat >"$TMP/hb2"
) &
sampler_pid=$!
await_worker_with_heartbeat "$worker_pid" || true
wait "$sampler_pid" || true
hb1="$(cat "$TMP/hb1")"
hb2="$(cat "$TMP/hb2")"
assert '[[ -n "$hb1" && -n "$hb2" && "$hb1" != "$hb2" ]]' \
  "heartbeat should advance during batch (hb1=$hb1 hb2=$hb2)"

# --- 2) 終了コード 0 → 成功時刻、非0 → 失敗時刻 ---
BATCH_SUCCEEDED_AT=""
BATCH_FAILED_AT=""
bash -c 'exit 0' &
worker_pid=$!
code=0
await_worker_with_heartbeat "$worker_pid" || code=$?
record_batch_result "$code"
assert '[[ "$code" -eq 0 && -n "$BATCH_SUCCEEDED_AT" && -z "$BATCH_FAILED_AT" ]]' \
  'exit 0 should record success only'

BATCH_SUCCEEDED_AT=""
BATCH_FAILED_AT=""
bash -c 'exit 7' &
worker_pid=$!
code=0
await_worker_with_heartbeat "$worker_pid" || code=$?
record_batch_result "$code"
assert '[[ "$code" -eq 7 && -n "$BATCH_FAILED_AT" ]]' \
  'exit 7 should record failure'

# --- 3) stop_worker で子を孤児化せず終了 ---
# job control の "Terminated" 表示を抑える
set +m 2>/dev/null || true
sleep 30 &
WORKER_PID=$!
child="$WORKER_PID"
assert 'kill -0 "$child" 2>/dev/null' 'child should be running before stop'
stop_worker
assert '! kill -0 "$child" 2>/dev/null' 'stop_worker should terminate child'
assert '[[ -z "${WORKER_PID:-}" ]]' 'WORKER_PID should be cleared'

printf 'ok scene-watch-daemon heartbeat/batch tests\n'

#!/usr/bin/env bash
set -Eeuo pipefail

API="http://localhost:3010/api"
URL_A="http://localhost:5433"
URL_B="http://localhost:5010"
LABEL_A="Monolith"
LABEL_B="Shell-MFE"
REPEATS=10
OUT_DIR="/Users/enderwar/Documents/Programming/itmo/nir3/scripts/out"
mkdir -p "$OUT_DIR"

POLL_INTERVAL=2
MAX_POLL=600

E2E_SCENARIO=$(cat <<'EOF'
{
  "name": "Pizza order",
  "url": "URL_PLACEHOLDER",
  "steps": [
    {"action":"type","selector":"input[name=\"pizza_name\"]","value":"my pizza","label":"Name"},
    {"action":"click","selector":"div[class*=\"result\"] button","label":"Cook"},
    {"action":"wait","value":500,"label":"Wait"},
    {"action":"type","selector":"input[name=\"street\"]","value":"Lenina","label":"Street"},
    {"action":"type","selector":"input[name=\"house\"]","value":"43","label":"House"},
    {"action":"type","selector":"input[name=\"tel\"]","value":"+79141234567","label":"Phone"},
    {"action":"click","selector":"button[type=\"submit\"]","label":"Submit"},
    {"action":"wait","value":1000,"label":"Wait response"}
  ]
}
EOF
)

ts() { date '+%H:%M:%S'; }
log() { echo "[$(ts)] $*"; }

poll_task() {
  local task_id="$1"
  local i
  for ((i=0; i<MAX_POLL; i++)); do
    local resp status
    resp=$(curl -s "$API/metrics/task/$task_id")
    status=$(echo "$resp" | jq -r '.status')
    if [[ "$status" == "done" ]]; then
      echo "$resp" | jq -c '.result'
      return 0
    fi
    if [[ "$status" == "error" ]]; then
      echo "ERROR: $(echo "$resp" | jq -r '.error')" >&2
      return 1
    fi
    sleep "$POLL_INTERVAL"
  done
  echo "ERROR: poll timeout" >&2
  return 1
}

collect_metrics() {
  local url="$1"
  local task_id
  task_id=$(curl -s -X POST "$API/metrics/collect" \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"$url\"}" | jq -r '.taskId')
  poll_task "$task_id"
}

run_e2e() {
  local url="$1"
  local scenario task_id
  scenario=${E2E_SCENARIO//URL_PLACEHOLDER/$url}
  task_id=$(curl -s -X POST "$API/metrics/e2e" \
    -H 'Content-Type: application/json' \
    -d "$scenario" | jq -r '.taskId')
  poll_task "$task_id"
}

log "=== Comparison: $LABEL_A vs $LABEL_B ==="
log "URL A: $URL_A"
log "URL B: $URL_B"
log "Repeats: $REPEATS, interleaved, no cold-run"
log ""

log "Warmup $LABEL_A..."
collect_metrics "$URL_A" > /dev/null
log "Warmup $LABEL_B..."
collect_metrics "$URL_B" > /dev/null

> "$OUT_DIR/runs_a.jsonl"
> "$OUT_DIR/runs_b.jsonl"
> "$OUT_DIR/e2e_a.jsonl"
> "$OUT_DIR/e2e_b.jsonl"

for i in $(seq 1 $REPEATS); do
  log "[$i/$REPEATS] $LABEL_A metrics..."
  collect_metrics "$URL_A" >> "$OUT_DIR/runs_a.jsonl"
  log "[$i/$REPEATS] $LABEL_A e2e..."
  run_e2e "$URL_A" >> "$OUT_DIR/e2e_a.jsonl"

  log "[$i/$REPEATS] $LABEL_B metrics..."
  collect_metrics "$URL_B" >> "$OUT_DIR/runs_b.jsonl"
  log "[$i/$REPEATS] $LABEL_B e2e..."
  run_e2e "$URL_B" >> "$OUT_DIR/e2e_b.jsonl"
done

log ""
log "=== DONE ==="
log "Raw data saved to: $OUT_DIR"
log ""
log "Run aggregation: ./scripts/aggregate.mjs"

#!/usr/bin/env bash
# claude-session-hook.sh — Claude Code "Stop" hook
#
# Called automatically when a Claude Code session ends.
# Reads the session marker file, calculates duration, and logs to TaskTime API.
#
# Session marker is created by the "Notification" hook at session start.
# This hook reads it, calculates elapsed time, and POSTs the session.
#
# Environment variables (set in .claude/settings.json or shell):
#   TASKTIME_ISSUE_KEY  — current issue key (e.g. TTMP-83)
#   TASKTIME_API_URL    — API base URL (default: http://localhost:3000)
#   TASKTIME_TOKEN      — JWT token (optional, auto-login if missing)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MARKER_FILE="$PROJECT_DIR/.claude-session-marker"
API_URL="${TASKTIME_API_URL:-http://localhost:3000}"

# Check if marker exists
if [[ ! -f "$MARKER_FILE" ]]; then
  exit 0
fi

# Read marker data
STARTED_AT=$(head -1 "$MARKER_FILE")
ISSUE_KEY=$(sed -n '2p' "$MARKER_FILE" 2>/dev/null || echo "")

# Use env var if marker didn't have issue key
ISSUE_KEY="${ISSUE_KEY:-${TASKTIME_ISSUE_KEY:-}}"

FINISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Clean up marker
rm -f "$MARKER_FILE"

# Calculate approximate tokens from duration
# Estimate: Opus ~1.5K output tokens/min, ~3K input tokens/min for active coding
START_EPOCH=$(date -d "$STARTED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$STARTED_AT" +%s 2>/dev/null || echo 0)
END_EPOCH=$(date +%s)
DURATION_MIN=$(( (END_EPOCH - START_EPOCH) / 60 ))

if [[ "$DURATION_MIN" -lt 1 ]]; then
  # Session too short, skip
  exit 0
fi

# Conservative token estimates for Claude Code CLI sessions
TOKENS_IN=$(( DURATION_MIN * 3000 ))
TOKENS_OUT=$(( DURATION_MIN * 1500 ))

# Cost estimate: Opus 4.6 pricing ($15/1M in, $75/1M out)
COST_IN=$(echo "scale=4; $TOKENS_IN * 15 / 1000000" | bc)
COST_OUT=$(echo "scale=4; $TOKENS_OUT * 75 / 1000000" | bc)
COST=$(echo "scale=2; $COST_IN + $COST_OUT" | bc)

"$SCRIPT_DIR/track-ai-session.sh" \
  --model "claude-opus-4-6" \
  --provider "anthropic" \
  --started "$STARTED_AT" \
  --finished "$FINISHED_AT" \
  --tokens-in "$TOKENS_IN" \
  --tokens-out "$TOKENS_OUT" \
  --cost "$COST" \
  --notes "Claude Code CLI: auto-tracked session (${DURATION_MIN}min)" \
  ${ISSUE_KEY:+--issue "$ISSUE_KEY"} \
  --api "$API_URL" \
  2>/dev/null || true

#!/usr/bin/env bash
# claude-session-start.sh — Claude Code "Notification" hook (session start marker)
#
# Creates a marker file with the current timestamp and optional issue key.
# The "Stop" hook (claude-session-hook.sh) reads this to calculate session duration.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MARKER_FILE="$PROJECT_DIR/.claude-session-marker"

# Only create marker if it doesn't exist (first notification = session start)
if [[ -f "$MARKER_FILE" ]]; then
  exit 0
fi

STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ISSUE_KEY="${TASKTIME_ISSUE_KEY:-}"

echo "$STARTED_AT" > "$MARKER_FILE"
echo "$ISSUE_KEY" >> "$MARKER_FILE"

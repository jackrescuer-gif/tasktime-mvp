#!/usr/bin/env bash
# track-ai-session.sh — Log AI session to TaskTime API
#
# Usage:
#   ./scripts/track-ai-session.sh \
#     --issue TTMP-83 \
#     --model claude-opus-4-6 \
#     --provider anthropic \
#     --started "2026-03-16T10:00:00Z" \
#     --finished "2026-03-16T10:45:00Z" \
#     --tokens-in 45000 \
#     --tokens-out 18000 \
#     --cost 2.03 \
#     --notes "Export API scaffold"
#
# Environment:
#   TASKTIME_API_URL  — default http://localhost:3000
#   TASKTIME_TOKEN    — JWT token (admin/manager)
#
# The script resolves issue key (e.g. TTMP-83) to UUID via the API.
# If --issue is omitted, creates a session without issue linkage.

set -euo pipefail

API_URL="${TASKTIME_API_URL:-http://localhost:3000}"
TOKEN="${TASKTIME_TOKEN:-}"

# Defaults
ISSUE_KEY=""
MODEL=""
PROVIDER="anthropic"
STARTED_AT=""
FINISHED_AT=""
TOKENS_IN=0
TOKENS_OUT=0
COST=0
NOTES=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --issue)      ISSUE_KEY="$2"; shift 2 ;;
    --model)      MODEL="$2"; shift 2 ;;
    --provider)   PROVIDER="$2"; shift 2 ;;
    --started)    STARTED_AT="$2"; shift 2 ;;
    --finished)   FINISHED_AT="$2"; shift 2 ;;
    --tokens-in)  TOKENS_IN="$2"; shift 2 ;;
    --tokens-out) TOKENS_OUT="$2"; shift 2 ;;
    --cost)       COST="$2"; shift 2 ;;
    --notes)      NOTES="$2"; shift 2 ;;
    --token)      TOKEN="$2"; shift 2 ;;
    --api)        API_URL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$MODEL" ]]; then
  echo "Error: --model is required" >&2
  exit 1
fi

if [[ -z "$STARTED_AT" || -z "$FINISHED_AT" ]]; then
  echo "Error: --started and --finished are required" >&2
  exit 1
fi

# Auto-login if no token
if [[ -z "$TOKEN" ]]; then
  echo "No TASKTIME_TOKEN set, logging in as admin@tasktime.ru..."
  LOGIN_RESP=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@tasktime.ru","password":"password123"}')
  TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
  if [[ -z "$TOKEN" ]]; then
    echo "Error: failed to login. Response: $LOGIN_RESP" >&2
    exit 1
  fi
fi

# Resolve issue key to UUID + build issueSplits
ISSUE_SPLITS="[]"
ISSUE_ID=""
if [[ -n "$ISSUE_KEY" ]]; then
  ISSUE_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "$API_URL/api/issues?search=$ISSUE_KEY&limit=1")
  ISSUE_ID=$(echo "$ISSUE_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ -z "$ISSUE_ID" ]]; then
    echo "Warning: could not resolve issue $ISSUE_KEY, creating session without issue link" >&2
  else
    ISSUE_SPLITS="[{\"issueId\":\"$ISSUE_ID\",\"ratio\":1}]"
  fi
fi

# Build JSON payload
PAYLOAD=$(cat <<EOF
{
  "model": "$MODEL",
  "provider": "$PROVIDER",
  "startedAt": "$STARTED_AT",
  "finishedAt": "$FINISHED_AT",
  "tokensInput": $TOKENS_IN,
  "tokensOutput": $TOKENS_OUT,
  "costMoney": $COST,
  "notes": "$NOTES",
  "issueSplits": $ISSUE_SPLITS
}
EOF
)

# Add optional issueId
if [[ -n "$ISSUE_ID" ]]; then
  PAYLOAD=$(echo "$PAYLOAD" | sed "s/\"model\"/\"issueId\":\"$ISSUE_ID\",\"model\"/")
fi

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/ai-sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

if [[ "$HTTP_CODE" == "201" ]]; then
  SESSION_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "AI session created: $SESSION_ID"
  echo "  Model: $MODEL | Provider: $PROVIDER"
  echo "  Tokens: ${TOKENS_IN}in/${TOKENS_OUT}out | Cost: \$$COST"
  [[ -n "$ISSUE_KEY" ]] && echo "  Issue: $ISSUE_KEY ($ISSUE_ID)"
else
  echo "Error ($HTTP_CODE): $BODY" >&2
  exit 1
fi

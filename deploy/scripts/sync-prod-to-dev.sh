#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: deploy/scripts/sync-prod-to-dev.sh <backend-env-file> [--confirm-import]"
  exit 1
fi

BACKEND_ENV_FILE="$1"
CONFIRM_FLAG="${2:-}"

if [ ! -f "$BACKEND_ENV_FILE" ]; then
  echo "Missing backend env file: $BACKEND_ENV_FILE"
  exit 1
fi

BACKEND_ENV_BASENAME="$(basename "$BACKEND_ENV_FILE")"
BACKEND_ENV_BASENAME_LOWER="$(printf '%s' "$BACKEND_ENV_BASENAME" | tr '[:upper:]' '[:lower:]')"

case "$BACKEND_ENV_BASENAME_LOWER" in
  *production*)
    echo "Refusing to run prod-to-dev sync against a production target env file: $BACKEND_ENV_FILE"
    exit 1
    ;;
esac

if [ -n "$CONFIRM_FLAG" ] && [ "$CONFIRM_FLAG" != "--confirm-import" ]; then
  echo "Unknown flag: $CONFIRM_FLAG"
  echo "Usage: deploy/scripts/sync-prod-to-dev.sh <backend-env-file> [--confirm-import]"
  exit 1
fi

set -a
. "$BACKEND_ENV_FILE"
set +a

for required_var in SOURCE_DATABASE_URL DATABASE_URL; do
  if [ -z "${!required_var:-}" ]; then
    echo "Missing required env var in $BACKEND_ENV_FILE: $required_var"
    exit 1
  fi
done

validate_database_pair() {
  node -e '
const [source, target] = process.argv.slice(1);

if (!source) {
  console.error("SOURCE_DATABASE_URL is required for prod-to-dev sync");
  process.exit(1);
}

if (!target) {
  console.error("DATABASE_URL is required for prod-to-dev sync");
  process.exit(1);
}

if (source === target) {
  console.error("SOURCE_DATABASE_URL must not match DATABASE_URL");
  process.exit(1);
}

const sourceUrl = new URL(source);
const targetUrl = new URL(target);

if (sourceUrl.hostname.toLowerCase() === targetUrl.hostname.toLowerCase()) {
  console.error("SOURCE_DATABASE_URL and DATABASE_URL must not point to the same database host");
  process.exit(1);
}
' "$SOURCE_DATABASE_URL" "$DATABASE_URL"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
APPROVAL_DIR="${TMPDIR:-/tmp}/tasktime-prod-sync-approvals"
APPROVAL_FILE="$APPROVAL_DIR/$(printf '%s' "$BACKEND_ENV_FILE" | tr '/:' '__').approval.json"

validate_database_pair

if [ "$CONFIRM_FLAG" = "--confirm-import" ]; then
  if [ ! -f "$APPROVAL_FILE" ]; then
    echo "Run the dry-run first in a separate invocation and review the plan before confirming."
    exit 1
  fi

  node -e '
const fs = require("node:fs");
const approval = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (
  approval.sourceDatabaseUrl !== process.argv[2]
  || approval.targetDatabaseUrl !== process.argv[3]
) {
  console.error("The target env changed after the reviewed dry-run. Run the dry-run again before confirming.");
  process.exit(1);
}
' "$APPROVAL_FILE" "$SOURCE_DATABASE_URL" "$DATABASE_URL"

  validate_database_pair

  echo "Confirmation received. Running prod-to-dev sync import..."
  (
    cd "$BACKEND_DIR"
    npm run db:sync:prod-to-dev
  )
  rm -f "$APPROVAL_FILE"
  exit 0
fi

echo "Running prod-to-dev sync dry-run first..."
(
  cd "$BACKEND_DIR"
  npm run db:sync:prod-to-dev -- --dry-run
)

mkdir -p "$APPROVAL_DIR"
node -e '
const fs = require("node:fs");
fs.writeFileSync(
  process.argv[1],
  JSON.stringify(
    {
      sourceDatabaseUrl: process.argv[2],
      targetDatabaseUrl: process.argv[3],
    },
    null,
    2,
  ),
);
' "$APPROVAL_FILE" "$SOURCE_DATABASE_URL" "$DATABASE_URL"

echo "Dry-run complete. Prod-to-dev sync is a separate operation."
echo "Review the dry-run output, then re-run the command with --confirm-import."

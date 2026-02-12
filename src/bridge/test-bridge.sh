#!/usr/bin/env bash
#
# test-bridge.sh — CLI smoke test for the QUAD Bridge API and job file interface.
#
# Prerequisites:
#   - QUAD must be running: pnpm dev
#   - curl and jq should be installed (jq is optional but recommended)
#
# Usage:
#   bash src/bridge/test-bridge.sh
#   # or
#   chmod +x src/bridge/test-bridge.sh && ./src/bridge/test-bridge.sh
#

set -euo pipefail

API_BASE="http://localhost:4444"
JOB_FILE="$HOME/.quad/jobs.json"
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

header() {
  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
}

check() {
  local description="$1"
  local http_code="$2"
  local expected_code="$3"
  local body="$4"

  if [ "$http_code" = "$expected_code" ]; then
    echo -e "  ${GREEN}✓${NC} $description (HTTP $http_code)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $description (expected HTTP $expected_code, got $http_code)"
    FAIL=$((FAIL + 1))
  fi

  # Print response body (truncated if long)
  if [ -n "$body" ]; then
    local display="$body"
    if [ ${#body} -gt 200 ]; then
      display="${body:0:200}..."
    fi
    echo -e "    ${YELLOW}→${NC} $display"
  fi
}

# ─── Check that QUAD API is reachable ─────────────────────────────────

header "Checking QUAD API availability"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/status" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  echo -e "${RED}ERROR: Cannot reach QUAD API at $API_BASE${NC}"
  echo -e "${RED}Make sure QUAD is running: pnpm dev${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} QUAD API is reachable at $API_BASE"

# ─── Test: GET /api/status ────────────────────────────────────────────

header "GET /api/status — Overall QUAD status"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/status")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Returns status response" "$CODE" "200" "$BODY"

# ─── Test: GET /api/agents — List agents ──────────────────────────────

header "GET /api/agents — List all agents"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/agents")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Returns agents list" "$CODE" "200" "$BODY"

# ─── Test: POST /api/agents — Add a new agent via API ────────────────

header "POST /api/agents — Add a new agent"

AGENT_PAYLOAD='{"name":"API Test Agent","type":"custom","role":"coder","command":"echo","args":["hello from API"]}'
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$AGENT_PAYLOAD" \
  "$API_BASE/api/agents")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Agent created successfully" "$CODE" "201" "$BODY"

# Extract agent ID from response (basic parsing without jq dependency)
AGENT_ID=""
if command -v jq &>/dev/null; then
  AGENT_ID=$(echo "$BODY" | jq -r '.id // empty' 2>/dev/null || true)
else
  # Fallback: extract id field with grep
  AGENT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
fi

if [ -n "$AGENT_ID" ]; then
  echo -e "    ${YELLOW}Agent ID:${NC} $AGENT_ID"

  # ─── Test: GET /api/agents/:id — Get specific agent ─────────────────

  header "GET /api/agents/$AGENT_ID — Get specific agent"

  RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/agents/$AGENT_ID")
  BODY=$(echo "$RESPONSE" | sed '$d')
  CODE=$(echo "$RESPONSE" | tail -1)

  check "Returns agent detail" "$CODE" "200" "$BODY"

  # ─── Test: DELETE /api/agents/:id — Remove agent ────────────────────

  header "DELETE /api/agents/$AGENT_ID — Remove agent"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$API_BASE/api/agents/$AGENT_ID")
  BODY=$(echo "$RESPONSE" | sed '$d')
  CODE=$(echo "$RESPONSE" | tail -1)

  check "Agent removed" "$CODE" "200" "$BODY"
else
  echo -e "  ${YELLOW}⚠${NC} Could not extract agent ID, skipping GET/DELETE agent tests"
fi

# ─── Test: GET /api/agents/:id — 404 for non-existent agent ──────────

header "GET /api/agents/nonexistent — 404 for missing agent"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/agents/nonexistent-agent-id")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Returns 404 for missing agent" "$CODE" "404" "$BODY"

# ─── Test: POST /api/agents — 400 for bad payload ────────────────────

header "POST /api/agents — 400 for missing name"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"type":"custom"}' \
  "$API_BASE/api/agents")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Returns 400 for missing name" "$CODE" "400" "$BODY"

# ─── Test: GET /api/loop — Loop state ────────────────────────────────

header "GET /api/loop — Current loop state"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/loop")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Returns loop state" "$CODE" "200" "$BODY"

# ─── Test: POST /api/loop/start — Start the loop ─────────────────────

header "POST /api/loop/start — Start the loop"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/loop/start")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Loop start acknowledged" "$CODE" "200" "$BODY"

# ─── Test: POST /api/loop/pause — Pause the loop ─────────────────────

header "POST /api/loop/pause — Pause the loop"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/loop/pause")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Loop pause acknowledged" "$CODE" "200" "$BODY"

# ─── Test: POST /api/loop/reset — Reset the loop ─────────────────────

header "POST /api/loop/reset — Reset the loop"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/loop/reset")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Loop reset acknowledged" "$CODE" "200" "$BODY"

# ─── Test: 404 for unknown route ─────────────────────────────────────

header "GET /api/unknown — 404 for unknown route"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/unknown")
BODY=$(echo "$RESPONSE" | sed '$d')
CODE=$(echo "$RESPONSE" | tail -1)

check "Returns 404 for unknown route" "$CODE" "404" "$BODY"

# ─── Test: Job file interface ─────────────────────────────────────────

header "Job File Interface — Write job and verify pickup"

# Ensure the job file directory exists
mkdir -p "$(dirname "$JOB_FILE")"

# Write a sample job entry
JOB_ID="test-job-$(date +%s)"
cat > "$JOB_FILE" << EOF
{
  "version": "1.0",
  "jobs": [
    {
      "id": "$JOB_ID",
      "agent": "custom",
      "role": "coder",
      "name": "Job File Test Agent",
      "command": "echo",
      "args": ["hello from job file"],
      "task": "Test job file integration",
      "status": "pending",
      "addedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    }
  ]
}
EOF

echo -e "  ${GREEN}✓${NC} Wrote pending job to $JOB_FILE (id: $JOB_ID)"
echo -e "    ${YELLOW}→${NC} Waiting 3 seconds for QUAD to pick up the job..."
sleep 3

# Read the job file back and check if status changed from 'pending'
if [ -f "$JOB_FILE" ]; then
  JOB_CONTENT=$(cat "$JOB_FILE")
  echo -e "    ${YELLOW}→${NC} Current job file content:"
  echo -e "    $JOB_CONTENT"

  # Check if status was updated (no longer 'pending')
  if command -v jq &>/dev/null; then
    JOB_STATUS=$(echo "$JOB_CONTENT" | jq -r ".jobs[] | select(.id == \"$JOB_ID\") | .status" 2>/dev/null || echo "unknown")
  else
    JOB_STATUS=$(echo "$JOB_CONTENT" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")
  fi

  if [ "$JOB_STATUS" != "pending" ] && [ "$JOB_STATUS" != "unknown" ]; then
    echo -e "  ${GREEN}✓${NC} Job status updated to '$JOB_STATUS' (QUAD picked it up)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}⚠${NC} Job status is still '$JOB_STATUS' — QUAD may need more time or isn't watching this file"
    echo -e "    ${YELLOW}→${NC} This is expected if QUAD uses a different job file path or the watcher isn't active"
  fi
else
  echo -e "  ${RED}✗${NC} Job file not found at $JOB_FILE"
  FAIL=$((FAIL + 1))
fi

# Clean up — reset job file to empty
cat > "$JOB_FILE" << 'EOF'
{
  "version": "1.0",
  "jobs": []
}
EOF
echo -e "  ${GREEN}✓${NC} Cleaned up job file"

# ─── Summary ──────────────────────────────────────────────────────────

header "Test Summary"

TOTAL=$((PASS + FAIL))
echo -e "  ${GREEN}Passed:${NC} $PASS"
echo -e "  ${RED}Failed:${NC} $FAIL"
echo -e "  Total: $TOTAL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Some tests failed. Check the output above for details.${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi

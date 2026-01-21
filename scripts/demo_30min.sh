#!/bin/bash

# Shipyard Community v0.2.0 – 30-minute demo script
# Runs a complete live workflow: build → test → serve → curl demos

set -e  # Exit on error

DEFAULT_PORT=8788
DEMO_PORT="${PORT:-$DEFAULT_PORT}"
SERVER_PID=""

port_in_use() {
  local port="$1"
  python3 - "$port" <<'PY'
import socket, sys
port = int(sys.argv[1])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.settimeout(0.25)
    used = s.connect_ex(("127.0.0.1", port)) == 0
sys.exit(0 if used else 1)
PY
}

find_free_port() {
  python3 - <<'PY'
import socket
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind(("", 0))
    print(s.getsockname()[1])
PY
}

# Cleanup function: kill server on exit
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "🧹 Cleaning up server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    sleep 1
  fi
}

trap cleanup EXIT

echo "════════════════════════════════════════════════"
echo "  Shipyard Community – 30-Minute Live Demo"
echo "════════════════════════════════════════════════"
echo ""

# Resolve port and handle conflicts
if port_in_use "$DEMO_PORT"; then
  if [ -z "${PORT:+set}" ] && [ "$DEMO_PORT" = "$DEFAULT_PORT" ]; then
    echo "⚠️  Default port $DEFAULT_PORT is busy; searching for a free port..."
    ALT_PORT=$(find_free_port)
    DEMO_PORT="$ALT_PORT"
    echo "   Using fallback PORT=$DEMO_PORT"
  else
    echo "❌ Port $DEMO_PORT is busy. Choose a different port, e.g."
    echo "   PORT=8790 bash scripts/demo_30min.sh"
    exit 1
  fi
fi

# Step 1: Build UI
echo "📦 Step 1: Building UI..."
pnpm -s build
echo "   ✅ Build complete"
echo ""

# Step 2: Run smoke tests
echo "🧪 Step 2: Running smoke tests..."
pnpm -s test:smoke
echo "   ✅ Smoke tests passed"
echo ""

# Step 3: Start server in background on PORT 8788
echo "🚀 Step 3: Starting server on port $DEMO_PORT..."
PORT=$DEMO_PORT pnpm -s start > /tmp/demo_server.log 2>&1 &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"
echo "   Base URL: http://127.0.0.1:$DEMO_PORT"

# Wait for server to be ready
echo "   Waiting for server to boot..."
RETRY_COUNT=0
MAX_RETRIES=15
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -fsS http://127.0.0.1:$DEMO_PORT/health > /dev/null 2>&1; then
    echo "   ✅ Server ready"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "   ❌ Server failed to start"
  cat /tmp/demo_server.log
  exit 1
fi
echo ""

# Step 4: Run live demos
echo "📡 Step 4: Running live API demos..."
echo ""

echo "  Demo 1: Health check"
HEALTH=$(curl -fsS http://127.0.0.1:$DEMO_PORT/health)
echo "    GET /health"
echo "    Response: $HEALTH"
echo "    ✅ HTTP 200"
echo ""

echo "  Demo 2: Orchestrator state"
STATE=$(curl -fsS http://127.0.0.1:$DEMO_PORT/api/state)
echo "    GET /api/state"
echo "    Response: $(echo "$STATE" | jq -r '.current' 2>/dev/null || echo '(state object)')"
echo "    ✅ HTTP 200"
echo ""

echo "  Demo 3: Project list"
PROJECTS=$(curl -fsS http://127.0.0.1:$DEMO_PORT/api/projects)
PROJECT_COUNT=$(echo "$PROJECTS" | jq 'length' 2>/dev/null || echo "N/A")
echo "    GET /api/projects"
echo "    Response: $PROJECT_COUNT projects"
echo "    ✅ HTTP 200"
echo ""

# Summary
echo "════════════════════════════════════════════════"
echo "✅ Demo complete!"
echo "════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  • UI built successfully"
echo "  • Smoke tests passed"
echo "  • Server running on http://127.0.0.1:$DEMO_PORT"
echo "  • All 3 API endpoints returned HTTP 200"
echo ""
echo "What you saw:"
echo "  - The open-core orchestrator managing projects locally"
echo "  - State synchronization (no platform dependencies)"
echo "  - Project registry from ./data/projects.json"
echo ""
echo "Try manually:"
echo "  curl -fsS http://127.0.0.1:$DEMO_PORT/api/project-status?id=agent-dashboard"
echo ""
echo "The server will shut down automatically when this script exits."
echo ""
